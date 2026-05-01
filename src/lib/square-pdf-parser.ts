import Anthropic from '@anthropic-ai/sdk';
import type { ParsedSquareRow, SquareParseResult } from './square-csv-parser';

const ITEMS_SYSTEM_PROMPT = `You are parsing a Square Item Sales PDF for a Texas booster club concession stand. The PDF has one transaction line item per row, with columns: Date, Time, Time Zone, Category, Item, Qty, Price Point Name (variation), SKU, Modifiers Applied, Gross Sales, Discounts, Net Sales, Tax, Transaction ID, Payment ID, Device Name, Notes.

ACCURACY RULES (these matter — the totals must match Square's own numbers):
- Each row in the table is ONE sale of an item. Do not invent or duplicate rows.
- Qty is usually 1.0; sometimes 2.0, 3.0, 4.0.
- Net Sales is the dollar amount in the Net Sales column.
- The PDF may have card-brand footer pages listing "MasterCard" / "Visa" / card numbers — IGNORE those entirely.
- Aggregate to one row per unique (Item, Variation) pair: sum Qty and sum Net Sales (in cents).
- total_qty = sum of all Qty values across every transaction line, before aggregation.
- total_net_sales_cents = sum of all Net Sales values across every transaction line.

Always call the submit_items tool exactly once with the structured output. Do not return prose.`;

const ITEMS_TOOL = {
  name: 'submit_items',
  description:
    'Emit aggregated Square item sales data. Always call this tool exactly once with the structured output.',
  input_schema: {
    type: 'object' as const,
    properties: {
      total_qty: { type: 'integer' },
      total_net_sales_cents: { type: 'integer' },
      total_gross_sales_cents: { type: 'integer' },
      date_range: {
        type: 'object',
        properties: {
          start: { type: ['string', 'null'] },
          end: { type: ['string', 'null'] },
        },
        required: ['start', 'end'],
      },
      raw_row_count: { type: 'integer' },
      rows: {
        type: 'array',
        description:
          'One row per unique item + variation. item is a name like "Cheeseburger". variation is "Regular", a flavor like "Cool Blue" or "Lemon Lime", or a size — null when none. qty is total sold, net is total cents.',
        items: {
          type: 'object',
          properties: {
            item: { type: 'string' },
            variation: { type: ['string', 'null'] },
            qty: { type: 'number' },
            net_sales_cents: { type: 'integer' },
          },
          required: ['item', 'qty', 'net_sales_cents'],
        },
      },
    },
    required: [
      'total_qty',
      'total_net_sales_cents',
      'total_gross_sales_cents',
      'date_range',
      'raw_row_count',
      'rows',
    ],
  },
};

const SUMMARY_SYSTEM_PROMPT = `You are parsing a Square "Sales Summary" PDF. The page lists totals (Gross Sales, Items, Service Charges, Returns, Discounts & Comps, Net Sales, Gift Card Sales, Tax, Tip, Refunds by Amount, Total) and a Payments breakdown (Total Collected, Cash, Card, Other, Gift Card, Cash App, Fees, Net Total).

Convert each dollar value to integer cents. If a row says "-$26.09", that becomes -2609. Always call the submit_summary tool. Use null for fields that are not present.`;

const SUMMARY_TOOL = {
  name: 'submit_summary',
  description: 'Submit parsed Square sales summary totals.',
  input_schema: {
    type: 'object' as const,
    properties: {
      gross_sales_cents: { type: ['integer', 'null'] },
      net_sales_cents: { type: ['integer', 'null'] },
      tax_cents: { type: ['integer', 'null'] },
      tip_cents: { type: ['integer', 'null'] },
      total_cents: { type: ['integer', 'null'] },
      total_collected_cents: { type: ['integer', 'null'] },
      cash_cents: { type: ['integer', 'null'] },
      card_cents: { type: ['integer', 'null'] },
      cashapp_cents: { type: ['integer', 'null'] },
      other_cents: { type: ['integer', 'null'] },
      giftcard_cents: { type: ['integer', 'null'] },
      fees_cents: { type: ['integer', 'null'] },
      net_total_cents: { type: ['integer', 'null'] },
    },
    required: ['gross_sales_cents', 'net_sales_cents', 'total_cents'],
  },
};

export type ParsedSalesSummary = {
  gross_sales_cents: number | null;
  net_sales_cents: number | null;
  tax_cents: number | null;
  tip_cents: number | null;
  total_cents: number | null;
  total_collected_cents: number | null;
  cash_cents: number | null;
  card_cents: number | null;
  cashapp_cents: number | null;
  other_cents: number | null;
  giftcard_cents: number | null;
  fees_cents: number | null;
  net_total_cents: number | null;
};

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function parseSquareItemsPdf(pdfBuffer: Buffer): Promise<SquareParseResult> {
  // Vision-based PDF document parsing is more accurate on Square's
  // tabular exports than text-extracted parsing — when text is extracted
  // by pdf-parse-fork it loses column boundaries, which leads Haiku to
  // miscount qty/sales totals. Slim per-row schema + temperature 0 keeps
  // the parse fast and deterministic.
  const base64 = pdfBuffer.toString('base64');
  const response = await client().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16384,
    temperature: 0,
    system: ITEMS_SYSTEM_PROMPT,
    tools: [ITEMS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_items' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          { type: 'text', text: 'Parse this Square Item Sales PDF.' },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return {
      ok: false,
      reason: 'Claude did not return a tool_use block for items PDF',
      raw_row_count: 0,
    };
  }

  const out = toolUse.input as {
    total_qty: number;
    total_net_sales_cents: number;
    total_gross_sales_cents: number;
    date_range: { start: string | null; end: string | null };
    raw_row_count: number;
    rows: Array<{
      item: string;
      variation?: string | null;
      qty: number;
      net_sales_cents: number;
    }>;
  };

  if (!Array.isArray(out.rows) || out.rows.length === 0) {
    return { ok: false, reason: 'No rows returned from items PDF parse', raw_row_count: 0 };
  }

  // Slim schema -> fill in nulls for the matcher's expected ParsedSquareRow shape
  const rows: ParsedSquareRow[] = out.rows.map((r) => ({
    item: r.item,
    variation: r.variation ?? null,
    sku: null,
    category: null,
    qty: r.qty,
    net_sales_cents: r.net_sales_cents,
    gross_sales_cents: r.net_sales_cents,
  }));

  return {
    ok: true,
    rows: rows.sort((a, b) => b.net_sales_cents - a.net_sales_cents),
    total_qty: out.total_qty,
    total_net_sales_cents: out.total_net_sales_cents,
    total_gross_sales_cents: out.total_gross_sales_cents ?? out.total_net_sales_cents,
    date_range: out.date_range,
    raw_row_count: out.raw_row_count,
  };
}

export async function parseSquareSummaryPdf(
  pdfBuffer: Buffer,
): Promise<ParsedSalesSummary> {
  const base64 = pdfBuffer.toString('base64');
  const response = await client().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    temperature: 0,
    system: SUMMARY_SYSTEM_PROMPT,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: 'submit_summary' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          { type: 'text', text: 'Parse this Square Sales Summary.' },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return a tool_use block for summary PDF');
  }
  return toolUse.input as ParsedSalesSummary;
}
