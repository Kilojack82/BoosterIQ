import Link from 'next/link';
import { NewEventForm } from './NewEventForm';

export const metadata = { title: 'Add event · BoosterIQ' };

export default function NewEventPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold">Add event</h1>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>
        <NewEventForm />
      </main>
    </div>
  );
}
