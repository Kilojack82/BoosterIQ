import * as XLSX from 'xlsx';
import { createAdminClient } from '@/utils/supabase/admin';

export type SimpleImportResult = {
  format: 'simple';
  total_rows: number;
  matched_by_code: number;
  matched_by_name: number;
  created: number;
  base_stock_applied: number;
  skipped: number;
  skipped_reasons: string[];
};

const NAME_HEADERS = new Set(['item name', 'name', 'item']);
const STOCK_HEADERS = new Set([
  'base stock',
  'counted quantity',
  'quantity',
  'count',
  'qty',
  'on hand',
]);

const CATALOG_CODE = /^CAT-\d{4}$/;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['"`,.()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const dollarsToCents = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

const trim = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
};

type DetectionResult = {
  sheetName: string;
  headerRow: number; // 0-indexed
  columnIndex: {
    itemId?: number;
    itemName: number;
    category?: number;
    unit?: number;
    baseStock: number;
    parLevel?: number;
    costBasis?: number;
    vendor?: number;
    notes?: number;
    squareToken?: number;
    squareHandle?: number;
  };
};

/**
 * Scan a workbook for the single-page Item Name + Base Stock layout.
 * Skips the full master-sheet shape (which has a Catalog tab).
 *
 * Tolerates 0-N preamble rows before the header by scanning each row
 * for one that contains both an Item Name and a Base Stock column.
 */
export function detectSimpleFormat(wb: XLSX.WorkBook): DetectionResult | null {
  if (wb.Sheets['Catalog']) return null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
    });
    for (let r = 0; r < Math.min(grid.length, 20); r += 1) {
      const row = grid[r];
      if (!row) continue;
      const lowered = row.map((cell) =>
        cell == null ? '' : String(cell).toLowerCase().trim(),
      );
      const nameIdx = lowered.findIndex((c) => NAME_HEADERS.has(c));
      const stockIdx = lowered.findIndex((c) => STOCK_HEADERS.has(c));
      if (nameIdx === -1 || stockIdx === -1) continue;
      const lookup = (set: Set<string> | string) =>
        lowered.findIndex((c) =>
          typeof set === 'string' ? c === set : set.has(c),
        );
      return {
        sheetName,
        headerRow: r,
        columnIndex: {
          itemId: indexOrUndef(lowered, ['item id', 'code']),
          itemName: nameIdx,
          category: indexOrUndef(lowered, ['category']),
          unit: indexOrUndef(lowered, ['unit']),
          baseStock: stockIdx,
          parLevel: indexOrUndef(lowered, ['par level', 'par']),
          costBasis: indexOrUndef(lowered, ['cost basis', 'cost basis ($)', 'cost']),
          vendor: indexOrUndef(lowered, ['vendor']),
          notes: indexOrUndef(lowered, ['notes']),
          squareToken: indexOrUndef(lowered, ['square token']),
          squareHandle: indexOrUndef(lowered, ['square handle', 'reference handle']),
        },
      };
    }
  }
  return null;
}

function indexOrUndef(lowered: string[], names: string[]): number | undefined {
  for (const n of names) {
    const idx = lowered.indexOf(n);
    if (idx !== -1) return idx;
  }
  return undefined;
}

export async function importSimpleInventory(
  wb: XLSX.WorkBook,
  detection: DetectionResult,
): Promise<SimpleImportResult> {
  const supabase = createAdminClient();

  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .select('id')
    .eq('shortname', 'LakeVistaVikings')
    .single();
  if (clubErr || !club) throw new Error(`Vikings club not found: ${clubErr?.message}`);
  const clubId = club.id as string;

  const { data: catalog } = await supabase
    .from('catalog_items')
    .select('id, code, name, current_stock')
    .eq('club_id', clubId)
    .eq('is_merch', false);
  const byCode = new Map<string, { id: string; current_stock: number }>();
  const byName = new Map<string, { id: string; code: string; current_stock: number }>();
  for (const c of catalog ?? []) {
    if (c.code) byCode.set(c.code, { id: c.id, current_stock: c.current_stock });
    if (c.name)
      byName.set(norm(c.name), {
        id: c.id,
        code: c.code,
        current_stock: c.current_stock,
      });
  }

  const { data: maxRow } = await supabase
    .from('catalog_items')
    .select('code')
    .eq('club_id', clubId)
    .ilike('code', 'CAT-%')
    .order('code', { ascending: false })
    .limit(1);
  const lastCode = maxRow?.[0]?.code as string | undefined;
  const lastNum = lastCode ? parseInt(lastCode.replace(/^CAT-/, ''), 10) : 0;
  let nextCatNum = (Number.isFinite(lastNum) ? lastNum : 0) + 1;

  const sheet = wb.Sheets[detection.sheetName]!;
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
  const dataRows = grid.slice(detection.headerRow + 1);

  const ci = detection.columnIndex;
  let matchedByCode = 0;
  let matchedByName = 0;
  let created = 0;
  let baseStockApplied = 0;
  let skipped = 0;
  const skippedReasons: string[] = [];

  let processedRows = 0;
  for (const row of dataRows) {
    if (!row) continue;
    const cell = (idx: number | undefined) =>
      idx != null && idx < row.length ? row[idx] : null;

    const rawName = cell(ci.itemName);
    const rawStock = cell(ci.baseStock);
    const rawCode = ci.itemId != null ? cell(ci.itemId) : null;

    const name = trim(rawName);
    const code = trim(rawCode);

    // Skip metadata/instruction rows like ("system", "system", "you set", ...)
    if (!name) continue;
    if (code && !CATALOG_CODE.test(code) && code.toLowerCase() === 'system') continue;

    processedRows += 1;

    if (rawStock == null || String(rawStock).trim() === '') {
      // Item present but no Base Stock value — skip silently (chair hasn't
      // counted this item this round).
      continue;
    }
    const stockNum = Number(String(rawStock).replace(/[,$\s]/g, ''));
    if (!Number.isFinite(stockNum)) {
      skipped += 1;
      skippedReasons.push(`${name}: invalid Base Stock value "${rawStock}"`);
      continue;
    }
    const counted = Math.round(stockNum);

    let existing: { id: string; code?: string; current_stock: number } | undefined;
    let matchType: 'code' | 'name' | null = null;
    if (code && CATALOG_CODE.test(code)) {
      existing = byCode.get(code);
      if (existing) matchType = 'code';
    }
    if (!existing) {
      existing = byName.get(norm(name));
      if (existing) matchType = 'name';
    }

    let catalogId: string;
    let prevStock: number;
    if (existing) {
      catalogId = existing.id;
      prevStock = existing.current_stock;
      if (matchType === 'code') matchedByCode += 1;
      else matchedByName += 1;
    } else {
      const newCode =
        code && CATALOG_CODE.test(code)
          ? code
          : `CAT-${String(nextCatNum).padStart(4, '0')}`;
      if (newCode.startsWith('CAT-') && !code) nextCatNum += 1;
      const insertPayload: Record<string, unknown> = {
        club_id: clubId,
        code: newCode,
        name,
        unit: trim(cell(ci.unit)) ?? 'each',
        category: trim(cell(ci.category)),
        current_stock: 0,
        is_merch: false,
        notes: trim(cell(ci.notes)) ?? 'Auto-created from base stock upload',
        vendor: trim(cell(ci.vendor)),
        cost_basis_cents: dollarsToCents(cell(ci.costBasis)),
        par_level: numberOrNull(cell(ci.parLevel)) ?? counted,
        square_token: trim(cell(ci.squareToken)),
        reference_handle: trim(cell(ci.squareHandle)),
      };
      const { data: newItem, error: createErr } = await supabase
        .from('catalog_items')
        .insert(insertPayload)
        .select('id')
        .single();
      if (createErr || !newItem) {
        skipped += 1;
        skippedReasons.push(`${name}: create failed (${createErr?.message ?? 'unknown'})`);
        continue;
      }
      catalogId = newItem.id as string;
      prevStock = 0;
      created += 1;
      byName.set(norm(name), { id: catalogId, code: newCode, current_stock: counted });
      byCode.set(newCode, { id: catalogId, current_stock: counted });
    }

    // For existing rows, update the optional fields they may have provided.
    // par_level always falls back to the counted base stock so the shopping
    // list can compute "buy = base - current_stock" (refill to base).
    if (matchType) {
      const updates: Record<string, unknown> = {};
      const cat = trim(cell(ci.category));
      const unit = trim(cell(ci.unit));
      const par = numberOrNull(cell(ci.parLevel)) ?? counted;
      const costBasis = dollarsToCents(cell(ci.costBasis));
      const vendor = trim(cell(ci.vendor));
      const notes = trim(cell(ci.notes));
      const sqToken = trim(cell(ci.squareToken));
      const sqHandle = trim(cell(ci.squareHandle));
      if (cat != null) updates.category = cat;
      if (unit != null) updates.unit = unit;
      updates.par_level = par;
      if (costBasis != null) updates.cost_basis_cents = costBasis;
      if (vendor != null) updates.vendor = vendor;
      if (notes != null) updates.notes = notes;
      if (sqToken != null) updates.square_token = sqToken;
      if (sqHandle != null) updates.reference_handle = sqHandle;
      if (Object.keys(updates).length > 0) {
        await supabase.from('catalog_items').update(updates).eq('id', catalogId);
      }
    }

    const delta = counted - prevStock;
    if (delta !== 0) {
      const { error: moveErr } = await supabase.from('stock_movements').insert({
        catalog_item_id: catalogId,
        delta,
        source_type: 'reconcile',
        notes: `Base stock count: ${counted}`,
      });
      if (moveErr) {
        skipped += 1;
        skippedReasons.push(`${name}: stock_movement failed (${moveErr.message})`);
        continue;
      }
    }
    const { error: stockErr } = await supabase
      .from('catalog_items')
      .update({ current_stock: counted })
      .eq('id', catalogId);
    if (stockErr) {
      skipped += 1;
      skippedReasons.push(`${name}: stock update failed (${stockErr.message})`);
      continue;
    }
    baseStockApplied += 1;
  }

  return {
    format: 'simple',
    total_rows: processedRows,
    matched_by_code: matchedByCode,
    matched_by_name: matchedByName,
    created,
    base_stock_applied: baseStockApplied,
    skipped,
    skipped_reasons: skippedReasons.slice(0, 10),
  };
}

function numberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
