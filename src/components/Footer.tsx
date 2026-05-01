import Link from 'next/link';
import { formatDate } from '@/lib/format';
import type { EventSummary } from '@/lib/dashboard-data';

export function Footer({ upcomingEvent }: { upcomingEvent: EventSummary | null }) {
  if (!upcomingEvent) {
    return (
      <div className="bg-royal rounded-xl px-5 py-3 flex items-center justify-between gap-4">
        <div className="text-sm text-white/85">No upcoming events scheduled</div>
        <Link
          href="/events/new"
          className="bg-gold text-navy text-sm font-semibold rounded-full px-4 py-1"
        >
          Add event ↗
        </Link>
      </div>
    );
  }

  const opponent = upcomingEvent.opponent ? ` vs. ${upcomingEvent.opponent}` : '';
  return (
    <div className="bg-royal rounded-xl px-5 py-3 flex items-center justify-between gap-4">
      <div className="text-sm text-white/90 truncate">
        Next event: <span className="text-gold font-semibold">{upcomingEvent.name}{opponent}</span>{' '}
        · {formatDate(upcomingEvent.date)}
      </div>
      <Link
        href={`/events/${upcomingEvent.id}/sync`}
        className="bg-gold text-navy text-sm font-semibold rounded-full px-4 py-1 shrink-0"
      >
        Game prep ↗
      </Link>
    </div>
  );
}
