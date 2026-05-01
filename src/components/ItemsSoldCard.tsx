import { Card, CardBody, CardHeader } from './Card';
import { formatCents } from '@/lib/format';
import type { ItemsSoldRow } from '@/lib/dashboard-data';

const GRID_COLS = 'grid grid-cols-[1fr_3rem_5rem] gap-x-3 items-baseline';

export function ItemsSoldCard({
  rows,
  totals,
  hasBaseStock,
  hasSalesImport,
}: {
  rows: ItemsSoldRow[];
  totals: { total_qty: number; total_net_sales_cents: number };
  hasBaseStock: boolean;
  hasSalesImport: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader title="Game Day Sales" meta="From Square reports" />
        <CardBody>
          <p className="text-sm text-ink-muted">
            {hasSalesImport
              ? 'No items were captured from the latest Square report.'
              : 'No Square reports uploaded yet. Upload one from the Square report tile and the breakdown will appear here.'}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Game Day Sales"
        meta={
          <span className="tabular-nums">
            {totals.total_qty} items · {formatCents(totals.total_net_sales_cents)}
          </span>
        }
      />
      <CardBody>
        {!hasBaseStock ? (
          <p className="text-xs text-low mb-3">
            Upload your master inventory with a Base Stock to turn this into a buy list
            with recommendations.
          </p>
        ) : null}

        <div className="text-sm">
          <div
            className={`${GRID_COLS} text-[11px] uppercase tracking-wider text-ink-faint border-b border-border-subtle pb-2 font-semibold`}
          >
            <div>Item</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Sales</div>
          </div>

          <div className="divide-y divide-border-subtle">
            {rows.map((r, i) => {
              const tier = qtyTier(i);
              return (
                <div key={r.id} className={`${GRID_COLS} py-2`}>
                  <div className="min-w-0">
                    <div className="truncate">{r.name}</div>
                    <div className="text-[11px] text-ink-faint flex items-center gap-2">
                      {r.category ? <span>{r.category}</span> : null}
                      {!r.is_tracked && hasBaseStock ? (
                        <span className="uppercase tracking-wider">· not tracked</span>
                      ) : null}
                    </div>
                  </div>
                  <div className={`text-right tabular-nums font-bold ${tier}`}>
                    {r.sold_qty}
                  </div>
                  <div className="text-right tabular-nums text-ink-muted">
                    {r.net_sales_cents > 0 ? formatCents(r.net_sales_cents) : '—'}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={`${GRID_COLS} pt-2 mt-1 border-t border-border-subtle`}
          >
            <div className="text-xs uppercase tracking-wider text-ink-faint font-semibold">
              Total
            </div>
            <div className="text-right tabular-nums font-bold">
              {totals.total_qty}
            </div>
            <div className="text-right tabular-nums font-bold">
              {formatCents(totals.total_net_sales_cents)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
          <Legend swatch="bg-royal" label="Top 5 sellers" />
          <Legend swatch="bg-gold" label="Next 5" />
          <Legend swatch="bg-cream" label="Rest" />
        </div>
      </CardBody>
    </Card>
  );
}

function qtyTier(index: number): string {
  if (index < 5) return 'text-royal';
  if (index < 10) return 'text-gold';
  return 'text-cream';
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-2 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
