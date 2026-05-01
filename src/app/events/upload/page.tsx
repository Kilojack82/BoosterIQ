import Link from 'next/link';
import { CalendarUploadFlow } from './CalendarUploadFlow';

export const metadata = { title: 'Upload calendar · BoosterIQ' };

export default function CalendarUploadPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold">Upload calendar</h1>
          <Link href="/events" className="text-sm text-ink-muted hover:text-ink">
            ← All events
          </Link>
        </div>
        <CalendarUploadFlow />
      </main>
    </div>
  );
}
