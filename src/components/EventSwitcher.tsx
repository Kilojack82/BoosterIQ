import Link from 'next/link';
import type { EventOption } from '@/lib/dashboard-data';

export function EventSwitcher({
  events,
  selectedEventId,
}: {
  events: EventOption[];
  selectedEventId: string | null;
}) {
  if (events.length === 0) return null;

  return (
    <div className="bg-card border border-border-subtle rounded-xl px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-ink-faint px-1 pb-1">
        Viewing event
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {events.map((e) => {
          const active = e.id === selectedEventId;
          return (
            <Link
              key={e.id}
              href={`/?event=${e.id}`}
              prefetch={false}
              scroll={false}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs whitespace-nowrap transition-colors ${
                active
                  ? 'bg-royal/20 border-skyblue text-skyblue'
                  : 'border-border-subtle text-ink-muted hover:bg-white/5'
              }`}
            >
              <div className="font-semibold">
                {e.name}
                {e.has_sales ? null : (
                  <span className="ml-1 text-ink-faint font-normal">· no data</span>
                )}
              </div>
              <div className="text-[10px] opacity-80">{e.date}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
