import { createAdminClient } from '@/utils/supabase/admin';
import type { ParsedSquareRow } from './square-csv-parser';

export type MatchedSquareRow = ParsedSquareRow & {
  menu_match: { id: string; square_item_name: string; variation: string | null } | null;
  catalog_match: { id: string; code: string; name: string } | null;
  match_strategy: 'sku' | 'name+variation' | 'none';
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['"`,.()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Match each parsed Square row to a menu_items row, then resolve the
 * catalog_item_id (which may be null for recipe-only menu items like
 * "Hot Dog" that don't deplete a single inventory unit in V1).
 *
 * Match priority per DECISIONS.md D11:
 *   1. SKU (most stable when present)
 *   2. Item Name + Variation (Price Point Name)
 *
 * Square Token isn't in the CSV export, so it isn't part of this path.
 */
export async function matchSquareRowsToCatalog(
  clubId: string,
  rows: ParsedSquareRow[],
): Promise<MatchedSquareRow[]> {
  const supabase = createAdminClient();
  const { data: menus, error } = await supabase
    .from('menu_items')
    .select('id, square_item_name, variation, sku, catalog_item_id, catalog_items(id, code, name)')
    .eq('club_id', clubId);
  if (error) throw new Error(`menu lookup: ${error.message}`);

  type MenuRow = NonNullable<typeof menus>[number];
  const bySku = new Map<string, MenuRow>();
  const byNameVariation = new Map<string, MenuRow>();
  for (const m of menus ?? []) {
    if (m.sku) {
      const key = m.sku.trim().toLowerCase();
      if (key && !bySku.has(key)) bySku.set(key, m);
    }
    const key = `${norm(m.square_item_name)}||${m.variation ? norm(m.variation) : ''}`;
    if (!byNameVariation.has(key)) byNameVariation.set(key, m);
  }

  const matched: MatchedSquareRow[] = rows.map((r) => {
    let menu: MenuRow | undefined;
    let strategy: MatchedSquareRow['match_strategy'] = 'none';

    if (r.sku) {
      menu = bySku.get(r.sku.trim().toLowerCase());
      if (menu) strategy = 'sku';
    }
    if (!menu) {
      const key = `${norm(r.item)}||${r.variation ? norm(r.variation) : ''}`;
      menu = byNameVariation.get(key);
      if (menu) strategy = 'name+variation';
    }

    if (!menu) {
      return { ...r, menu_match: null, catalog_match: null, match_strategy: 'none' };
    }

    const catalog = Array.isArray(menu.catalog_items)
      ? menu.catalog_items[0]
      : menu.catalog_items;

    return {
      ...r,
      menu_match: {
        id: menu.id as string,
        square_item_name: menu.square_item_name,
        variation: menu.variation,
      },
      catalog_match: catalog
        ? { id: catalog.id, code: catalog.code, name: catalog.name }
        : null,
      match_strategy: strategy,
    };
  });

  return matched;
}
