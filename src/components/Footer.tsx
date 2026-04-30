import { formatDate } from '@/lib/format';
import type { EventSummary } from '@/lib/dashboard-data';

export function Footer({ upcomingEvent }: { upcomingEvent: EventSummary | null }) {
  if (!upcomingEvent) {
    return (
      <div className="bg-royal rounded-xl px-5 py-3 flex items-center justify-between gap-4">
        <div className="text-sm text-white/85">No upcoming events scheduled</div>
        <button
          type="button"
          disabled
          className="bg-gold text-navy text-sm font-semibold rounded-full px-4 py-1 opacity-70"
        >
          Add event ↗
        </button>
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
      <button
        type="button"
        className="bg-gold text-navy text-sm font-semibold rounded-full px-4 py-1 shrink-0"
      >
        Game prep ↗
      </button>
    </div>
  );
}
