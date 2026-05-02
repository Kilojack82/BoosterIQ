import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';

const RECEIPT_WINDOW_DAYS = 7;

/**
 * Hard-delete an event and everything that hangs off it:
 *   - Reverse and delete this event's Square sale stock_movements + the
 *     square_imports rows themselves (stock comes back).
 *   - Reverse and delete receipts dated within RECEIPT_WINDOW_DAYS of the
 *     event_date (same heuristic as POST /reset).
 *   - Delete volunteer_slots.
 *   - Delete the event row itself.
 *
 * Master inventory (par_level / current_stock from reconcile movements)
 * is untouched.
 */
export async function DELETE(
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

    // 1. Reverse + delete Square sale stock movements
    const { data: imports } = await supabase
      .from('square_imports')
      .select('id')
      .eq('event_id', id);
    const importIds = (imports ?? []).map((i) => i.id as string);

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
      }
      await supabase
        .from('stock_movements')
        .delete()
        .eq('source_type', 'sale')
        .in('source_id', importIds);
      await supabase.from('square_imports').delete().eq('event_id', id);
    }

    // 2. Receipts in the [event_date - 7d, event_date] window
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

    // 3. Volunteer slots (ON DELETE CASCADE would also handle this but be
    //    explicit so the response can report the count).
    const { data: slotsBefore } = await supabase
      .from('volunteer_slots')
      .select('id')
      .eq('event_id', id);
    const slotsRemoved = slotsBefore?.length ?? 0;
    await supabase.from('volunteer_slots').delete().eq('event_id', id);

    // 4. The event row itself
    const { error: delEventErr } = await supabase
      .from('events')
      .delete()
      .eq('id', id);
    if (delEventErr) {
      return NextResponse.json(
        { error: `delete event: ${delEventErr.message}` },
        { status: 500 },
      );
    }

    revalidatePath('/');
    revalidatePath('/events');

    return NextResponse.json({
      event_deleted: true,
      square_imports_removed: importIds.length,
      receipts_removed: receiptIds.length,
      volunteer_slots_removed: slotsRemoved,
    });
  } catch (err) {
    console.error('Event delete failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
