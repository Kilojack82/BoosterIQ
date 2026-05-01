import Anthropic from '@anthropic-ai/sdk';
import type { ParsedSquareRow, SquareParseResult } from './square-csv-parser';

const ITEMS_SYSTEM_PROMPT = `You are parsing a Square "Item Sales" or "Items" PDF report exported by a Texas booster club. Each row is one line item from one transaction. Columns include: Date, Time, Time Zone, Category, Item, Qty, Price Point Name (variation), SKU, Modifiers Applied, Gross Sales, Discounts, Net Sales, Tax, Transaction ID, Payment ID, Device Name, Notes.

Your job:
1. Extract every line item across every page.
2. Aggregate rows that share the same SKU + Item + Price Point Name (variation) by summing Qty, Gross Sales, and Net Sales.
3. Convert dollar amounts to integer cents ($3.00 -> 300; $1.50 -> 150).
4. Capture the date range across all rows.
5. Return total_qty (sum of all Qty values, before aggregation) and total_net_sales_cents (sum of all Net Sales, before aggregation).

Always call the submit_items tool with your output. Never include subtotal/tax/total rows from Square's footer.`;

const ITEMS_TOOL = {
  name: 'submit_items',
  description: 'Submit aggregated Square item sales data.',
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
        items: {
          type: 'object',
          properties: {
            item: { type: 'string' },
            variation: { type: ['string', 'null'] },
            sku: { type: ['string', 'null'] },
            category: { type: ['string', 'null'] },
            qty: { type: 'number' },
            net_sales_cents: { type: 'integer' },
            gross_sales_cents: { type: 'integer' },
          },
          required: ['item', 'qty', 'net_sales_cents', 'gross_sales_cents'],
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

export async function parseSquareItemsPdf(pdfBase64: string): Promise<SquareParseResult> {
  const response = await client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: ITEMS_SYSTEM_PROMPT,
    tools: [ITEMS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_items' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: 'Parse this Square items report.' },
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
    rows: ParsedSquareRow[];
  };

  if (!Array.isArray(out.rows) || out.rows.length === 0) {
    return { ok: false, reason: 'No rows returned from items PDF parse', raw_row_count: 0 };
  }

  return {
    ok: true,
    rows: out.rows.sort((a, b) => b.net_sales_cents - a.net_sales_cents),
    total_qty: out.total_qty,
    total_net_sales_cents: out.total_net_sales_cents,
    total_gross_sales_cents: out.total_gross_sales_cents,
    date_range: out.date_range,
    raw_row_count: out.raw_row_count,
  };
}

export async function parseSquareSummaryPdf(pdfBase64: string): Promise<ParsedSalesSummary> {
  const response = await client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SUMMARY_SYSTEM_PROMPT,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: 'submit_summary' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: 'Parse this Square sales summary.' },
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
