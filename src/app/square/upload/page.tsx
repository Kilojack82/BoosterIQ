import Link from 'next/link';
import { createAdminClient } from '@/utils/supabase/admin';
import { UploadFlow } from './UploadFlow';

export const metadata = { title: 'Upload Square sales · BoosterIQ' };
export const revalidate = 0;

export default async function SquareUploadPage() {
  const supabase = createAdminClient();
  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('shortname', 'LakeVistaVikings')
    .single();
  const events = club
    ? (
        await supabase
          .from('events')
          .select('id, name, date, opponent')
          .eq('club_id', club.id)
          .order('date', { ascending: false })
          .limit(20)
      ).data ?? []
    : [];

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold">Upload Square sales</h1>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>
        <UploadFlow events={events} />
      </main>
    </div>
  );
}
