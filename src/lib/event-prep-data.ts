import { createAdminClient } from '@/utils/supabase/admin';

export type GamePrepRow = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  current_stock: number;
  last_game_sold: number;
  recommended_buy: number;
  receipts_since_last_game: number;
};

export type EventPrep = {
  event: {
    id: string;
    name: string;
    opponent: string | null;
    is_home: boolean | null;
    date: string;
    signupgenius_url: string | null;
  };
  is_future: boolean;
  prev_event: {
    id: string;
    name: string;
    date: string;
  } | null;
  rows: GamePrepRow[];
  receipts_since_prev: {
    count: number;
    total_cents: number;
  };
};

/**
 * For a given event, calculate what the chair should buy / restock.
 * Logic per row (concession items only, base-stock-tracked):
 *   - last_game_sold = qty sold in the most recent prior Square import
 *   - receipts_since_last_game = qty added via receipts since that import
 *   - current_stock = whatever is in catalog now (already reflects receipts)
 *   - recommended_buy = max(0, ceil(last_game_sold * 1.5) - current_stock)
 *
 * If receipts brought stock above the target, recommended_buy = 0.
 * If no prior Square import exists yet, rows array is empty.
 */
export async function getEventPrep(eventId: string): Promise<EventPrep | null> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, name, opponent, is_home, date, signupgenius_url, club_id')
    .eq('id', eventId)
    .single();
  if (!event) return null;

  const today = new Date().toISOString().slice(0, 10);
  const isFuture = event.date >= today;
  const clubId = event.club_id as string;

  // Find the most recent Square import strictly before this event (or before
  // today if event is future).
  const { data: prevImport } = await supabase
    .from('square_imports')
    .select('id, processed_at, event_id')
    .eq('club_id', clubId)
    .lt('processed_at', new Date(`${event.date}T23:59:59`).toISOString())
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let prevEvent: EventPrep['prev_event'] = null;
  if (prevImport?.event_id) {
    const { data: prev } = await supabase
      .from('events')
      .select('id, name, date')
      .eq('id', prevImport.event_id)
      .maybeSingle();
    if (prev) prevEvent = prev;
  }

  // Receipts written since the previous Square import (or all receipts if
  // there's no prior import yet)
  const sinceTimestamp = prevImport?.processed_at as string | undefined;
  let receiptsCount = 0;
  let receiptsTotal = 0;
  if (sinceTimestamp) {
    const { data: r } = await supabase
      .from('receipts')
      .select('id, total_cents')
      .eq('club_id', clubId)
      .gt('processed_at', sinceTimestamp);
    receiptsCount = r?.length ?? 0;
    receiptsTotal = (r ?? []).reduce((a, x) => a + (x.total_cents ?? 0), 0);
  }

  const rows: GamePrepRow[] = [];
  if (prevImport) {
    type MovementRow = {
      catalog_item_id: string;
      delta: number;
      catalog_items: {
        id: string;
        code: string;
        name: string;
        category: string | null;
        current_stock: number;
        is_merch: boolean;
      } | null;
    };
    // Sales from prev import
    const { data: salesMoves } = await supabase
      .from('stock_movements')
      .select(
        'catalog_item_id, delta, catalog_items(id, code, name, category, current_stock, is_merch)',
      )
      .eq('source_type', 'sale')
      .eq('source_id', prevImport.id)
      .returns<MovementRow[]>();

    // Items the chair counts (have at least one reconcile movement)
    const { data: reconciled } = await supabase
      .from('stock_movements')
      .select('catalog_item_id')
      .eq('source_type', 'reconcile');
    const tracked = new Set(
      (reconciled ?? []).map((r) => r.catalog_item_id as string),
    );

    // Receipts since prev import — qty per catalog_item
    const receiptDeltaByItem = new Map<string, number>();
    if (sinceTimestamp) {
      type ReceiptMovement = {
        catalog_item_id: string;
        delta: number;
      };
      const { data: receiptMoves } = await supabase
        .from('stock_movements')
        .select('catalog_item_id, delta')
        .eq('source_type', 'receipt')
        .gt('occurred_at', sinceTimestamp)
        .returns<ReceiptMovement[]>();
      for (const m of receiptMoves ?? []) {
        receiptDeltaByItem.set(
          m.catalog_item_id,
          (receiptDeltaByItem.get(m.catalog_item_id) ?? 0) + m.delta,
        );
      }
    }

    type Agg = { sold: number; item: NonNullable<MovementRow['catalog_items']> };
    const byCatalog = new Map<string, Agg>();
    for (const m of salesMoves ?? []) {
      if (!m.catalog_items || m.catalog_items.is_merch) continue;
      if (!tracked.has(m.catalog_item_id)) continue;
      const existing = byCatalog.get(m.catalog_item_id) ?? {
        sold: 0,
        item: m.catalog_items,
      };
      existing.sold += Math.abs(m.delta);
      byCatalog.set(m.catalog_item_id, existing);
    }

    for (const agg of byCatalog.values()) {
      if (agg.sold <= 0) continue;
      const target = Math.ceil(agg.sold * 1.5);
      const buy = Math.max(0, target - agg.item.current_stock);
      rows.push({
        id: agg.item.id,
        code: agg.item.code,
        name: agg.item.name,
        category: agg.item.category,
        current_stock: agg.item.current_stock,
        last_game_sold: agg.sold,
        recommended_buy: buy,
        receipts_since_last_game: receiptDeltaByItem.get(agg.item.id) ?? 0,
      });
    }
    rows.sort((a, b) => b.recommended_buy - a.recommended_buy || b.last_game_sold - a.last_game_sold);
  }

  return {
    event: {
      id: event.id as string,
      name: event.name,
      opponent: event.opponent,
      is_home: event.is_home,
      date: event.date,
      signupgenius_url: event.signupgenius_url,
    },
    is_future: isFuture,
    prev_event: prevEvent,
    rows,
    receipts_since_prev: {
      count: receiptsCount,
      total_cents: receiptsTotal,
    },
  };
}
