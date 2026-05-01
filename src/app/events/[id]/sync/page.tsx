import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/utils/supabase/admin';
import { SyncFlow } from './SyncFlow';

export const metadata = { title: 'Sync volunteers · BoosterIQ' };

export default async function EventSyncPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, name, opponent, date, signupgenius_url')
    .eq('id', id)
    .single();
  if (!event) notFound();

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold">Sync volunteer roster</h1>
            <div className="text-sm text-ink-muted">
              {event.name}
              {event.opponent ? ` vs. ${event.opponent}` : ''} · {event.date}
            </div>
          </div>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>
        <SyncFlow eventId={event.id} initialUrl={event.signupgenius_url ?? ''} />
      </main>
    </div>
  );
}
