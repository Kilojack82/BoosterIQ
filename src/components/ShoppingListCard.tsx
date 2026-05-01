import { Card, CardBody, CardHeader } from './Card';
import { UrgencyTag } from './UrgencyTag';
import { urgencyClasses } from '@/lib/urgency';
import { PrintListButton } from './PrintListButton';
import type { ShoppingListRow } from '@/lib/dashboard-data';

export function ShoppingListCard({ rows }: { rows: ShoppingListRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader title="Shopping list" meta="Auto-generated" />
        <CardBody>
          <div className="text-ink-muted text-sm">
            Nothing below par right now. Add par levels to catalog items in
            the master sheet to populate this list.
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Shopping list" meta="Auto-generated" />
      <CardBody className="space-y-3">
        {rows.map((row) => {
          const c = urgencyClasses(row.urgency);
          return (
            <div
              key={row.id}
              className={`flex items-center justify-between gap-3 rounded-lg border-l-[3px] ${c.rowBg} ${c.rowBorder} px-4 py-3`}
            >
              <div className="min-w-0">
                <div className={`font-semibold truncate ${c.text}`}>{row.name}</div>
                <div className="text-xs text-ink-muted">
                  {row.reason === 'par'
                    ? `${row.current_stock} left · par ${row.par_level}`
                    : `Sold ${Math.abs(row.current_stock)} · no par tracked`}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm font-semibold ${c.text}`}>
                  Buy {row.buy_qty}
                </span>
                <UrgencyTag urgency={row.urgency} />
              </div>
            </div>
          );
        })}
        <PrintListButton />
      </CardBody>
    </Card>
  );
}
