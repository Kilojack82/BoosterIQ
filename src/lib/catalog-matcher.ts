import { createAdminClient } from '@/utils/supabase/admin';
import type { ReceiptLineItem } from './receipt-parser';

export type MatchedLineItem = ReceiptLineItem & {
  catalog_match: {
    id: string;
    code: string;
    name: string;
  } | null;
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['"`,.()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Match each receipt line item to a catalog row by exact normalized name.
 * V1 step 4 first pass: exact match only. Fuzzy match deferred to a follow-up.
 */
export async function matchLineItemsToCatalog(
  clubId: string,
  lineItems: ReceiptLineItem[],
): Promise<MatchedLineItem[]> {
  const supabase = createAdminClient();
  const { data: catalog, error } = await supabase
    .from('catalog_items')
    .select('id, code, name')
    .eq('club_id', clubId)
    .eq('is_merch', false);
  if (error) throw new Error(`catalog lookup: ${error.message}`);

  const byNormalized = new Map<string, { id: string; code: string; name: string }>();
  for (const c of catalog ?? []) {
    const key = normalize(c.name);
    if (!byNormalized.has(key)) byNormalized.set(key, c);
  }

  return lineItems.map((li) => ({
    ...li,
    catalog_match: byNormalized.get(normalize(li.description)) ?? null,
  }));
}
