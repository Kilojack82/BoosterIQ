import { createAdminClient } from '@/utils/supabase/admin';
import { shoppingListUrgency, type Urgency } from './urgency';

export type DashboardData = {
  club: {
    id: string;
    name: string;
    shortname: string;
  };
  settings: {
    critical_par_buffer: number;
    low_par_buffer: number;
    cost_change_threshold_pct: number;
  };
  counts: {
    catalog_concessions: number;
    catalog_merch: number;
    menu_items: number;
    receipts: number;
    events: number;
  };
  shoppingList: ShoppingListRow[];
  latestEvent: EventSummary | null;
  upcomingEvent: EventSummary | null;
  volunteerCoverage: VolunteerCoverage | null;
  latestSales: LatestSales | null;
};

export type LatestSales = {
  total_qty: number;
  total_net_sales_cents: number;
  total_gross_sales_cents: number;
  date_range: { start: string | null; end: string | null };
  processed_at: string | null;
  payment_breakdown: {
    cash_cents: number | null;
    card_cents: number | null;
    cashapp_cents: number | null;
    fees_cents: number | null;
    net_total_cents: number | null;
  } | null;
  source: 'summary' | 'items';
};

export type VolunteerRoleSummary = {
  role: string;
  total: number;
  filled: number;
  open: number;
};

export type VolunteerCoverage = {
  event_id: string;
  total_slots: number;
  filled_slots: number;
  roles: VolunteerRoleSummary[];
  last_synced_at: string | null;
};

export type ShoppingListRow = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  current_stock: number;
  par_level: number | null;
  sold_qty: number;
  buy_qty: number;
  urgency: Urgency;
};

export type EventSummary = {
  id: string;
  name: string;
  opponent: string | null;
  is_home: boolean | null;
  date: string;
  attendance_actual: number | null;
  weather: string | null;
};

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createAdminClient();

  // Club + settings (single row each in V1)
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, shortname')
    .eq('shortname', 'LakeVistaVikings')
    .single();
  if (!club) throw new Error('Vikings club not found');

  const { data: settings } = await supabase
    .from('club_settings')
    .select('critical_par_buffer, low_par_buffer, cost_change_threshold_pct')
    .eq('club_id', club.id)
    .single();
  if (!settings) throw new Error('club_settings not found');

  // Counts
  const [catalogConcessions, catalogMerch, menuItems, receipts, events] =
    await Promise.all([
      supabase
        .from('catalog_items')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('is_merch', false),
      supabase
        .from('catalog_items')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('is_merch', true),
      supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id),
      supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id),
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id),
    ]);

  // Shopping list — sales-driven. Lists every catalog item that sold in
  // the most recent Square import. Items that sold 0 are excluded by
  // design. Buy qty = sold × 1.5 (one game's worth + 50% buffer).
  // Urgency reflects stock-on-hand vs. last game's sales.
  const { data: latestSalesImport } = await supabase
    .from('square_imports')
    .select('id, processed_at')
    .eq('club_id', club.id)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const shoppingList: ShoppingListRow[] = [];
  if (latestSalesImport) {
    // Items with at least one reconcile movement = items the chair has
    // counted via the Base Stock tab. Only these appear on the shopping
    // list. Cheeseburger / Hot Dog / Pizza Slice etc. won't be counted in
    // Base Stock (they're recipe items), so they're excluded automatically.
    const { data: reconciled } = await supabase
      .from('stock_movements')
      .select('catalog_item_id')
      .eq('source_type', 'reconcile');
    const baseStockTracked = new Set(
      (reconciled ?? []).map((r) => r.catalog_item_id as string),
    );

    type MovementRow = {
      catalog_item_id: string;
      delta: number;
      catalog_items: {
        id: string;
        code: string;
        name: string;
        category: string | null;
        current_stock: number;
        par_level: number | null;
        is_merch: boolean;
      } | null;
    };
    const { data: movements } = await supabase
      .from('stock_movements')
      .select(
        'catalog_item_id, delta, catalog_items(id, code, name, category, current_stock, par_level, is_merch)',
      )
      .eq('source_type', 'sale')
      .eq('source_id', latestSalesImport.id)
      .returns<MovementRow[]>();

    type Agg = { sold: number; item: NonNullable<MovementRow['catalog_items']> };
    const byCatalog = new Map<string, Agg>();
    for (const m of movements ?? []) {
      if (!m.catalog_items || m.catalog_items.is_merch) continue;
      // Filter to base-stock-tracked items only.
      if (!baseStockTracked.has(m.catalog_item_id)) continue;
      const existing = byCatalog.get(m.catalog_item_id) ?? {
        sold: 0,
        item: m.catalog_items,
      };
      existing.sold += Math.abs(m.delta);
      byCatalog.set(m.catalog_item_id, existing);
    }

    for (const agg of byCatalog.values()) {
      if (agg.sold <= 0) continue;
      let urgency: Urgency = 'filled';
      if (agg.item.current_stock <= 0) urgency = 'critical';
      else if (agg.item.current_stock < agg.sold) urgency = 'low';
      shoppingList.push({
        id: agg.item.id,
        code: agg.item.code,
        name: agg.item.name,
        category: agg.item.category,
        current_stock: agg.item.current_stock,
        par_level: agg.item.par_level,
        sold_qty: agg.sold,
        buy_qty: Math.ceil(agg.sold * 1.5),
        urgency,
      });
    }
    shoppingList.sort((a, b) => {
      const order = { critical: 0, low: 1, filled: 2 };
      return order[a.urgency] - order[b.urgency] || b.sold_qty - a.sold_qty;
    });
  }

  // Events — latest past + next upcoming
  const today = new Date().toISOString().slice(0, 10);
  const [latestRes, upcomingRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, opponent, is_home, date, attendance_actual, weather')
      .eq('club_id', club.id)
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('events')
      .select('id, name, opponent, is_home, date, attendance_actual, weather')
      .eq('club_id', club.id)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // Volunteer coverage for the upcoming event (if any)
  let volunteerCoverage: VolunteerCoverage | null = null;
  if (upcomingRes.data) {
    const { data: slots } = await supabase
      .from('volunteer_slots')
      .select('role, filled_by_name, scraped_at')
      .eq('event_id', upcomingRes.data.id);
    if (slots && slots.length > 0) {
      const byRole = new Map<string, { total: number; filled: number }>();
      let lastSyncedAt: string | null = null;
      for (const s of slots) {
        const tally = byRole.get(s.role) ?? { total: 0, filled: 0 };
        tally.total += 1;
        if (s.filled_by_name) tally.filled += 1;
        byRole.set(s.role, tally);
        if (!lastSyncedAt || (s.scraped_at && s.scraped_at > lastSyncedAt)) {
          lastSyncedAt = s.scraped_at as string;
        }
      }
      const roles: VolunteerRoleSummary[] = Array.from(byRole.entries()).map(
        ([role, t]) => ({ role, total: t.total, filled: t.filled, open: t.total - t.filled }),
      );
      const total_slots = roles.reduce((a, r) => a + r.total, 0);
      const filled_slots = roles.reduce((a, r) => a + r.filled, 0);
      volunteerCoverage = {
        event_id: upcomingRes.data.id,
        total_slots,
        filled_slots,
        roles,
        last_synced_at: lastSyncedAt,
      };
    }
  }

  // Latest Square import — drives the Gross sales KPI
  const { data: latestImport } = await supabase
    .from('square_imports')
    .select('parsed_data_json, processed_at')
    .eq('club_id', club.id)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let latestSales: LatestSales | null = null;
  if (latestImport?.parsed_data_json) {
    const j = latestImport.parsed_data_json as Record<string, unknown>;
    const summary = j.summary as Record<string, number | null> | null;
    // Prefer the Sales Summary PDF's authoritative total when present —
    // it reflects what Square's dashboard reports, and is more reliable
    // than the items aggregation (which can drop rows during PDF parse).
    const useSummary =
      summary != null && (summary.net_sales_cents ?? null) != null;
    latestSales = {
      total_qty: Number(j.total_qty ?? 0),
      total_net_sales_cents: useSummary
        ? Number(summary!.net_sales_cents)
        : Number(j.total_net_sales_cents ?? 0),
      total_gross_sales_cents: useSummary
        ? Number(summary!.gross_sales_cents ?? summary!.net_sales_cents)
        : Number(j.total_gross_sales_cents ?? 0),
      date_range:
        (j.date_range as LatestSales['date_range']) ?? { start: null, end: null },
      processed_at: latestImport.processed_at as string | null,
      payment_breakdown: summary
        ? {
            cash_cents: summary.cash_cents ?? null,
            card_cents: summary.card_cents ?? null,
            cashapp_cents: summary.cashapp_cents ?? null,
            fees_cents: summary.fees_cents ?? null,
            net_total_cents: summary.net_total_cents ?? null,
          }
        : null,
      source: useSummary ? 'summary' : 'items',
    };
  }

  return {
    club,
    settings: {
      critical_par_buffer: Number(settings.critical_par_buffer),
      low_par_buffer: Number(settings.low_par_buffer),
      cost_change_threshold_pct: Number(settings.cost_change_threshold_pct),
    },
    counts: {
      catalog_concessions: catalogConcessions.count ?? 0,
      catalog_merch: catalogMerch.count ?? 0,
      menu_items: menuItems.count ?? 0,
      receipts: receipts.count ?? 0,
      events: events.count ?? 0,
    },
    shoppingList,
    latestEvent: latestRes.data ?? null,
    upcomingEvent: upcomingRes.data ?? null,
    volunteerCoverage,
    latestSales,
  };
}
