import { Card, CardBody, CardHeader } from './Card';
import { formatCents } from '@/lib/format';
import type { ItemsSoldRow } from '@/lib/dashboard-data';

export function ItemsSoldCard({
  rows,
  totals,
  hasBaseStock,
}: {
  rows: ItemsSoldRow[];
  totals: { total_qty: number; total_net_sales_cents: number };
  hasBaseStock: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Items sold last game"
        meta={
          <span className="tabular-nums">
            {totals.total_qty} items · {formatCents(totals.total_net_sales_cents)}
          </span>
        }
      />
      <CardBody>
        {!hasBaseStock ? (
          <p className="text-xs text-low mb-3">
            Upload your master inventory with a Base Stock to turn this list into a buy
            list with recommendations.
          </p>
        ) : null}
        <div className="space-y-1">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-border-subtle last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{r.name}</div>
                {r.category ? (
                  <div className="text-[11px] text-ink-faint">{r.category}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!r.is_tracked && hasBaseStock ? (
                  <span className="text-[10px] text-ink-faint uppercase tracking-wider">
                    not tracked
                  </span>
                ) : null}
                <span className="text-sm font-semibold tabular-nums">{r.sold_qty}</span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
