import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';

/**
 * Reset all uploaded data for one event without deleting the event row:
 *   - Reverse the depletion from any Square imports linked to this event
 *     (sum the negative sale deltas, add them back to current_stock)
 *   - Delete the stock_movements rows from those imports
 *   - Delete the square_imports rows themselves
 *   - Delete the volunteer_slots rows for this event
 *
 * Receipts are untouched — they aren't event-scoped in the schema.
 */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const supabase = createAdminClient();

    const { data: event } = await supabase
      .from('events')
      .select('id, name, club_id')
      .eq('id', id)
      .single();
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 1. Find all Square imports linked to this event
    const { data: imports } = await supabase
      .from('square_imports')
      .select('id')
      .eq('event_id', id);
    const importIds = (imports ?? []).map((i) => i.id as string);

    let movementsRemoved = 0;
    let stockReversed = 0;

    if (importIds.length > 0) {
      // 2. Sum the deltas per catalog_item across all those imports' sales
      const { data: moves } = await supabase
        .from('stock_movements')
        .select('catalog_item_id, delta')
        .eq('source_type', 'sale')
        .in('source_id', importIds);

      const deltaByItem = new Map<string, number>();
      for (const m of moves ?? []) {
        deltaByItem.set(
          m.catalog_item_id as string,
          (deltaByItem.get(m.catalog_item_id as string) ?? 0) + (m.delta as number),
        );
      }
      movementsRemoved = moves?.length ?? 0;

      // 3. For each affected item, current_stock -= delta (delta is negative for
      //    sales, so subtracting it adds the qty back).
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

      // 4. Delete the stock_movements
      await supabase
        .from('stock_movements')
        .delete()
        .eq('source_type', 'sale')
        .in('source_id', importIds);

      // 5. Delete the square_imports rows
      await supabase.from('square_imports').delete().eq('event_id', id);
    }

    // 6. Volunteer roster
    const { data: slotsBefore } = await supabase
      .from('volunteer_slots')
      .select('id')
      .eq('event_id', id);
    const slotsRemoved = slotsBefore?.length ?? 0;
    await supabase.from('volunteer_slots').delete().eq('event_id', id);

    revalidatePath('/');
    revalidatePath('/events');
    revalidatePath(`/events/${id}`);

    return NextResponse.json({
      square_imports_removed: importIds.length,
      stock_movements_removed: movementsRemoved,
      catalog_items_restored: stockReversed,
      volunteer_slots_removed: slotsRemoved,
    });
  } catch (err) {
    console.error('Event reset failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
