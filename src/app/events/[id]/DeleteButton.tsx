'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'confirming' | 'busy'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setStage('busy');
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Delete failed');
      router.push('/events');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStage('confirming');
    }
  }

  if (stage === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setStage('confirming')}
        className="text-sm font-semibold text-critical hover:underline"
      >
        Delete event
      </button>
    );
  }

  return (
    <div className="bg-critical/10 border border-critical rounded-lg px-4 py-3 space-y-3">
      <div className="text-sm">
        <span className="font-semibold text-critical">Delete {eventName}?</span> This
        removes the event row, its Square import, volunteer roster, and any receipts
        dated within 7 days before the event. Stock movements from those are reversed
        back into <code className="font-mono">current_stock</code>. This cannot be
        undone.
      </div>
      {error ? <div className="text-sm text-critical">{error}</div> : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={stage === 'busy'}
          className="bg-critical hover:bg-critical/90 text-white font-semibold rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {stage === 'busy' ? 'Deleting…' : 'Yes, delete event'}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage('idle');
            setError(null);
          }}
          disabled={stage === 'busy'}
          className="border border-border-subtle hover:bg-white/5 text-sm font-semibold rounded-lg px-3 py-1.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
