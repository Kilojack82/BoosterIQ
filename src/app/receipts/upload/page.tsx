import Link from 'next/link';
import { createAdminClient } from '@/utils/supabase/admin';
import { UploadFlow } from './UploadFlow';
import { EraseReceiptsButton } from './EraseReceiptsButton';

export const metadata = { title: 'Snap receipt · BoosterIQ' };
export const revalidate = 0;

export default async function ReceiptUploadPage() {
  const supabase = createAdminClient();
  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('shortname', 'LakeVistaVikings')
    .single();
  let receiptCount = 0;
  if (club) {
    const { count } = await supabase
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', club.id);
    receiptCount = count ?? 0;
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold">Snap receipt</h1>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>
        <UploadFlow />
        <EraseReceiptsButton receiptCount={receiptCount} />
      </main>
    </div>
  );
}
