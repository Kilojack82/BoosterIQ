import Link from 'next/link';
import { getDashboardData } from '@/lib/dashboard-data';
import { formatDate } from '@/lib/format';
import { AutoPrint, ReprintButton } from './AutoPrint';

export const metadata = { title: 'Shopping list · BoosterIQ' };
export const revalidate = 0;

export default async function ShoppingListPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const data = await getDashboardData(event);
  const generated = new Date().toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });

  return (
    <div className="min-h-screen bg-surface text-ink print:bg-white print:text-black">
      <AutoPrint />

      {/* Screen-only top bar */}
      <div className="border-b border-border-subtle print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← Dashboard
          </Link>
          <ReprintButton />
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 py-8 print:py-6 print:px-8 print:max-w-none">
        {/* Branded header */}
        <header className="mb-8 print:mb-6 print:break-inside-avoid">
          <div className="bg-royal print:bg-royal text-white rounded-2xl print:rounded-none px-6 py-5 flex items-center gap-5">
            <div className="size-14 rounded-full bg-navy ring-2 ring-gold flex items-center justify-center shrink-0">
              <span className="text-gold font-bold text-base tracking-tight">LV</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gold mb-0.5">
                Booster IQ · Shopping List
              </div>
              <h1 className="text-2xl font-bold leading-tight truncate">
                {data.latestEvent
                  ? data.latestEvent.name
                  : 'Lago Vista Vikings Booster'}
              </h1>
              <div className="text-xs text-white/80 mt-1">
                {data.latestEvent
                  ? `Based on ${formatDate(data.latestEvent.date)} sales`
                  : 'No event selected'}
                {' · '}
                Generated {generated}
              </div>
            </div>
          </div>
        </header>

        {data.shoppingList.length === 0 ? (
          <p className="text-sm text-ink-muted print:text-gray-700">
            Nothing to buy — every base-stock item is full.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6 print:break-inside-avoid">
              <Glance
                label="Distinct items"
                value={String(data.shoppingList.length)}
                sublabel="On the list"
              />
              <Glance
                label="Units to buy"
                value={String(
                  data.shoppingList.reduce((s, r) => s + r.buy_qty, 0),
                )}
                sublabel="Across all items"
              />
              <Glance
                label="Critical"
                value={String(
                  data.shoppingList.filter((r) => r.urgency === 'critical').length,
                )}
                sublabel="Out of stock"
                emphasize
              />
            </div>

            <section className="print:break-inside-avoid">
              <div className="grid grid-cols-[2.25rem_1fr_4rem_4rem_4rem] gap-x-3 text-[10px] uppercase tracking-[0.14em] text-ink-faint print:text-gray-700 font-semibold pb-2 px-3 border-b-2 border-royal print:border-black">
                <div className="text-center">✓</div>
                <div>Item</div>
                <div className="text-right">Sold</div>
                <div className="text-right">Left</div>
                <div className="text-right">Buy</div>
              </div>
              <div>
                {data.shoppingList.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[2.25rem_1fr_4rem_4rem_4rem] gap-x-3 items-center px-3 py-2 border-b border-border-subtle print:border-gray-300 print:break-inside-avoid"
                  >
                    <div className="size-5 rounded border border-ink-muted print:border-black mx-auto" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{row.name}</div>
                      {row.category ? (
                        <div className="text-[10px] text-ink-faint print:text-gray-600">
                          {row.category}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right tabular-nums text-ink-muted print:text-gray-700">
                      {row.sold_qty}
                    </div>
                    <div
                      className={`text-right tabular-nums ${
                        row.urgency === 'critical'
                          ? 'text-critical'
                          : row.urgency === 'low'
                            ? 'text-gold'
                            : ''
                      } print:text-black`}
                    >
                      {row.current_stock}
                    </div>
                    <div className="text-right tabular-nums font-bold text-skyblue print:text-black">
                      {row.buy_qty}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[2.25rem_1fr_4rem_4rem_4rem] gap-x-3 px-3 pt-3 mt-1 border-t-2 border-royal print:border-black">
                <div />
                <div className="text-xs uppercase tracking-wider text-ink-faint print:text-gray-700 font-semibold">
                  Totals
                </div>
                <div className="text-right tabular-nums font-bold">
                  {data.shoppingList.reduce((s, r) => s + r.sold_qty, 0)}
                </div>
                <div className="text-right tabular-nums font-bold">
                  {data.shoppingList.reduce((s, r) => s + r.current_stock, 0)}
                </div>
                <div className="text-right tabular-nums font-bold">
                  {data.shoppingList.reduce((s, r) => s + r.buy_qty, 0)}
                </div>
              </div>
            </section>
          </>
        )}

        <footer className="mt-10 pt-3 border-t-2 border-royal print:border-black flex items-center justify-between text-[11px] text-ink-muted print:text-gray-700">
          <span className="font-semibold tracking-wider uppercase">Booster IQ</span>
          <span>Lago Vista Vikings Booster Club</span>
          <span>{generated}</span>
        </footer>
      </article>
    </div>
  );
}

function Glance({
  label,
  value,
  sublabel,
  emphasize,
}: {
  label: string;
  value: string;
  sublabel: string;
  emphasize?: boolean;
}) {
  return (
    <div className="border border-border-subtle rounded-xl px-3 py-3 print:border-gray-400 print:break-inside-avoid">
      <div className="text-[10px] uppercase tracking-[0.15em] text-ink-muted print:text-gray-700">
        {label}
      </div>
      <div
        className={`text-[22px] font-bold leading-tight tabular-nums mt-1 ${
          emphasize ? 'text-critical' : 'text-skyblue'
        } print:text-black`}
      >
        {value}
      </div>
      <div className="text-[11px] text-ink-muted print:text-gray-700 mt-0.5">
        {sublabel}
      </div>
    </div>
  );
}
