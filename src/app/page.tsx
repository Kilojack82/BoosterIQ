import { getDashboardData } from '@/lib/dashboard-data';
import { formatCents } from '@/lib/format';
import { Header } from '@/components/Header';
import { LatestEventCard } from '@/components/LatestEventCard';
import { KpiStrip } from '@/components/KpiStrip';
import { ShoppingListCard } from '@/components/ShoppingListCard';
import { VolunteerCoverageCard } from '@/components/VolunteerCoverageCard';
import { QuickActionsCard } from '@/components/QuickActionsCard';
import { Footer } from '@/components/Footer';

// Always fetch fresh — V1 has no caching layer.
export const revalidate = 0;

export default async function DashboardPage() {
  const data = await getDashboardData();

  // KPI calculations — V1 reads what we have. Gross sales and "this week"
  // figures will become real once square_imports has data (build step 5)
  // and receipts (build step 4).
  const grossSalesCents = 0;
  const grossTransactions = 0;
  const reorderItems = data.shoppingList.length;
  const receiptsThisWeekCents = 0;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Header
          clubName={data.club.name}
          syncedLabel={`${data.counts.catalog_concessions} concession items · ${data.counts.catalog_merch} merch items synced`}
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

        <ShoppingListCard rows={data.shoppingList} />

        <VolunteerCoverageCard upcomingEvent={data.upcomingEvent} />

        <QuickActionsCard />

        <Footer upcomingEvent={data.upcomingEvent} />
      </main>
    </div>
  );
}
