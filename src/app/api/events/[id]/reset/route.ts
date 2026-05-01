import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';

const RECEIPT_WINDOW_DAYS = 7;

/**
 * Reset all uploaded data for one event without deleting the event row:
 *   - Reverse the depletion from any Square imports linked to this event
 *   - Delete the stock_movements + square_imports rows from those imports
 *   - Delete the volunteer_slots rows for this event
 *   - Reverse + delete any receipts (and their stock_movements) dated within
 *     RECEIPT_WINDOW_DAYS before the event_date — receipts aren't formally
 *     event-scoped in the schema, so we use date proximity as the heuristic.
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
      .select('id, name, club_id, date')
      .eq('id', id)
      .single();
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: imports } = await supabase
      .from('square_imports')
      .select('id')
      .eq('event_id', id);
    const importIds = (imports ?? []).map((i) => i.id as string);

    let salesMovementsRemoved = 0;
    let stockReversed = 0;

    if (importIds.length > 0) {
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
      salesMovementsRemoved = moves?.length ?? 0;

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
        .eq('source_type', 'sale')
        .in('source_id', importIds);

      await supabase.from('square_imports').delete().eq('event_id', id);
    }

    // Receipts: anything in [event_date - 7d, event_date]
    const eventDate = new Date(event.date as string);
    const windowStart = new Date(eventDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - RECEIPT_WINDOW_DAYS);
    const windowStartIso = windowStart.toISOString().slice(0, 10);
    const windowEndIso = eventDate.toISOString().slice(0, 10);

    const { data: receiptsInWindow } = await supabase
      .from('receipts')
      .select('id')
      .eq('club_id', event.club_id)
      .gte('receipt_date', windowStartIso)
      .lte('receipt_date', windowEndIso);
    const receiptIds = (receiptsInWindow ?? []).map((r) => r.id as string);

    let receiptMovementsRemoved = 0;
    if (receiptIds.length > 0) {
      const { data: rMoves } = await supabase
        .from('stock_movements')
        .select('catalog_item_id, delta')
        .eq('source_type', 'receipt')
        .in('source_id', receiptIds);

      const rDeltaByItem = new Map<string, number>();
      for (const m of rMoves ?? []) {
        rDeltaByItem.set(
          m.catalog_item_id as string,
          (rDeltaByItem.get(m.catalog_item_id as string) ?? 0) + (m.delta as number),
        );
      }
      receiptMovementsRemoved = rMoves?.length ?? 0;

      for (const [itemId, totalDelta] of rDeltaByItem) {
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
      }

      await supabase
        .from('stock_movements')
        .delete()
        .eq('source_type', 'receipt')
        .in('source_id', receiptIds);

      await supabase.from('receipts').delete().in('id', receiptIds);
    }

    const { data: slotsBefore } = await supabase
      .from('volunteer_slots')
      .select('id')
      .eq('event_id', id);
    const slotsRemoved = slotsBefore?.length ?? 0;
    await supabase.from('volunteer_slots').delete().eq('event_id', id);

    revalidatePath('/');
    revalidatePath('/events');
    revalidatePath(`/events/${id}`);
    revalidatePath('/inventory');

    return NextResponse.json({
      square_imports_removed: importIds.length,
      stock_movements_removed: salesMovementsRemoved + receiptMovementsRemoved,
      catalog_items_restored: stockReversed,
      volunteer_slots_removed: slotsRemoved,
      receipts_removed: receiptIds.length,
    });
  } catch (err) {
    console.error('Event reset failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
