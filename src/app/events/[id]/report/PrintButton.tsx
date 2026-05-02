'use client';

import Link from 'next/link';

export function PrintButton({ eventId }: { eventId: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="border border-border-subtle hover:bg-white/5 text-ink font-semibold rounded-lg px-3 py-1.5 text-sm"
      >
        Print
      </button>
      <Link
        href={`/api/events/${eventId}/report.pdf`}
        prefetch={false}
        className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-3 py-1.5 text-sm"
      >
        Download PDF ↓
      </Link>
    </div>
  );
}
