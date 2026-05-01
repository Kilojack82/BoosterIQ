import Papa from 'papaparse';

export type ParsedSquareRow = {
  item: string;
  variation: string | null;
  sku: string | null;
  category: string | null;
  qty: number;
  net_sales_cents: number;
  gross_sales_cents: number;
};

export type SquareParseResult =
  | {
      ok: true;
      rows: ParsedSquareRow[];
      total_qty: number;
      total_net_sales_cents: number;
      total_gross_sales_cents: number;
      date_range: { start: string | null; end: string | null };
      raw_row_count: number;
    }
  | { ok: false; reason: string; raw_row_count: number };

const moneyToCents = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[$,\s]/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

const intOr = (raw: string | null | undefined, fallback: number): number => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const trimOrNull = (raw: string | null | undefined): string | null => {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
};

/**
 * Parse a Square Item Sales CSV. Aggregates rows by item + variation +
 * SKU so a busy game with 200 transactions becomes ~30 catalog-relevant
 * rows for review.
 *
 * Square's CSV columns (per BUILD_BRIEF.md): Date, Time, Category, Item,
 * Qty, Price Point Name, SKU, Modifiers Applied, Gross Sales, Discounts,
 * Net Sales, Tax, Transaction ID, Payment ID. We use a subset.
 */
export function parseSquareCsv(input: string): SquareParseResult {
  const parsed = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const fatalErrors = parsed.errors.filter((e) => e.code !== 'TooFewFields');
    if (fatalErrors.length > 0) {
      return {
        ok: false,
        reason: `CSV parse error: ${fatalErrors[0]!.message}`,
        raw_row_count: parsed.data.length,
      };
    }
  }

  const requiredColumns = ['Item', 'Qty'];
  const headers = parsed.meta.fields ?? [];
  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      return {
        ok: false,
        reason: `CSV is missing required column "${col}". Got: ${headers.join(', ')}`,
        raw_row_count: parsed.data.length,
      };
    }
  }

  type Bucket = ParsedSquareRow & { count: number };
  const buckets = new Map<string, Bucket>();
  let totalQty = 0;
  let totalNet = 0;
  let totalGross = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const row of parsed.data) {
    const item = trimOrNull(row['Item']);
    if (!item) continue;
    const variation = trimOrNull(row['Price Point Name']);
    const sku = trimOrNull(row['SKU']);
    const category = trimOrNull(row['Category']);
    const qty = intOr(row['Qty'], 1);
    const net = moneyToCents(row['Net Sales']);
    const gross = moneyToCents(row['Gross Sales']);
    const date = trimOrNull(row['Date']);

    totalQty += qty;
    totalNet += net;
    totalGross += gross;
    if (date) {
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }

    const key = [sku ?? '', item, variation ?? ''].join('||');
    const existing = buckets.get(key);
    if (existing) {
      existing.qty += qty;
      existing.net_sales_cents += net;
      existing.gross_sales_cents += gross;
      existing.count += 1;
    } else {
      buckets.set(key, {
        item,
        variation,
        sku,
        category,
        qty,
        net_sales_cents: net,
        gross_sales_cents: gross,
        count: 1,
      });
    }
  }

  const rows: ParsedSquareRow[] = Array.from(buckets.values())
    .map((b) => ({
      item: b.item,
      variation: b.variation,
      sku: b.sku,
      category: b.category,
      qty: b.qty,
      net_sales_cents: b.net_sales_cents,
      gross_sales_cents: b.gross_sales_cents,
    }))
    .sort((a, b) => b.net_sales_cents - a.net_sales_cents);

  if (rows.length === 0) {
    return {
      ok: false,
      reason: 'CSV had no usable rows (no Item values).',
      raw_row_count: parsed.data.length,
    };
  }

  return {
    ok: true,
    rows,
    total_qty: totalQty,
    total_net_sales_cents: totalNet,
    total_gross_sales_cents: totalGross,
    date_range: { start: minDate, end: maxDate },
    raw_row_count: parsed.data.length,
  };
}
