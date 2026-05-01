/**
 * Seed BoosterIQ from the master inventory xlsx.
 *
 * Per DECISIONS.md D12 (direct parse) and D13 (one-shot script).
 * Idempotent: catalog_items upsert by (club_id, code); menu_items rebuild.
 *
 * Run via: pnpm seed:master-sheet
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { createAdminClient } from '../src/utils/supabase/admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(
  __dirname,
  '../fixtures/private/BoosterIQ_Master_LagoVistaVikings_v1_2026-04-30.xlsx',
);

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

type MenuRow = {
  'Square Token'?: string;
  'Reference Handle'?: string;
  'Square Item Name'?: string;
  Variation?: string;
  SKU?: string;
  Category?: string;
  'Price ($)'?: number;
  'Catalog Item ID'?: string;
  Notes?: string;
};

type SettingRow = { Setting?: string; Value?: string | number };

const dollarsToCents = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
};

const trim = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
};

const isPlaceholder = (v: string | null): boolean => {
  if (!v) return true;
  return v.startsWith('(') && v.endsWith(')');
};

async function main() {
  const supabase = createAdminClient();

  // --- Resolve club_id ----------------------------------------------------
  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .select('id')
    .eq('shortname', 'LakeVistaVikings')
    .single();
  if (clubErr || !club) throw new Error(`Vikings club not found: ${clubErr?.message}`);
  const clubId = club.id as string;

  // --- Read xlsx ----------------------------------------------------------
  const wb = XLSX.readFile(FIXTURE);
  console.log(`Reading: ${FIXTURE}`);
  console.log(`Sheets: ${wb.SheetNames.join(', ')}`);

  const requireSheet = (name: string) => {
    const sheet = wb.Sheets[name];
    if (!sheet) throw new Error(`Sheet "${name}" not found in workbook`);
    return sheet;
  };

  // --- Catalog tab → catalog_items (concessions, is_merch=false) ----------
  const catalogRaw = XLSX.utils.sheet_to_json<CatalogRow>(requireSheet('Catalog'));
  // Reject summary/footer rows like "Catalog total: 130" — codes must
  // match the CAT-NNNN format the master sheet uses for real items.
  const CATALOG_CODE = /^CAT-\d{4}$/;
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

  console.log(`Catalog rows: ${catalogItems.length}`);
  const { error: catalogErr } = await supabase
    .from('catalog_items')
    .upsert(catalogItems, { onConflict: 'club_id,code' });
  if (catalogErr) throw new Error(`catalog_items upsert: ${catalogErr.message}`);

  // --- Apparel & Merch tab → catalog_items (is_merch=true) ----------------
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

  console.log(`Merch rows: ${merchItems.length}`);
  const { error: merchErr } = await supabase
    .from('catalog_items')
    .upsert(merchItems, { onConflict: 'club_id,code' });
  if (merchErr) throw new Error(`merch upsert: ${merchErr.message}`);

  // --- Menu tab → menu_items (rebuild, resolve catalog_item_id by token) --
  const { data: catalogList, error: lookupErr } = await supabase
    .from('catalog_items')
    .select('id, square_token')
    .eq('club_id', clubId)
    .not('square_token', 'is', null);
  if (lookupErr) throw new Error(`catalog lookup: ${lookupErr.message}`);

  const tokenToCatalogId = new Map<string, string>();
  for (const c of catalogList ?? []) {
    if (c.square_token && !tokenToCatalogId.has(c.square_token)) {
      tokenToCatalogId.set(c.square_token, c.id as string);
    }
  }

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

  console.log(`Menu rows: ${menuItems.length}`);
  const matched = menuItems.filter((m) => m.catalog_item_id).length;
  console.log(`  matched to catalog: ${matched} / ${menuItems.length}`);

  // Full rebuild: delete existing menu_items for this club, then insert
  const { error: delErr } = await supabase.from('menu_items').delete().eq('club_id', clubId);
  if (delErr) throw new Error(`menu_items delete: ${delErr.message}`);
  const { error: menuErr } = await supabase.from('menu_items').insert(menuItems);
  if (menuErr) throw new Error(`menu_items insert: ${menuErr.message}`);

  // --- Base Stock tab → reconcile catalog_items.current_stock -------------
  // Optional tab. The chair counts physical inventory before each game and
  // fills this tab. We reset current_stock to the counted value and write a
  // reconcile stock_movement for the audit trail. Items not in this tab
  // are NOT considered "actively managed" — the dashboard shopping list
  // filters to items that have at least one reconcile movement.
  type BaseStockRow = {
    'Item ID'?: string;
    'Counted Quantity'?: number;
    'Counted At'?: string;
    Notes?: string;
  };
  let baseStockApplied = 0;
  if (wb.Sheets['Base Stock']) {
    const baseStockRaw = XLSX.utils.sheet_to_json<BaseStockRow>(
      requireSheet('Base Stock'),
    );
    const codeToId = new Map<string, { id: string; current_stock: number }>();
    const { data: catalogList } = await supabase
      .from('catalog_items')
      .select('id, code, current_stock')
      .eq('club_id', clubId);
    for (const c of catalogList ?? []) {
      if (c.code) codeToId.set(c.code, { id: c.id, current_stock: c.current_stock });
    }

    for (const row of baseStockRaw) {
      const code = trim(row['Item ID']);
      const qty = row['Counted Quantity'];
      if (!code || qty == null || !Number.isFinite(Number(qty))) continue;
      const target = codeToId.get(code);
      if (!target) {
        console.warn(`Base Stock: code ${code} not found in catalog, skipping`);
        continue;
      }
      const counted = Math.round(Number(qty));
      const delta = counted - target.current_stock;
      if (delta === 0) continue;

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
        console.error(`Base Stock movement failed for ${code}:`, moveErr.message);
        continue;
      }
      const { error: stockErr } = await supabase
        .from('catalog_items')
        .update({ current_stock: counted })
        .eq('id', target.id);
      if (stockErr) {
        console.error(`Base Stock update failed for ${code}:`, stockErr.message);
        continue;
      }
      baseStockApplied += 1;
    }
    console.log(`Base Stock rows applied: ${baseStockApplied}`);
  }

  // --- Settings tab → club_settings update --------------------------------
  // Settings tab has 2 preamble rows before the "Setting / Value / Notes" header.
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
  if (settingsMap.has('Google Drive folder')) {
    updates.google_drive_folder = settingsMap.get('Google Drive folder')!;
  }
  if (settingsMap.has('Theme — primary color')) {
    updates.theme_primary = settingsMap.get('Theme — primary color')!;
  }
  if (settingsMap.has('Theme — accent color')) {
    updates.theme_accent = settingsMap.get('Theme — accent color')!;
  }
  if (settingsMap.has('Theme — dark accent')) {
    updates.theme_dark = settingsMap.get('Theme — dark accent')!;
  }
  if (settingsMap.has('Default critical par buffer')) {
    updates.critical_par_buffer = Number(settingsMap.get('Default critical par buffer'));
  }
  if (settingsMap.has('Default low par buffer')) {
    updates.low_par_buffer = Number(settingsMap.get('Default low par buffer'));
  }
  if (settingsMap.has('Cost change flag threshold')) {
    const raw = settingsMap.get('Cost change flag threshold')!;
    updates.cost_change_threshold_pct = Number(raw.replace('%', '').trim());
  }

  console.log(`Settings updates: ${Object.keys(updates).length} fields`);
  if (Object.keys(updates).length > 0) {
    const { error: settingsErr } = await supabase
      .from('club_settings')
      .update(updates)
      .eq('club_id', clubId);
    if (settingsErr) throw new Error(`club_settings update: ${settingsErr.message}`);
  }

  // --- Summary ------------------------------------------------------------
  console.log('\n--- Seed complete ---');
  console.log(`  catalog_items (concessions): ${catalogItems.length}`);
  console.log(`  catalog_items (merch):       ${merchItems.length}`);
  console.log(`  menu_items:                  ${menuItems.length}`);
  console.log(`  menu_items linked to catalog: ${matched}`);
  console.log(`  club_settings fields updated: ${Object.keys(updates).length}`);
  console.log(`  base_stock counts applied:   ${baseStockApplied}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
