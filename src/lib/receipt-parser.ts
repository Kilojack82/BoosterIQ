import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a receipt parser for a youth-sports booster club concession-stand inventory system.

Your job: read the photographed receipt and emit structured JSON describing the vendor, the date, the total, and each line item. You must always call the submit_receipt tool with your output. Do not return prose.

Rules:
- Extract every purchasable line item. Skip subtotals, tax lines, discounts, and totals.
- Quantities are usually 1 unless explicitly noted; if unclear, default to 1 and mark confidence "low".
- Money values: convert dollars to integer cents. $4.99 -> 499. $12 -> 1200.
- If you can't read a value with certainty, set the field to null and mark confidence "low".
- For each line item set confidence: "high" if you read it clearly; "medium" if abbreviated/cropped/blurry but probable; "low" if you guessed.
- After listing line items, verify their total_cents sums to the receipt total within $0.50; if not, set total_reconciles to false.
- Do not invent items. If you can't read clearly, prefer fewer high-confidence items over many low-confidence ones.`;

const TOOL = {
  name: 'submit_receipt',
  description:
    'Emit the parsed receipt data. Always call this tool exactly once with the structured output.',
  input_schema: {
    type: 'object' as const,
    properties: {
      vendor: { type: 'string', description: 'Vendor name (e.g. "Sam\'s Club", "HEB").' },
      receipt_date: {
        type: ['string', 'null'],
        description: 'ISO 8601 date if visible (YYYY-MM-DD), else null.',
      },
      total_cents: {
        type: ['integer', 'null'],
        description: 'Receipt total in cents, else null.',
      },
      total_reconciles: {
        type: 'boolean',
        description:
          'True if the sum of line item total_cents matches the receipt total within $0.50.',
      },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unit_price_cents: { type: ['integer', 'null'] },
            total_cents: { type: ['integer', 'null'] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['description', 'quantity', 'confidence'],
        },
      },
    },
    required: ['vendor', 'total_reconciles', 'line_items'],
  },
};

export type ReceiptLineItem = {
  description: string;
  quantity: number;
  unit_price_cents: number | null;
  total_cents: number | null;
  confidence: 'high' | 'medium' | 'low';
};

export type ParsedReceipt = {
  vendor: string;
  receipt_date: string | null;
  total_cents: number | null;
  total_reconciles: boolean;
  line_items: ReceiptLineItem[];
};

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function parseReceipt(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
): Promise<ParsedReceipt> {
  const response = await client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'submit_receipt' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          { type: 'text', text: 'Parse this receipt.' },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return a tool_use block');
  }
  return toolUse.input as ParsedReceipt;
}
