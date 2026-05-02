import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getEventReportData } from '@/lib/event-report-data';
import { formatCents, formatDate } from '@/lib/format';
import { PrintButton } from './PrintButton';

export const metadata = { title: 'Post-game report · BoosterIQ' };
export const revalidate = 0;

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getEventReportData(id);
  if (!data) notFound();

  const homeAway =
    data.event.is_home == null ? '' : data.event.is_home ? ' · Home' : ' · Away';
  const opponent = data.event.opponent ? ` vs. ${data.event.opponent}` : '';
  const generated = new Date(data.generated_at).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });

  const summary = data.sales?.summary ?? null;
  const hasPaymentBreakdown =
    summary != null &&
    [
      summary.cash_cents,
      summary.card_cents,
      summary.cashapp_cents,
      summary.fees_cents,
      summary.net_total_cents,
    ].some((v) => v != null);

  return (
    <div className="min-h-screen bg-surface text-ink print:bg-white print:text-black">
      {/* Screen-only top bar */}
      <div className="border-b border-border-subtle print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← Dashboard
          </Link>
          <PrintButton eventId={data.event.id} />
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 py-8 print:py-6 print:px-8 print:max-w-none">
        {/* Branded report header */}
        <header className="relative mb-8 print:mb-6 print:break-inside-avoid">
          <div className="bg-royal print:bg-royal text-white rounded-2xl print:rounded-none px-6 py-6 flex items-center gap-5">
            <div className="size-16 rounded-full bg-navy ring-2 ring-gold flex items-center justify-center shrink-0 print:bg-navy print:ring-gold">
              <span className="text-gold font-bold text-lg tracking-tight">LV</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gold mb-0.5">
                Booster IQ · Post-game Report
              </div>
              <h1 className="text-2xl print:text-2xl font-bold leading-tight truncate">
                {data.event.name}
                <span className="text-white/75 font-normal">
                  {opponent}
                  {homeAway}
                </span>
              </h1>
              <div className="text-xs text-white/80 mt-1">
                {formatDate(data.event.date)}
                {data.event.attendance_actual
                  ? ` · ${data.event.attendance_actual} attendance`
                  : ''}
                {data.event.weather ? ` · ${data.event.weather}` : ''}
              </div>
            </div>
            <div className="text-right text-[10px] text-white/70 shrink-0 hidden sm:block">
              <div className="uppercase tracking-wider">Generated</div>
              <div>{generated}</div>
            </div>
          </div>
        </header>

        {/* At-a-glance */}
        <section className="grid grid-cols-3 gap-3 print:break-inside-avoid">
          <Glance
            label="Game day sales"
            value={data.sales ? String(data.sales.total_qty) : '—'}
            sublabel={
              data.sales
                ? `${formatCents(data.sales.total_net_sales_cents)} net`
                : 'No sales uploaded'
            }
            tone="skyblue"
          />
          <Glance
            label="Gross sales"
            value={data.sales ? formatCents(data.sales.total_gross_sales_cents) : '—'}
            sublabel={
              data.sales
                ? data.sales.total_qty === 0
                  ? '0 transactions'
                  : `${data.sales.total_qty} transactions`
                : 'No sales uploaded'
            }
            tone="skyblue"
          />
          <Glance
            label="Take-home"
            value={
              summary?.net_total_cents != null
                ? formatCents(summary.net_total_cents)
                : data.sales
                  ? formatCents(data.sales.total_net_sales_cents)
                  : '—'
            }
            sublabel={
              summary?.net_total_cents != null
                ? 'Net after fees'
                : 'Net sales'
            }
            tone="gold"
          />
        </section>

        {/* Sales summary — payment breakdown */}
        {hasPaymentBreakdown && summary ? (
          <Section title="Sales Summary">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              {summary.cash_cents != null ? (
                <SummaryRow label="Cash" value={summary.cash_cents} />
              ) : null}
              {summary.card_cents != null ? (
                <SummaryRow label="Card" value={summary.card_cents} />
              ) : null}
              {summary.cashapp_cents != null ? (
                <SummaryRow label="Cash App" value={summary.cashapp_cents} />
              ) : null}
              {summary.giftcard_cents != null && summary.giftcard_cents !== 0 ? (
                <SummaryRow label="Gift card" value={summary.giftcard_cents} />
              ) : null}
              {summary.other_cents != null && summary.other_cents !== 0 ? (
                <SummaryRow label="Other" value={summary.other_cents} />
              ) : null}
              {summary.fees_cents != null ? (
                <SummaryRow label="Fees" value={summary.fees_cents} negative />
              ) : null}
              {summary.net_total_cents != null ? (
                <SummaryRow
                  label="Net total"
                  value={summary.net_total_cents}
                  emphasize
                />
              ) : null}
            </div>
          </Section>
        ) : null}

        {/* Game Day Sales — per-item breakdown */}
        <Section title="Game Day Sales">
          {data.items_sold.length > 0 ? (
            <div>
              <div className="grid grid-cols-[1fr_3rem_5rem] gap-x-3 text-[11px] uppercase tracking-wider text-ink-faint print:text-gray-700 font-semibold pb-2 px-3 border-l-[3px] border-transparent">
                <div>Item</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Sales</div>
              </div>
              <div className="space-y-1.5">
                {data.items_sold.map((row, i) => {
                  const tier = saleTier(i);
                  return (
                    <div
                      key={row.id}
                      className={`grid grid-cols-[1fr_3rem_5rem] gap-x-3 items-baseline rounded-lg border-l-[3px] px-3 py-2 ${tier.rowBg} ${tier.rowBorder} print:bg-transparent print:border-l-2 print:border-black`}
                    >
                      <div className="min-w-0">
                        <div
                          className={`font-semibold truncate ${tier.text} print:text-black`}
                        >
                          {row.name}
                        </div>
                        {row.category ? (
                          <div className="text-[10px] text-ink-faint print:text-gray-600">
                            {row.category}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={`text-right tabular-nums font-bold ${tier.text} print:text-black`}
                      >
                        {row.sold_qty}
                      </div>
                      <div
                        className={`text-right tabular-nums font-semibold ${tier.text} print:text-black`}
                      >
                        {row.net_sales_cents > 0
                          ? formatCents(row.net_sales_cents)
                          : '—'}
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1fr_3rem_5rem] gap-x-3 px-3 pt-2 mt-2 border-t-2 border-royal print:border-black border-l-[3px] border-l-transparent">
                  <div className="text-xs uppercase tracking-wider text-ink-faint print:text-gray-700 font-semibold">
                    Total
                  </div>
                  <div className="text-right tabular-nums font-bold">
                    {data.sales?.total_qty ?? 0}
                  </div>
                  <div className="text-right tabular-nums font-bold">
                    {formatCents(data.sales?.total_net_sales_cents ?? 0)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-faint print:text-gray-700 print:hidden">
                <Legend swatch="bg-skyblue" label="Top 5 sellers" />
                <Legend swatch="bg-gold" label="Next 5" />
                <Legend swatch="bg-cream" label="Rest" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted print:text-gray-700">
              No items recorded from Square for this event.
            </p>
          )}
        </Section>

        {/* Volunteers */}
        <Section title="Volunteer Roster">
          {data.volunteers.total > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Stat label="Total slots" value={String(data.volunteers.total)} />
                <Stat label="Filled" value={String(data.volunteers.filled)} />
                <Stat label="Open" value={String(data.volunteers.open)} />
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-ink-muted print:text-gray-700 border-b border-border-subtle print:border-gray-400">
                  <tr>
                    <th className="pb-2 font-semibold">Role</th>
                    <th className="pb-2 font-semibold">Filled</th>
                    <th className="pb-2 font-semibold">Volunteers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle print:divide-gray-300">
                  {data.volunteers.by_role.map((r) => (
                    <tr key={r.role}>
                      <td className="py-2 font-semibold">{r.role}</td>
                      <td className="py-2 whitespace-nowrap tabular-nums">
                        {r.filled} / {r.total}
                      </td>
                      <td className="py-2 text-ink-muted print:text-gray-700">
                        {r.names.length > 0 ? r.names.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-ink-muted print:text-gray-700">
              No volunteer slots synced for this event.
            </p>
          )}
        </Section>

        {/* Receipts */}
        <Section title="Supply Spending — Past 7 Days">
          {data.receipts.length > 0 ? (
            <>
              <Stat label="Total spent" value={formatCents(data.receipts_total_cents)} />
              <table className="w-full text-sm mt-4">
                <thead className="text-left text-[11px] uppercase tracking-wider text-ink-muted print:text-gray-700 border-b border-border-subtle print:border-gray-400">
                  <tr>
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Vendor</th>
                    <th className="pb-2 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle print:divide-gray-300">
                  {data.receipts.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 whitespace-nowrap">{r.receipt_date ?? '—'}</td>
                      <td className="py-2">{r.vendor ?? '—'}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCents(r.total_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-ink-muted print:text-gray-700">
              No receipts logged in the 7 days before this event.
            </p>
          )}
        </Section>

        <footer className="mt-12 pt-4 border-t-2 border-royal print:border-black flex items-center justify-between text-[11px] text-ink-muted print:text-gray-700">
          <span className="font-semibold tracking-wider uppercase">
            Booster IQ
          </span>
          <span>Lago Vista Vikings Booster Club</span>
          <span>Generated {generated}</span>
        </footer>
      </article>
    </div>
  );
}

function saleTier(index: number) {
  if (index < 5)
    return { rowBg: 'bg-royal/15', rowBorder: 'border-royal', text: 'text-skyblue' };
  if (index < 10)
    return { rowBg: 'bg-gold/15', rowBorder: 'border-gold', text: 'text-gold' };
  return { rowBg: 'bg-cream/10', rowBorder: 'border-cream', text: 'text-cream' };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 print:mt-6 print:break-inside-avoid">
      <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gold print:text-black mb-2">
        {title}
      </h2>
      <div className="border-l-[3px] border-royal pl-4 print:border-black">
        {children}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-muted print:text-gray-700">
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Glance({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel: string;
  tone: 'skyblue' | 'critical' | 'gold';
}) {
  const valueColor =
    tone === 'critical'
      ? 'text-critical'
      : tone === 'gold'
        ? 'text-gold'
        : 'text-skyblue';
  return (
    <div className="border border-border-subtle rounded-xl px-3 py-3 print:border-gray-400 print:break-inside-avoid">
      <div className="text-[10px] uppercase tracking-[0.15em] text-ink-muted print:text-gray-700">
        {label}
      </div>
      <div
        className={`text-[22px] font-bold leading-tight tabular-nums mt-1 ${valueColor} print:text-black`}
      >
        {value}
      </div>
      <div className="text-[11px] text-ink-muted print:text-gray-700 mt-0.5">
        {sublabel}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  negative,
  emphasize,
}: {
  label: string;
  value: number;
  negative?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between border-b border-border-subtle print:border-gray-300 py-1 ${
        emphasize ? 'border-t border-t-royal mt-1 pt-2 print:border-t-black' : ''
      }`}
    >
      <span
        className={`text-xs ${emphasize ? 'font-semibold uppercase tracking-wider' : 'text-ink-muted print:text-gray-700'}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums font-semibold ${
          negative ? 'text-critical print:text-black' : ''
        } ${emphasize ? 'text-base text-gold print:text-black' : ''}`}
      >
        {formatCents(value)}
      </span>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-2 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
