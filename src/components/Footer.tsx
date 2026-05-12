import Link from 'next/link';
import { formatDate } from '@/lib/format';
import type { EventSummary } from '@/lib/dashboard-data';

export function Footer({ upcomingEvent }: { upcomingEvent: EventSummary | null }) {
  if (!upcomingEvent) {
    return (
      <div className="bg-royal jersey-stripes rounded-xl px-5 py-3 flex items-center justify-between gap-4 overflow-hidden">
        <div className="text-sm text-white/85 uppercase tracking-wide">
          No upcoming events scheduled
        </div>
        <Link
          href="/events/new"
          className="bg-gold text-navy text-xs font-semibold uppercase tracking-widest rounded-sm px-3 py-1.5"
        >
          Add event ↗
        </Link>
      </div>
    );
  }

  const opponent = upcomingEvent.opponent ? ` vs ${upcomingEvent.opponent}` : '';
  return (
    <div className="bg-royal jersey-stripes rounded-xl px-5 py-3 flex items-center justify-between gap-4 overflow-hidden">
      <div className="font-display text-base uppercase tracking-wide text-white truncate">
        Next event ·{' '}
        <span className="text-gold">
          {upcomingEvent.name}
          {opponent}
        </span>{' '}
        · {formatDate(upcomingEvent.date)}
      </div>
      <Link
        href={`/events/${upcomingEvent.id}`}
        className="bg-gold text-navy text-xs font-semibold uppercase tracking-widest rounded-sm px-3 py-1.5 shrink-0"
      >
        Game prep ↗
      </Link>
    </div>
  );
}
