import { Card, CardBody, CardHeader } from './Card';
import { formatCents } from '@/lib/format';
import type { ItemsSoldRow } from '@/lib/dashboard-data';

const GRID_COLS = 'grid grid-cols-[1fr_3rem_5rem] gap-x-3 items-baseline';
const ROW_FRAME = 'rounded-lg border-l-[3px] px-4 py-3';

type Tier = {
  rowBg: string;
  rowBorder: string;
  text: string;
};

function tierFor(index: number): Tier {
  if (index < 5) {
    return { rowBg: 'bg-royal/15', rowBorder: 'border-royal', text: 'text-royal' };
  }
  if (index < 10) {
    return { rowBg: 'bg-gold/15', rowBorder: 'border-gold', text: 'text-gold' };
  }
  return { rowBg: 'bg-cream/10', rowBorder: 'border-cream', text: 'text-cream' };
}

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

        <div className="text-sm space-y-2">
          <div
            className={`${GRID_COLS} text-[11px] uppercase tracking-wider text-ink-faint font-semibold px-4 border-l-[3px] border-transparent`}
          >
            <div>Item</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Sales</div>
          </div>

          {rows.map((r, i) => {
            const tier = tierFor(i);
            return (
              <div
                key={r.id}
                className={`${GRID_COLS} ${ROW_FRAME} ${tier.rowBg} ${tier.rowBorder}`}
              >
                <div className="min-w-0">
                  <div className={`font-semibold truncate ${tier.text}`}>{r.name}</div>
                  <div className="text-[11px] text-ink-faint flex items-center gap-2">
                    {r.category ? <span>{r.category}</span> : null}
                    {!r.is_tracked && hasBaseStock ? (
                      <span className="uppercase tracking-wider">· not tracked</span>
                    ) : null}
                  </div>
                </div>
                <div className={`text-right tabular-nums font-bold ${tier.text}`}>
                  {r.sold_qty}
                </div>
                <div className={`text-right tabular-nums font-semibold ${tier.text}`}>
                  {r.net_sales_cents > 0 ? formatCents(r.net_sales_cents) : '—'}
                </div>
              </div>
            );
          })}

          <div
            className={`${GRID_COLS} px-4 pt-2 mt-1 border-l-[3px] border-transparent border-t border-t-border-subtle`}
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

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-2 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
