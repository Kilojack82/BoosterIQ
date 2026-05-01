import Link from 'next/link';
import { Card, CardBody, CardHeader } from './Card';
import { UrgencyTag } from './UrgencyTag';
import { urgencyClasses } from '@/lib/urgency';
import { PrintListButton } from './PrintListButton';
import type { ShoppingListRow } from '@/lib/dashboard-data';

export function ShoppingListCard({
  rows,
  context,
}: {
  rows: ShoppingListRow[];
  context: { has_sales_import: boolean; has_base_stock: boolean };
}) {
  if (rows.length === 0) {
    let message: React.ReactNode;
    if (!context.has_sales_import && !context.has_base_stock) {
      message = (
        <>
          Two things needed: upload your master inventory with a Base Stock tab,
          and upload a Square sales report after a game.{' '}
          <Link href="/inventory" className="text-royal hover:underline">
            Master inventory →
          </Link>
        </>
      );
    } else if (!context.has_base_stock) {
      message = (
        <>
          Square sales are loaded, but no items are in your Base Stock yet. Add a{' '}
          <strong>Base Stock</strong> tab to your master inventory xlsx with the
          items you actually count (drinks, candy, snacks — not recipe items like
          burgers), then upload it on the{' '}
          <Link href="/inventory" className="text-royal hover:underline">
            Master inventory page
          </Link>
          .
        </>
      );
    } else if (!context.has_sales_import) {
      message = (
        <>
          Base stock is set, but no Square sales report has been uploaded yet.{' '}
          <Link href="/square/upload" className="text-royal hover:underline">
            Upload Square report →
          </Link>
        </>
      );
    } else {
      message = (
        <>
          No items in your Base Stock sold in the latest Square report. Either no
          sales hit a tracked item, or expand the Base Stock tab to include more
          of your active inventory.
        </>
      );
    }
    return (
      <Card>
        <CardHeader title="Shopping list" meta="Based on last game's sales" />
        <CardBody>
          <div className="text-ink-muted text-sm">{message}</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Shopping list" meta="Based on last game's sales" />
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
                  Sold {row.sold_qty} · {row.current_stock} left
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
