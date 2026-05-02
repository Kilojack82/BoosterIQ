import { getDashboardData } from '@/lib/dashboard-data';
import { formatCents } from '@/lib/format';
import { Header } from '@/components/Header';
import { LatestEventCard } from '@/components/LatestEventCard';
import { KpiStrip } from '@/components/KpiStrip';
import { ItemsSoldCard } from '@/components/ItemsSoldCard';
import { ShoppingListCard } from '@/components/ShoppingListCard';
import { VolunteerCoverageCard } from '@/components/VolunteerCoverageCard';
import { QuickActionsCard } from '@/components/QuickActionsCard';
import { EventSwitcher } from '@/components/EventSwitcher';
import { Footer } from '@/components/Footer';

// Always fetch fresh — V1 has no caching layer.
export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const data = await getDashboardData(event);

  // KPI calculations — read what we have. Step 5 wires gross sales from
  // the latest Square import; step 4 wires receipts; receipts-this-week
  // can be added later as a follow-up.
  const grossSalesCents = data.latestSales?.total_net_sales_cents ?? 0;
  const grossTransactions = data.latestSales?.total_qty ?? 0;
  const reorderItems = data.shoppingList.length;
  const receiptsThisWeekCents = 0;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Header
          clubName={data.club.name}
          syncedLabel={`${data.counts.catalog_concessions} concession items · ${data.counts.catalog_merch} merch items synced`}
        />

        <EventSwitcher
          events={data.events}
          selectedEventId={data.selectedEventId}
        />

        <LatestEventCard event={data.latestEvent} />

        <KpiStrip
          items={[
            {
              label: 'Gross sales',
              value: formatCents(grossSalesCents),
              sublabel:
                grossTransactions === 0
                  ? 'No Square imports yet'
                  : `${grossTransactions} transactions`,
              tone: 'royal',
            },
            {
              label: 'Reorder needed',
              value: reorderItems === 0 ? '0 items' : `${reorderItems} items`,
              sublabel: data.upcomingEvent ? 'before next game' : 'when next game scheduled',
              tone: reorderItems > 0 ? 'critical' : 'royal',
            },
            {
              label: 'Receipts logged',
              value: String(data.counts.receipts),
              sublabel:
                data.counts.receipts === 0
                  ? 'Snap receipts to populate'
                  : `${formatCents(receiptsThisWeekCents)} spent this week`,
              tone: 'royal',
            },
          ]}
        />

        <ItemsSoldCard
          rows={data.itemsSold}
          totals={data.itemsSoldTotals}
          hasBaseStock={data.shoppingListContext.has_base_stock}
          hasSalesImport={data.shoppingListContext.has_sales_import}
        />

        <ShoppingListCard
          rows={data.shoppingList}
          context={data.shoppingListContext}
          eventId={data.selectedEventId}
        />

        <VolunteerCoverageCard
          upcomingEvent={data.upcomingEvent}
          coverage={data.volunteerCoverage}
        />

        <QuickActionsCard latestEventId={data.latestEvent?.id ?? null} />

        <Footer upcomingEvent={data.upcomingEvent} />
      </main>
    </div>
  );
}
