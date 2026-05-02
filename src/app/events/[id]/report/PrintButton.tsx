'use client';

import Link from 'next/link';

export function PrintButton({ eventId }: { eventId: string }) {
  const inlineUrl = `/api/events/${eventId}/report.pdf?inline=1`;
  const downloadUrl = `/api/events/${eventId}/report.pdf`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={inlineUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="border border-border-subtle hover:bg-white/5 text-ink font-semibold rounded-lg px-3 py-1.5 text-sm"
      >
        Print
      </a>
      <Link
        href={downloadUrl}
        prefetch={false}
        className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-3 py-1.5 text-sm"
      >
        Download PDF ↓
      </Link>
    </div>
  );
}
