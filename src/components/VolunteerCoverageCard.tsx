import Link from 'next/link';
import { Card, CardBody, CardHeader } from './Card';
import { urgencyClasses, type Urgency } from '@/lib/urgency';
import { formatRelativeShort } from '@/lib/format';
import type { EventSummary, VolunteerCoverage } from '@/lib/dashboard-data';

const CRITICAL_ROLES = new Set(['Concession stand', 'Grill', 'Cashier']);

function urgencyForRole(role: string, open: number, total: number): Urgency {
  if (open === 0) return 'filled';
  const isCritical = CRITICAL_ROLES.has(role);
  if (isCritical && open > 0) return 'critical';
  return 'low';
}

export function VolunteerCoverageCard({
  upcomingEvent,
  coverage,
}: {
  upcomingEvent: EventSummary | null;
  coverage: VolunteerCoverage | null;
}) {
  if (!upcomingEvent) {
    return (
      <Card>
        <CardHeader title="Volunteer coverage" meta="No upcoming event" />
        <CardBody>
          <div className="text-ink-muted text-sm">
            <Link href="/events/new" className="text-royal hover:underline">
              Add an event
            </Link>{' '}
            with a SignUp Genius URL and BoosterIQ will sync the roster.
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!coverage) {
    return (
      <Card>
        <CardHeader
          title={`Volunteer coverage — ${upcomingEvent.name}`}
          meta="Not synced"
        />
        <CardBody>
          <p className="text-ink-muted text-sm mb-3">
            No roster yet. Sync from SignUp Genius or paste the visible roster.
          </p>
          <Link
            href={`/events/${upcomingEvent.id}/sync`}
            className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 inline-block"
          >
            Sync roster ↗
          </Link>
        </CardBody>
      </Card>
    );
  }

  const criticalCount = coverage.roles.filter(
    (r) => CRITICAL_ROLES.has(r.role) && r.open > 0,
  ).length;
  const progressPct =
    coverage.total_slots > 0
      ? Math.round((coverage.filled_slots / coverage.total_slots) * 100)
      : 0;

  return (
    <Card>
      <CardHeader
        title={`Volunteer coverage — ${upcomingEvent.name}`}
        meta={`SignUp Genius · synced ${formatRelativeShort(coverage.last_synced_at)}`}
      />
      <CardBody className="space-y-3">
        <div className="text-sm text-ink-muted">
          {coverage.filled_slots} of {coverage.total_slots} slots filled
          {criticalCount > 0 ? (
            <>
              {' · '}
              <span className="text-critical font-semibold">
                {criticalCount} critical role{criticalCount === 1 ? '' : 's'} need fills
              </span>
            </>
          ) : null}
        </div>

        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-royal transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="space-y-2 pt-1">
          {coverage.roles.map((r) => {
            const urgency = urgencyForRole(r.role, r.open, r.total);
            const c = urgencyClasses(urgency);
            return (
              <div
                key={r.role}
                className={`flex items-center justify-between gap-3 rounded-lg border-l-[3px] ${c.rowBg} ${c.rowBorder} px-4 py-3`}
              >
                <div className="min-w-0">
                  <div className={`font-semibold truncate ${c.text}`}>{r.role}</div>
                  <div className="text-xs text-ink-muted">
                    {r.open === 0 ? 'All set' : `${r.open} unfilled`}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-sm font-semibold ${c.text}`}>
                    {r.filled} / {r.total}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${c.pillBg} ${c.pillText}`}
                  >
                    {urgency === 'filled' ? 'Filled' : urgency === 'critical' ? 'Critical' : 'Low'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href={`/events/${upcomingEvent.id}/sync`}
            className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 flex-1 text-center"
          >
            Re-sync roster ↗
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
