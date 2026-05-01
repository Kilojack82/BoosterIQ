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
  });

  return (
    <div className="min-h-screen bg-surface text-ink print:bg-white print:text-black">
      {/* Screen-only top bar — hidden on print */}
      <div className="border-b border-border-subtle print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← Dashboard
          </Link>
          <PrintButton />
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 py-8 print:py-4 print:px-0 print:max-w-none">
        {/* Report header */}
        <header className="border-b-2 border-royal pb-4 mb-6 print:border-black">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[11px] font-semibold tracking-widest uppercase text-gold print:text-black mb-1">
                BoosterIQ Post-game Report
              </div>
              <h1 className="text-3xl font-bold leading-tight">
                {data.event.name}
                <span className="text-ink-muted font-normal print:text-gray-700">
                  {opponent}
                  {homeAway}
                </span>
              </h1>
              <div className="text-sm text-ink-muted mt-1 print:text-gray-700">
                {formatDate(data.event.date)}
                {data.event.attendance_actual
                  ? ` · ${data.event.attendance_actual} attendance`
                  : ''}
                {data.event.weather ? ` · ${data.event.weather}` : ''}
              </div>
            </div>
            <div className="text-right text-xs text-ink-muted print:text-gray-700 shrink-0">
              <div>Generated</div>
              <div>{generated}</div>
            </div>
          </div>
        </header>

        {/* At-a-glance — top-line numbers chairs flip to first */}
        <section className="grid grid-cols-3 gap-3 mt-6 print:mt-4 print:break-inside-avoid">
          <Glance
            label="Game day sales"
            value={data.sales ? String(data.sales.total_qty) : '—'}
            sublabel={
              data.sales ? `${formatCents(data.sales.total_net_sales_cents)} net` : 'No sales uploaded'
            }
            tone="skyblue"
          />
          <Glance
            label="Items needed"
            value={String(data.inventory.items_below_par.length)}
            sublabel={
              data.inventory.items_below_par.length === 0
                ? 'All at par'
                : `${data.inventory.items_critical} critical · ${data.inventory.items_low} low`
            }
            tone={data.inventory.items_below_par.length > 0 ? 'critical' : 'skyblue'}
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
        </section>

        {/* Sales */}
        <Section title="Sales">
          {data.sales ? (
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Net sales" value={formatCents(data.sales.total_net_sales_cents)} />
              <Stat
                label="Gross sales"
                value={formatCents(data.sales.total_gross_sales_cents)}
              />
              <Stat label="Items sold" value={String(data.sales.total_qty)} />
            </div>
          ) : (
            <p className="text-sm text-ink-muted print:text-gray-700">
              No Square sales uploaded for this event yet.
            </p>
          )}
        </Section>

        {/* Volunteers */}
        <Section title="Volunteer roster">
          {data.volunteers.total > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Stat label="Total slots" value={String(data.volunteers.total)} />
                <Stat label="Filled" value={String(data.volunteers.filled)} />
                <Stat label="Open" value={String(data.volunteers.open)} />
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-ink-muted print:text-gray-700">
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
                      <td className="py-2 whitespace-nowrap">
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

        {/* Spending (receipts) */}
        <Section title="Supply spending — past 7 days">
          {data.receipts.length > 0 ? (
            <>
              <Stat label="Total spent" value={formatCents(data.receipts_total_cents)} />
              <table className="w-full text-sm mt-4">
                <thead className="text-left text-xs uppercase text-ink-muted print:text-gray-700">
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

        {/* Inventory */}
        <Section title="Inventory needing reorder">
          {data.inventory.items_below_par.length > 0 ? (
            <>
              <div className="text-sm text-ink-muted print:text-gray-700 mb-3">
                {data.inventory.items_critical} critical ·{' '}
                {data.inventory.items_low} low
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-ink-muted print:text-gray-700">
                  <tr>
                    <th className="pb-2 font-semibold">Item</th>
                    <th className="pb-2 font-semibold text-right">Stock</th>
                    <th className="pb-2 font-semibold text-right">Par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle print:divide-gray-300">
                  {data.inventory.items_below_par.map((i) => (
                    <tr key={i.code}>
                      <td className="py-2">
                        <div>{i.name}</div>
                        <div className="text-xs text-ink-muted print:text-gray-700">
                          {i.code}
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums">{i.current_stock}</td>
                      <td className="py-2 text-right tabular-nums">{i.par_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-ink-muted print:text-gray-700">
              All par-tracked items are at or above target levels.
            </p>
          )}
        </Section>

        <footer className="mt-12 pt-4 border-t border-border-subtle print:border-gray-400 text-xs text-ink-muted print:text-gray-700 text-center">
          BoosterIQ V1 · Lago Vista Vikings Booster
        </footer>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 print:mt-6 print:break-inside-avoid">
      <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-border-subtle print:border-gray-300">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-muted print:text-gray-700">{label}</div>
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
    <div className="border border-border-subtle rounded-xl px-3 py-3 print:border-gray-400">
      <div className="text-[11px] uppercase tracking-wider text-ink-muted print:text-gray-700">
        {label}
      </div>
      <div
        className={`text-[24px] font-bold leading-tight tabular-nums mt-1 ${valueColor} print:text-black`}
      >
        {value}
      </div>
      <div className="text-[11px] text-ink-muted print:text-gray-700 mt-0.5">
        {sublabel}
      </div>
    </div>
  );
}
