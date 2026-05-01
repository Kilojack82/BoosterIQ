'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ResetResult = {
  square_imports_removed: number;
  stock_movements_removed: number;
  catalog_items_restored: number;
  volunteer_slots_removed: number;
};

export function ResetButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'confirming' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);

  async function handleReset() {
    setStage('busy');
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/reset`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Reset failed');
      setResult(json);
      setStage('done');
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
        Reset event data
      </button>
    );
  }

  if (stage === 'confirming' || stage === 'busy') {
    return (
      <div className="bg-critical/10 border border-critical rounded-lg px-4 py-3 space-y-3">
        <div className="text-sm">
          <span className="font-semibold text-critical">Reset {eventName}?</span> This
          deletes the Square sales import and volunteer roster for this event, and adds
          the depleted quantities back to <code className="font-mono">current_stock</code>.
          The event itself stays so you can re-upload. Receipts are not touched.
        </div>
        {error ? <div className="text-sm text-critical">{error}</div> : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={stage === 'busy'}
            className="bg-critical hover:bg-critical/90 text-white font-semibold rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {stage === 'busy' ? 'Resetting…' : 'Yes, reset event data'}
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

  // done
  return (
    <div className="bg-filled/10 border border-filled rounded-lg px-4 py-3 text-sm">
      <div className="font-semibold text-filled mb-1">Reset complete</div>
      <ul className="text-xs text-ink-muted list-disc list-inside space-y-0.5">
        <li>{result?.square_imports_removed ?? 0} Square import(s) removed</li>
        <li>{result?.stock_movements_removed ?? 0} sales movements deleted</li>
        <li>{result?.catalog_items_restored ?? 0} items had stock restored</li>
        <li>{result?.volunteer_slots_removed ?? 0} volunteer slots cleared</li>
      </ul>
      <button
        type="button"
        onClick={() => {
          setStage('idle');
          setResult(null);
        }}
        className="text-xs text-royal hover:underline mt-2"
      >
        Done
      </button>
    </div>
  );
}
