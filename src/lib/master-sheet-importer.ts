import * as XLSX from 'xlsx';
import { createAdminClient } from '@/utils/supabase/admin';

const trim = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
};

const dollarsToCents = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
};

const isPlaceholder = (v: string | null): boolean => {
  if (!v) return true;
  return v.startsWith('(') && v.endsWith(')');
};

const CATALOG_CODE = /^CAT-\d{4}$/;

export type ImportResult = {
  catalog_concessions: number;
  catalog_merch: number;
  menu_items: number;
  menu_items_matched: number;
  base_stock_applied: number;
  base_stock_skipped: number;
  settings_fields_updated: number;
};

/**
 * Apply a master-inventory xlsx workbook (uploaded by the chair) to the
 * Vikings club. Same logic as scripts/seed-master-sheet.ts but exposed
 * as a function so an API route can call it.
 *
 * Reads tabs: Catalog, Apparel & Merch, Menu, Settings, Base Stock (optional).
 */
export async function importMasterSheet(buffer: Buffer): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const supabase = createAdminClient();

  const requireSheet = (name: string) => {
    const sheet = wb.Sheets[name];
    if (!sheet) throw new Error(`Sheet "${name}" not found in workbook`);
    return sheet;
  };

  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .select('id')
    .eq('shortname', 'LakeVistaVikings')
    .single();
  if (clubErr || !club) throw new Error(`Vikings club not found: ${clubErr?.message}`);
  const clubId = club.id as string;

  // --- Catalog ---
  type CatalogRow = {
    'Item ID'?: string;
    'Item Name'?: string;
    Category?: string;
    Unit?: string;
    'Par Level'?: number;
    'Current Stock'?: number;
    'Cost Basis ($)'?: number;
    Vendor?: string;
    Notes?: string;
    'Square Token'?: string;
    'Reference Handle'?: string;
  };
  const catalogRaw = XLSX.utils.sheet_to_json<CatalogRow>(requireSheet('Catalog'));
  const catalogItems = catalogRaw
    .filter((r) => {
      const code = trim(r['Item ID']);
      return code && CATALOG_CODE.test(code) && trim(r['Item Name']);
    })
    .map((r) => ({
      club_id: clubId,
      code: trim(r['Item ID'])!,
      name: trim(r['Item Name'])!,
      category: trim(r['Category']),
      unit: trim(r['Unit']) ?? 'each',
      par_level: r['Par Level'] != null ? Number(r['Par Level']) : null,
      current_stock: r['Current Stock'] != null ? Number(r['Current Stock']) : 0,
      cost_basis_cents: dollarsToCents(r['Cost Basis ($)']),
      vendor: trim(r['Vendor']),
      square_token: trim(r['Square Token']),
      reference_handle: trim(r['Reference Handle']),
      is_merch: false,
      notes: trim(r['Notes']),
    }));
  const { error: catalogErr } = await supabase
    .from('catalog_items')
    .upsert(catalogItems, { onConflict: 'club_id,code' });
  if (catalogErr) throw new Error(`catalog_items upsert: ${catalogErr.message}`);

  // --- Apparel & Merch ---
  type MerchRow = {
    'Item Name'?: string;
    'Variation/Size'?: string;
    SKU?: string;
    Category?: string;
    'Price ($)'?: number;
    'Current Stock'?: number;
    Notes?: string;
    'Square Token'?: string;
    'Reference Handle'?: string;
  };
  const merchRaw = XLSX.utils.sheet_to_json<MerchRow>(requireSheet('Apparel & Merch'));
  const merchItems = merchRaw
    .filter((r) => trim(r['Item Name']))
    .map((r, i) => {
      const variation = trim(r['Variation/Size']);
      const baseName = trim(r['Item Name'])!;
      const name =
        variation && variation !== 'Regular' ? `${baseName} (${variation})` : baseName;
      return {
        club_id: clubId,
        code: `MER-${String(i + 1).padStart(4, '0')}`,
        name,
        category: trim(r['Category']),
        unit: 'each',
        par_level: null,
        current_stock: r['Current Stock'] != null ? Number(r['Current Stock']) : 0,
        cost_basis_cents: null,
        vendor: null,
        square_token: trim(r['Square Token']),
        reference_handle: trim(r['Reference Handle']),
        is_merch: true,
        notes: trim(r['Notes']),
      };
    });
  const { error: merchErr } = await supabase
    .from('catalog_items')
    .upsert(merchItems, { onConflict: 'club_id,code' });
  if (merchErr) throw new Error(`merch upsert: ${merchErr.message}`);

  // --- Menu ---
  const { data: catalogList } = await supabase
    .from('catalog_items')
    .select('id, square_token')
    .eq('club_id', clubId)
    .not('square_token', 'is', null);
  const tokenToCatalogId = new Map<string, string>();
  for (const c of catalogList ?? []) {
    if (c.square_token && !tokenToCatalogId.has(c.square_token)) {
      tokenToCatalogId.set(c.square_token, c.id as string);
    }
  }

  type MenuRow = {
    'Square Token'?: string;
    'Reference Handle'?: string;
    'Square Item Name'?: string;
    Variation?: string;
    SKU?: string;
    Category?: string;
    'Price ($)'?: number;
    Notes?: string;
  };
  const menuRaw = XLSX.utils.sheet_to_json<MenuRow>(requireSheet('Menu'));
  const menuItems = menuRaw
    .filter((r) => trim(r['Square Item Name']))
    .map((r) => {
      const token = trim(r['Square Token']);
      return {
        club_id: clubId,
        catalog_item_id: token ? (tokenToCatalogId.get(token) ?? null) : null,
        square_item_name: trim(r['Square Item Name'])!,
        variation: trim(r['Variation']),
        category: trim(r['Category']),
        price_cents: dollarsToCents(r['Price ($)']),
        square_token: token,
        reference_handle: trim(r['Reference Handle']),
        sku: trim(r['SKU']),
        notes: trim(r['Notes']),
      };
    });
  const matched = menuItems.filter((m) => m.catalog_item_id).length;

  const { error: delErr } = await supabase.from('menu_items').delete().eq('club_id', clubId);
  if (delErr) throw new Error(`menu_items delete: ${delErr.message}`);
  const { error: menuErr } = await supabase.from('menu_items').insert(menuItems);
  if (menuErr) throw new Error(`menu_items insert: ${menuErr.message}`);

  // --- Settings ---
  type SettingRow = { Setting?: string; Value?: string | number };
  const settingsRaw = XLSX.utils.sheet_to_json<SettingRow>(requireSheet('Settings'), {
    range: 2,
  });
  const settingsMap = new Map<string, string>();
  for (const r of settingsRaw) {
    const key = trim(r['Setting']);
    const value = trim(r['Value']);
    if (key && value && !isPlaceholder(value)) {
      settingsMap.set(key, value);
    }
  }
  const updates: Record<string, string | number> = {};
  if (settingsMap.has('Google Drive folder'))
    updates.google_drive_folder = settingsMap.get('Google Drive folder')!;
  if (settingsMap.has('Theme — primary color'))
    updates.theme_primary = settingsMap.get('Theme — primary color')!;
  if (settingsMap.has('Theme — accent color'))
    updates.theme_accent = settingsMap.get('Theme — accent color')!;
  if (settingsMap.has('Theme — dark accent'))
    updates.theme_dark = settingsMap.get('Theme — dark accent')!;
  if (settingsMap.has('Default critical par buffer'))
    updates.critical_par_buffer = Number(settingsMap.get('Default critical par buffer'));
  if (settingsMap.has('Default low par buffer'))
    updates.low_par_buffer = Number(settingsMap.get('Default low par buffer'));
  if (settingsMap.has('Cost change flag threshold')) {
    const raw = settingsMap.get('Cost change flag threshold')!;
    updates.cost_change_threshold_pct = Number(raw.replace('%', '').trim());
  }
  if (Object.keys(updates).length > 0) {
    const { error: settingsErr } = await supabase
      .from('club_settings')
      .update(updates)
      .eq('club_id', clubId);
    if (settingsErr) throw new Error(`club_settings update: ${settingsErr.message}`);
  }

  // --- Base Stock (optional) ---
  let baseStockApplied = 0;
  let baseStockSkipped = 0;
  if (wb.Sheets['Base Stock']) {
    type BaseStockRow = {
      'Item ID'?: string;
      'Counted Quantity'?: number;
      'Counted At'?: string;
      Notes?: string;
    };
    const baseRows = XLSX.utils.sheet_to_json<BaseStockRow>(requireSheet('Base Stock'));
    const codeToCatalog = new Map<string, { id: string; current_stock: number }>();
    const { data: rows } = await supabase
      .from('catalog_items')
      .select('id, code, current_stock')
      .eq('club_id', clubId);
    for (const c of rows ?? []) {
      if (c.code) codeToCatalog.set(c.code, { id: c.id, current_stock: c.current_stock });
    }

    for (const row of baseRows) {
      const code = trim(row['Item ID']);
      const qtyRaw = row['Counted Quantity'];
      if (!code || qtyRaw == null || !Number.isFinite(Number(qtyRaw))) {
        baseStockSkipped += 1;
        continue;
      }
      const target = codeToCatalog.get(code);
      if (!target) {
        baseStockSkipped += 1;
        continue;
      }
      const counted = Math.round(Number(qtyRaw));
      const delta = counted - target.current_stock;
      if (delta === 0) {
        baseStockApplied += 1;
        continue;
      }
      const { error: moveErr } = await supabase.from('stock_movements').insert({
        catalog_item_id: target.id,
        delta,
        source_type: 'reconcile',
        notes: `Base stock count: ${counted}${row.Notes ? ` (${row.Notes})` : ''}`,
        occurred_at: row['Counted At']
          ? new Date(row['Counted At']).toISOString()
          : new Date().toISOString(),
      });
      if (moveErr) {
        baseStockSkipped += 1;
        continue;
      }
      await supabase
        .from('catalog_items')
        .update({ current_stock: counted })
        .eq('id', target.id);
      baseStockApplied += 1;
    }
  }

  return {
    catalog_concessions: catalogItems.length,
    catalog_merch: merchItems.length,
    menu_items: menuItems.length,
    menu_items_matched: matched,
    base_stock_applied: baseStockApplied,
    base_stock_skipped: baseStockSkipped,
    settings_fields_updated: Object.keys(updates).length,
  };
}
