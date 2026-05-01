import Link from 'next/link';
import { createAdminClient } from '@/utils/supabase/admin';
import { UploadFlow } from './UploadFlow';
import { ClearInventoryButton } from './ClearInventoryButton';

export const metadata = { title: 'Master Inventory · BoosterIQ' };
export const revalidate = 0;

export default async function InventoryPage() {
  const supabase = createAdminClient();
  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('shortname', 'LakeVistaVikings')
    .single();
  if (!club) {
    return <div className="p-8">Club not found</div>;
  }

  const [counts, baseStocked] = await Promise.all([
    Promise.all([
      supabase
        .from('catalog_items')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('is_merch', false),
      supabase
        .from('catalog_items')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('is_merch', true),
      supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id),
    ]),
    supabase
      .from('stock_movements')
      .select('catalog_item_id', { count: 'exact', head: true })
      .eq('source_type', 'reconcile'),
  ]);

  const [concessionsRes, merchRes, menuRes] = counts;
  const distinctTrackedRes = await supabase
    .from('stock_movements')
    .select('catalog_item_id')
    .eq('source_type', 'reconcile');
  const distinctTracked = new Set(
    (distinctTrackedRes.data ?? []).map((r) => r.catalog_item_id),
  ).size;

  // Sample of recent base-stock-tracked items for display
  const { data: tracked } = await supabase
    .from('catalog_items')
    .select(
      'code, name, category, current_stock, par_level, is_merch, stock_movements!inner(occurred_at, source_type)',
    )
    .eq('club_id', club.id)
    .eq('is_merch', false)
    .eq('stock_movements.source_type', 'reconcile')
    .order('name')
    .limit(50);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold">Master inventory</h1>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Concession items" value={String(concessionsRes.count ?? 0)} />
          <Stat label="Merch items" value={String(merchRes.count ?? 0)} />
          <Stat label="Menu items (Square)" value={String(menuRes.count ?? 0)} />
        </div>

        <div className="bg-card border border-border-subtle rounded-xl px-5 py-5 space-y-2">
          <div className="text-xs text-ink-muted tracking-wider uppercase">Base stock</div>
          <div className="text-2xl font-bold text-royal">{distinctTracked} items tracked</div>
          <div className="text-xs text-ink-muted">
            Items with a counted Base Stock entry. Only these appear on the dashboard
            shopping list. Add or update counts by including a <strong>Base Stock</strong>{' '}
            tab in your master inventory xlsx with columns{' '}
            <code className="font-mono">Item ID</code> and{' '}
            <code className="font-mono">Counted Quantity</code>.
          </div>
        </div>

        <UploadFlow />

        {distinctTracked > 0 ? (
          <div className="bg-card border border-border-subtle rounded-xl px-5 py-4">
            <ClearInventoryButton />
          </div>
        ) : null}

        {tracked && tracked.length > 0 ? (
          <div className="bg-card border border-border-subtle rounded-xl px-5 py-5">
            <div className="text-xs text-ink-muted tracking-wider uppercase mb-3">
              Recently counted items (showing up to 50)
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-ink-muted">
                <tr>
                  <th className="pb-2 font-semibold">Code</th>
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold text-right">Stock</th>
                  <th className="pb-2 font-semibold text-right">Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {tracked.map((t) => (
                  <tr key={t.code}>
                    <td className="py-2 text-ink-muted">{t.code}</td>
                    <td className="py-2">{t.name}</td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        t.current_stock <= 0 ? 'text-critical font-semibold' : ''
                      }`}
                    >
                      {t.current_stock}
                    </td>
                    <td className="py-2 text-right tabular-nums text-ink-muted">
                      {t.par_level ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border-subtle rounded-xl px-4 py-4">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="text-2xl font-bold text-royal mt-1">{value}</div>
    </div>
  );
}
