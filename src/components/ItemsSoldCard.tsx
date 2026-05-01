import { Card, CardBody, CardHeader } from './Card';
import { formatCents } from '@/lib/format';
import type { ItemsSoldRow } from '@/lib/dashboard-data';

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
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-border-subtle">
            <tr>
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 font-semibold text-right">Qty</th>
              <th className="py-2 font-semibold text-right">Sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3 align-top">
                  <div className="truncate">{r.name}</div>
                  <div className="text-[11px] text-ink-faint flex items-center gap-2">
                    {r.category ? <span>{r.category}</span> : null}
                    {!r.is_tracked && hasBaseStock ? (
                      <span className="uppercase tracking-wider">· not tracked</span>
                    ) : null}
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums font-semibold">
                  {r.sold_qty}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {r.net_sales_cents > 0 ? formatCents(r.net_sales_cents) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border-subtle">
            <tr>
              <td className="py-2 text-xs uppercase tracking-wider text-ink-faint font-semibold">
                Total
              </td>
              <td className="py-2 text-right tabular-nums font-bold">
                {totals.total_qty}
              </td>
              <td className="py-2 text-right tabular-nums font-bold">
                {formatCents(totals.total_net_sales_cents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardBody>
    </Card>
  );
}
