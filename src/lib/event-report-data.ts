import { createAdminClient } from '@/utils/supabase/admin';

export type EventReportData = {
  event: {
    id: string;
    name: string;
    opponent: string | null;
    is_home: boolean | null;
    date: string;
    attendance_actual: number | null;
    attendance_predicted: number | null;
    weather: string | null;
  };
  sales: {
    total_qty: number;
    total_net_sales_cents: number;
    total_gross_sales_cents: number;
    date_range: { start: string | null; end: string | null };
    processed_at: string | null;
    summary: {
      cash_cents: number | null;
      card_cents: number | null;
      cashapp_cents: number | null;
      other_cents: number | null;
      giftcard_cents: number | null;
      fees_cents: number | null;
      net_total_cents: number | null;
    } | null;
  } | null;
  items_sold: Array<{
    id: string;
    code: string;
    name: string;
    category: string | null;
    sold_qty: number;
    net_sales_cents: number;
  }>;
  volunteers: {
    total: number;
    filled: number;
    open: number;
    by_role: Array<{ role: string; total: number; filled: number; open: number; names: string[] }>;
    last_synced_at: string | null;
  };
  receipts: Array<{
    id: string;
    vendor: string | null;
    receipt_date: string | null;
    total_cents: number | null;
    processed_at: string | null;
  }>;
  receipts_total_cents: number;
  inventory: {
    items_below_par: Array<{ code: string; name: string; current_stock: number; par_level: number }>;
    items_critical: number;
    items_low: number;
  };
  generated_at: string;
};

export async function getEventReportData(eventId: string): Promise<EventReportData | null> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, name, opponent, is_home, date, attendance_actual, attendance_predicted, weather, club_id')
    .eq('id', eventId)
    .single();
  if (!event) return null;

  const clubId = event.club_id as string;

  // Sales: prefer the import linked to this event; otherwise fall back to
  // the most recent import whose date_range covers this event's date.
  const { data: linkedImport } = await supabase
    .from('square_imports')
    .select('id, parsed_data_json, processed_at')
    .eq('event_id', eventId)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let sales: EventReportData['sales'] = null;
  const itemsSold: EventReportData['items_sold'] = [];
  if (linkedImport?.parsed_data_json) {
    const j = linkedImport.parsed_data_json as Record<string, unknown>;
    const summary = (j.summary as EventReportData['sales'] extends infer T
      ? T extends { summary: infer S }
        ? S
        : null
      : null) ?? null;
    sales = {
      total_qty: Number(j.total_qty ?? 0),
      total_net_sales_cents: Number(j.total_net_sales_cents ?? 0),
      total_gross_sales_cents: Number(j.total_gross_sales_cents ?? 0),
      date_range:
        (j.date_range as NonNullable<EventReportData['sales']>['date_range']) ?? {
          start: null,
          end: null,
        },
      processed_at: linkedImport.processed_at as string | null,
      summary: summary as NonNullable<EventReportData['sales']>['summary'],
    };

    // Per-item breakdown: aggregate sale stock_movements for this import
    // and join to catalog_items + menu_items prices for revenue estimate.
    type MovementRow = {
      catalog_item_id: string;
      delta: number;
      catalog_items: {
        id: string;
        code: string;
        name: string;
        category: string | null;
        is_merch: boolean;
      } | null;
    };
    const { data: movements } = await supabase
      .from('stock_movements')
      .select(
        'catalog_item_id, delta, catalog_items(id, code, name, category, is_merch)',
      )
      .eq('source_type', 'sale')
      .eq('source_id', linkedImport.id)
      .returns<MovementRow[]>();

    type Agg = { sold: number; item: NonNullable<MovementRow['catalog_items']> };
    const byItem = new Map<string, Agg>();
    for (const m of movements ?? []) {
      if (!m.catalog_items || m.catalog_items.is_merch) continue;
      const existing = byItem.get(m.catalog_item_id) ?? {
        sold: 0,
        item: m.catalog_items,
      };
      existing.sold += Math.abs(m.delta);
      byItem.set(m.catalog_item_id, existing);
    }

    const itemIds = Array.from(byItem.keys());
    const priceByItem = new Map<string, number>();
    if (itemIds.length > 0) {
      const { data: menus } = await supabase
        .from('menu_items')
        .select('catalog_item_id, price_cents')
        .in('catalog_item_id', itemIds);
      for (const mn of menus ?? []) {
        if (mn.catalog_item_id && mn.price_cents != null) {
          if (!priceByItem.has(mn.catalog_item_id as string)) {
            priceByItem.set(mn.catalog_item_id as string, mn.price_cents as number);
          }
        }
      }
    }

    for (const agg of byItem.values()) {
      if (agg.sold <= 0) continue;
      const price = priceByItem.get(agg.item.id) ?? 0;
      itemsSold.push({
        id: agg.item.id,
        code: agg.item.code,
        name: agg.item.name,
        category: agg.item.category,
        sold_qty: agg.sold,
        net_sales_cents: price * agg.sold,
      });
    }
    itemsSold.sort(
      (a, b) =>
        b.sold_qty - a.sold_qty ||
        b.net_sales_cents - a.net_sales_cents ||
        a.name.localeCompare(b.name),
    );
  }

  // Volunteers
  const { data: slots } = await supabase
    .from('volunteer_slots')
    .select('role, slot_position, filled_by_name, scraped_at')
    .eq('event_id', eventId)
    .order('role')
    .order('slot_position');

  type RoleAgg = { total: number; filled: number; names: string[] };
  const byRole = new Map<string, RoleAgg>();
  let lastSync: string | null = null;
  let totalSlots = 0;
  let filledSlots = 0;
  for (const s of slots ?? []) {
    const agg = byRole.get(s.role) ?? { total: 0, filled: 0, names: [] };
    agg.total += 1;
    if (s.filled_by_name) {
      agg.filled += 1;
      agg.names.push(s.filled_by_name);
    }
    byRole.set(s.role, agg);
    totalSlots += 1;
    if (s.filled_by_name) filledSlots += 1;
    if (!lastSync || (s.scraped_at && s.scraped_at > lastSync)) {
      lastSync = s.scraped_at as string;
    }
  }

  // Receipts: this week's supply runs (looking 7 days back from event date)
  const eventDate = event.date as string;
  const weekStart = new Date(eventDate);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const { data: receipts } = await supabase
    .from('receipts')
    .select('id, vendor, receipt_date, total_cents, processed_at')
    .eq('club_id', clubId)
    .gte('receipt_date', weekStartIso)
    .lte('receipt_date', eventDate)
    .order('receipt_date', { ascending: true });

  const receiptsTotal = (receipts ?? []).reduce(
    (a, r) => a + (r.total_cents ?? 0),
    0,
  );

  // Inventory below par (concessions only — merch isn't a reorder concern)
  const { data: catalog } = await supabase
    .from('catalog_items')
    .select('code, name, current_stock, par_level')
    .eq('club_id', clubId)
    .eq('is_merch', false)
    .not('par_level', 'is', null);

  const { data: settings } = await supabase
    .from('club_settings')
    .select('critical_par_buffer, low_par_buffer')
    .eq('club_id', clubId)
    .single();

  const critBuffer = Number(settings?.critical_par_buffer ?? 0.5);
  const lowBuffer = Number(settings?.low_par_buffer ?? 1.5);

  const itemsBelowPar = (catalog ?? [])
    .filter((c) => c.par_level != null)
    .map((c) => ({ ...c, par_level: c.par_level as number }))
    .filter((c) => c.current_stock < c.par_level * lowBuffer)
    .map((c) => ({
      code: c.code,
      name: c.name,
      current_stock: c.current_stock,
      par_level: c.par_level,
    }))
    .sort((a, b) => a.current_stock / a.par_level - b.current_stock / b.par_level);

  const itemsCritical = itemsBelowPar.filter(
    (i) => i.current_stock / i.par_level <= critBuffer,
  ).length;
  const itemsLow = itemsBelowPar.length - itemsCritical;

  return {
    event: {
      id: event.id as string,
      name: event.name,
      opponent: event.opponent,
      is_home: event.is_home,
      date: event.date,
      attendance_actual: event.attendance_actual,
      attendance_predicted: event.attendance_predicted,
      weather: event.weather,
    },
    sales,
    volunteers: {
      total: totalSlots,
      filled: filledSlots,
      open: totalSlots - filledSlots,
      by_role: Array.from(byRole.entries()).map(([role, a]) => ({
        role,
        total: a.total,
        filled: a.filled,
        open: a.total - a.filled,
        names: a.names,
      })),
      last_synced_at: lastSync,
    },
    items_sold: itemsSold,
    receipts: receipts ?? [],
    receipts_total_cents: receiptsTotal,
    inventory: {
      items_below_par: itemsBelowPar,
      items_critical: itemsCritical,
      items_low: itemsLow,
    },
    generated_at: new Date().toISOString(),
  };
}
