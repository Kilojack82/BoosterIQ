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
  current_stock: number;
  par_level: number;
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

  // Shopping list: items with par_level set, where current_stock is below
  // the low_par_buffer threshold. Concessions only — merch isn't a reorder
  // concern in V1.
  const { data: catalog } = await supabase
    .from('catalog_items')
    .select('id, code, name, current_stock, par_level')
    .eq('club_id', club.id)
    .eq('is_merch', false)
    .not('par_level', 'is', null)
    .order('name');

  const shoppingList: ShoppingListRow[] = [];
  for (const item of catalog ?? []) {
    if (item.par_level == null) continue;
    const urgency = shoppingListUrgency({
      current_stock: item.current_stock,
      par_level: item.par_level,
      critical_buffer: Number(settings.critical_par_buffer),
      low_buffer: Number(settings.low_par_buffer),
    });
    if (urgency == null) continue;
    shoppingList.push({
      id: item.id,
      code: item.code,
      name: item.name,
      current_stock: item.current_stock,
      par_level: item.par_level,
      buy_qty: Math.max(0, item.par_level * 2 - item.current_stock),
      urgency,
    });
  }
  shoppingList.sort((a, b) => {
    const order = { critical: 0, low: 1, filled: 2 };
    return order[a.urgency] - order[b.urgency] || a.name.localeCompare(b.name);
  });

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
  };
}
