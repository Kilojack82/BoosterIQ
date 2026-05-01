import { describe, expect, it } from 'vitest';
import { parseSquareCsv } from './square-csv-parser';

const HEADER =
  'Date,Time,Category,Item,Qty,Price Point Name,SKU,Modifiers Applied,Gross Sales,Discounts,Net Sales,Tax,Transaction ID,Payment ID';

describe('parseSquareCsv', () => {
  it('aggregates duplicate rows by item + variation + sku', () => {
    const csv = [
      HEADER,
      '2026-04-25,18:01,Drinks,Gatorade,1,Blue,SKU100,,$3.00,$0.00,$3.00,$0.00,T1,P1',
      '2026-04-25,18:05,Drinks,Gatorade,2,Blue,SKU100,,$6.00,$0.00,$6.00,$0.00,T2,P2',
      '2026-04-25,19:00,Candy,Kit Kat,1,Regular,SKU200,,$1.50,$0.00,$1.50,$0.00,T3,P3',
    ].join('\n');

    const result = parseSquareCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.rows).toHaveLength(2);
    const gatorade = result.rows.find((r) => r.item === 'Gatorade');
    expect(gatorade).toBeDefined();
    expect(gatorade!.qty).toBe(3);
    expect(gatorade!.net_sales_cents).toBe(900);
    expect(gatorade!.sku).toBe('SKU100');
    expect(gatorade!.variation).toBe('Blue');

    expect(result.total_qty).toBe(4);
    expect(result.total_net_sales_cents).toBe(1050);
  });

  it('treats different SKUs as different rows even if item name matches', () => {
    const csv = [
      HEADER,
      '2026-04-25,18:01,Apparel,T-Shirt,1,Small,SKU-S,,$15.00,$0.00,$15.00,$0.00,T1,P1',
      '2026-04-25,18:05,Apparel,T-Shirt,1,Large,SKU-L,,$15.00,$0.00,$15.00,$0.00,T2,P2',
    ].join('\n');

    const result = parseSquareCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
  });

  it('handles missing money values gracefully', () => {
    const csv = [
      HEADER,
      '2026-04-25,18:01,Drinks,Water,3,Bottle,,,$0.00,$0.00,,$0.00,T1,P1',
    ].join('\n');
    const result = parseSquareCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.net_sales_cents).toBe(0);
    expect(result.rows[0]?.qty).toBe(3);
  });

  it('returns failure when required columns are missing', () => {
    const csv = 'Foo,Bar\n1,2';
    const result = parseSquareCsv(csv);
    expect(result.ok).toBe(false);
  });

  it('returns failure on empty data', () => {
    const result = parseSquareCsv(HEADER + '\n');
    expect(result.ok).toBe(false);
  });

  it('captures date range across rows', () => {
    const csv = [
      HEADER,
      '2026-04-25,18:01,Drinks,Gatorade,1,Blue,SKU100,,$3.00,$0.00,$3.00,$0.00,T1,P1',
      '2026-04-25,21:30,Drinks,Gatorade,1,Blue,SKU100,,$3.00,$0.00,$3.00,$0.00,T2,P2',
      '2026-04-26,12:00,Drinks,Water,1,Bottle,,,$2.00,$0.00,$2.00,$0.00,T3,P3',
    ].join('\n');
    const result = parseSquareCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.date_range.start).toBe('2026-04-25');
    expect(result.date_range.end).toBe('2026-04-26');
  });
});
