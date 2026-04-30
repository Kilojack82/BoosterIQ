import { Card, CardBody, CardHeader } from './Card';
import type { EventSummary } from '@/lib/dashboard-data';

export function VolunteerCoverageCard({ upcomingEvent }: { upcomingEvent: EventSummary | null }) {
  if (!upcomingEvent) {
    return (
      <Card>
        <CardHeader title="Volunteer coverage" meta="SignUp Genius · not synced" />
        <CardBody>
          <div className="text-ink-muted text-sm">
            No upcoming game on the calendar. Add an event with a SignUp Genius
            URL and BoosterIQ will sync the roster automatically.
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={`Volunteer coverage — ${upcomingEvent.name}`}
        meta="SignUp Genius · not synced"
      />
      <CardBody>
        <div className="text-ink-muted text-sm">
          Volunteer slot ingestion lands in build step 7 (SignUp Genius
          scraper). Add the event&apos;s SignUp Genius URL during onboarding
          to populate this panel.
        </div>
      </CardBody>
    </Card>
  );
}
