import Link from 'next/link';
import { createAdminClient } from '@/utils/supabase/admin';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Events · BoosterIQ' };
export const revalidate = 0;

export default async function EventsPage() {
  const supabase = createAdminClient();
  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('shortname', 'LakeVistaVikings')
    .single();
  if (!club) return <div className="p-8">Club not found</div>;

  const today = new Date().toISOString().slice(0, 10);
  const [upcomingRes, pastRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, opponent, is_home, date, attendance_actual, signupgenius_url')
      .eq('club_id', club.id)
      .gte('date', today)
      .order('date', { ascending: true }),
    supabase
      .from('events')
      .select('id, name, opponent, is_home, date, attendance_actual, signupgenius_url')
      .eq('club_id', club.id)
      .lt('date', today)
      .order('date', { ascending: false }),
  ]);
  const upcoming = upcomingRes.data ?? [];
  const past = pastRes.data ?? [];

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold">Events</h1>
          <div className="flex gap-3">
            <Link
              href="/events/upload"
              className="border border-border-subtle hover:bg-white/5 text-sm font-semibold rounded-lg px-3 py-2"
            >
              Upload calendar
            </Link>
            <Link
              href="/events/new"
              className="bg-royal hover:bg-royal/90 text-white text-sm font-semibold rounded-lg px-3 py-2"
            >
              + New event
            </Link>
          </div>
        </div>
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          ← Dashboard
        </Link>

        <Section title={`Upcoming (${upcoming.length})`}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-muted px-1">No upcoming events scheduled.</p>
          ) : (
            <EventList events={upcoming} mode="upcoming" />
          )}
        </Section>

        <Section title={`Past (${past.length})`}>
          {past.length === 0 ? (
            <p className="text-sm text-ink-muted px-1">No past events yet.</p>
          ) : (
            <EventList events={past} mode="past" />
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold text-ink-muted uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EventList({
  events,
  mode,
}: {
  events: Array<{
    id: string;
    name: string;
    opponent: string | null;
    is_home: boolean | null;
    date: string;
    attendance_actual: number | null;
  }>;
  mode: 'upcoming' | 'past';
}) {
  return (
    <div className="bg-card border border-border-subtle rounded-xl divide-y divide-border-subtle">
      {events.map((ev) => (
        <Link
          key={ev.id}
          href={`/events/${ev.id}`}
          className="block px-5 py-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {ev.name}
                {ev.opponent ? (
                  <span className="text-ink-muted font-normal"> vs. {ev.opponent}</span>
                ) : null}
              </div>
              <div className="text-xs text-ink-muted mt-0.5">
                {formatDate(ev.date)}
                {ev.is_home === true ? ' · Home' : ev.is_home === false ? ' · Away' : ''}
                {ev.attendance_actual ? ` · ${ev.attendance_actual} attendance` : ''}
              </div>
            </div>
            <span className="text-ink-muted shrink-0 text-xs">
              {mode === 'upcoming' ? 'Game prep →' : 'Recap →'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
