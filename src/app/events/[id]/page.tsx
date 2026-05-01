import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventPrep } from '@/lib/event-prep-data';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { formatCents, formatDate } from '@/lib/format';
import { urgencyClasses, type Urgency } from '@/lib/urgency';

export const metadata = { title: 'Event · BoosterIQ' };
export const revalidate = 0;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prep = await getEventPrep(id);
  if (!prep) notFound();

  const { event, is_future, prev_event, rows, receipts_since_prev } = prep;
  const opponent = event.opponent ? ` vs. ${event.opponent}` : '';
  const homeAway = event.is_home === true ? 'Home' : event.is_home === false ? 'Away' : null;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold truncate">
              {event.name}
              <span className="text-ink-muted font-normal">{opponent}</span>
            </h1>
            <div className="text-sm text-ink-muted">
              {formatDate(event.date)}
              {homeAway ? ` · ${homeAway}` : ''}
            </div>
          </div>
          <Link href="/events" className="text-sm text-ink-muted hover:text-ink shrink-0">
            ← All events
          </Link>
        </div>

        {is_future ? (
          <>
            {event.is_home === false ? (
              <Card>
                <CardBody className="pt-5">
                  <div className="text-ink-muted text-sm">
                    Away game — no concession setup or volunteer roster needed.
                  </div>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader
                  title="Volunteer roster"
                  meta={
                    event.signupgenius_url ? (
                      <Link
                        href={`/events/${event.id}/sync`}
                        className="text-royal hover:underline"
                      >
                        Sync now →
                      </Link>
                    ) : null
                  }
                />
                <CardBody>
                  {event.signupgenius_url ? (
                    <p className="text-sm text-ink-muted">
                      SignUp Genius URL on file —{' '}
                      <Link
                        href={`/events/${event.id}/sync`}
                        className="text-royal hover:underline"
                      >
                        sync the latest roster
                      </Link>
                      .
                    </p>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      No SignUp Genius URL set yet.{' '}
                      <Link
                        href={`/events/${event.id}/sync`}
                        className="text-royal hover:underline"
                      >
                        Add one or paste the roster
                      </Link>
                      .
                    </p>
                  )}
                </CardBody>
              </Card>
            )}

            <Card accentLeft="gold">
              <CardHeader
                eyebrow="Game prep"
                title={
                  prev_event
                    ? `Buy list based on ${prev_event.name} (${prev_event.date})`
                    : 'Buy list'
                }
                meta={
                  receipts_since_prev.count > 0
                    ? `${receipts_since_prev.count} receipts · ${formatCents(receipts_since_prev.total_cents)} since last game`
                    : 'No receipts since last game'
                }
              />
              <CardBody>
                {rows.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    No game prep data yet. Either no prior Square import, or no
                    base-stock-tracked items sold last game.
                  </p>
                ) : (
                  <PrepList rows={rows} />
                )}
              </CardBody>
            </Card>
          </>
        ) : (
          <>
            <Card accentLeft="gold">
              <CardHeader
                title="Post-game recap"
                meta={
                  <Link
                    href={`/events/${event.id}/report`}
                    className="bg-gold text-navy text-xs font-semibold rounded-full px-3 py-1 hover:bg-gold/90"
                  >
                    View report →
                  </Link>
                }
              />
              <CardBody>
                <p className="text-sm text-ink-muted">
                  See the full printable post-game report — sales, volunteers, supply
                  spending, and inventory needing reorder.
                </p>
              </CardBody>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function PrepList({
  rows,
}: {
  rows: import('@/lib/event-prep-data').GamePrepRow[];
}) {
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        let urgency: Urgency = 'filled';
        if (r.recommended_buy > 0 && r.current_stock <= 0) urgency = 'critical';
        else if (r.recommended_buy > 0) urgency = 'low';
        const c = urgencyClasses(urgency);
        return (
          <div
            key={r.id}
            className={`flex items-center justify-between gap-3 rounded-lg border-l-[3px] ${c.rowBg} ${c.rowBorder} px-4 py-3`}
          >
            <div className="min-w-0">
              <div className={`font-semibold truncate ${c.text}`}>{r.name}</div>
              <div className="text-xs text-ink-muted">
                Sold {r.last_game_sold} last game · {r.current_stock} on hand
                {r.receipts_since_last_game > 0
                  ? ` · +${r.receipts_since_last_game} from receipts`
                  : ''}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {r.recommended_buy > 0 ? (
                <span className={`text-sm font-semibold ${c.text}`}>
                  Buy {r.recommended_buy}
                </span>
              ) : (
                <span className="text-sm text-ink-muted">Stocked</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
