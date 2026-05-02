import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';

/**
 * Clear everything that the master inventory upload contributed:
 *  - All reconcile stock_movements (the base stock counts)
 *  - Reset every concession catalog_item.current_stock to 0
 *
 * After clearing:
 *  - Items revert to "untracked" (no reconcile movement) → Shopping List
 *    becomes empty until master inventory is uploaded again
 *  - Square sales movements stay (those were event-scoped, separate concern)
 *  - Receipts stay (those are club-scoped, separate concern)
 *
 * The catalog rows themselves stay so that Square sales can still match
 * to existing items by name/square_token. Re-upload the master inventory
 * xlsx to set base stock again.
 */
export async function POST() {
  try {
    const supabase = createAdminClient();
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('shortname', 'LakeVistaVikings')
      .single();
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 500 });
    }

    const { data: reconciles } = await supabase
      .from('stock_movements')
      .select('id')
      .eq('source_type', 'reconcile');
    const reconcileCount = reconciles?.length ?? 0;

    const { error: delErr } = await supabase
      .from('stock_movements')
      .delete()
      .eq('source_type', 'reconcile');
    if (delErr) {
      return NextResponse.json(
        { error: `delete reconcile: ${delErr.message}` },
        { status: 500 },
      );
    }

    const { data: itemsBefore } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('club_id', club.id)
      .eq('is_merch', false);
    // Reset both the live stock cache AND par_level so the shopping list's
    // "is tracked" filter (par_level IS NOT NULL) treats every concession
    // item as fresh-untracked until the next master inventory upload.
    const { error: stockErr } = await supabase
      .from('catalog_items')
      .update({ current_stock: 0, par_level: null })
      .eq('club_id', club.id)
      .eq('is_merch', false);
    if (stockErr) {
      return NextResponse.json(
        { error: `current_stock reset: ${stockErr.message}` },
        { status: 500 },
      );
    }

    revalidatePath('/');
    revalidatePath('/inventory');

    return NextResponse.json({
      reconcile_movements_deleted: reconcileCount,
      catalog_items_reset: itemsBefore?.length ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
