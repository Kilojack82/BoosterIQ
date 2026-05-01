import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';

/**
 * Erase every receipt for the club:
 *   - Reverse the stock_movements those receipts contributed (subtract the
 *     positive delta from current_stock)
 *   - Delete those stock_movements
 *   - Delete the receipts rows themselves
 *
 * Square sale movements and reconcile (master-inventory) movements are
 * untouched — only source_type='receipt' rows are affected.
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

    const { data: receipts } = await supabase
      .from('receipts')
      .select('id')
      .eq('club_id', club.id);
    const receiptIds = (receipts ?? []).map((r) => r.id as string);

    if (receiptIds.length === 0) {
      return NextResponse.json({
        receipts_removed: 0,
        stock_movements_removed: 0,
        catalog_items_restored: 0,
      });
    }

    const { data: moves } = await supabase
      .from('stock_movements')
      .select('catalog_item_id, delta')
      .eq('source_type', 'receipt')
      .in('source_id', receiptIds);

    const deltaByItem = new Map<string, number>();
    for (const m of moves ?? []) {
      deltaByItem.set(
        m.catalog_item_id as string,
        (deltaByItem.get(m.catalog_item_id as string) ?? 0) + (m.delta as number),
      );
    }

    let stockReversed = 0;
    for (const [itemId, totalDelta] of deltaByItem) {
      const { data: cur } = await supabase
        .from('catalog_items')
        .select('current_stock')
        .eq('id', itemId)
        .single();
      if (!cur) continue;
      await supabase
        .from('catalog_items')
        .update({ current_stock: cur.current_stock - totalDelta })
        .eq('id', itemId);
      stockReversed += 1;
    }

    await supabase
      .from('stock_movements')
      .delete()
      .eq('source_type', 'receipt')
      .in('source_id', receiptIds);

    await supabase.from('receipts').delete().in('id', receiptIds);

    revalidatePath('/');
    revalidatePath('/receipts/upload');

    return NextResponse.json({
      receipts_removed: receiptIds.length,
      stock_movements_removed: moves?.length ?? 0,
      catalog_items_restored: stockReversed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
