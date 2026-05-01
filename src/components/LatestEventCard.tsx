import Link from 'next/link';
import { Card, CardBody, CardHeader } from './Card';
import { formatDate } from '@/lib/format';
import type { EventSummary } from '@/lib/dashboard-data';

export function LatestEventCard({ event }: { event: EventSummary | null }) {
  if (!event) {
    return (
      <Card>
        <CardBody className="pt-5">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-ink-faint mb-1">
            Latest event
          </div>
          <div className="text-ink-muted text-sm">
            No events yet. Add your first game to see post-game recaps here.
          </div>
        </CardBody>
      </Card>
    );
  }

  const home = event.is_home == null ? null : event.is_home ? 'Home' : 'Away';
  const subline = [
    formatDate(event.date),
    event.attendance_actual ? `${event.attendance_actual} attendance` : null,
    event.weather,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card accentLeft="gold">
      <CardHeader
        eyebrow="Latest event · Just finished"
        title={
          <>
            {event.name}
            {event.opponent ? (
              <span className="text-ink-muted font-normal"> vs. {event.opponent}</span>
            ) : null}
            {home ? (
              <span className="text-ink-muted font-normal"> · {home}</span>
            ) : null}
          </>
        }
        meta={
          <Link
            href={`/events/${event.id}/report`}
            className="bg-gold text-navy text-xs font-semibold rounded-full px-3 py-1 hover:bg-gold/90 transition-colors"
          >
            Report ready ↗
          </Link>
        }
      />
      <CardBody>
        <div className="text-sm text-ink-muted">{subline}</div>
      </CardBody>
    </Card>
  );
}
