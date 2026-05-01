'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ClearResult = {
  reconcile_movements_deleted: number;
  catalog_items_reset: number;
};

export function ClearInventoryButton() {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'confirming' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClearResult | null>(null);

  async function handleClear() {
    setStage('busy');
    setError(null);
    try {
      const res = await fetch('/api/inventory/clear', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Clear failed');
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
        Clear master inventory
      </button>
    );
  }

  if (stage === 'confirming' || stage === 'busy') {
    return (
      <div className="bg-critical/10 border border-critical rounded-lg px-4 py-3 space-y-3">
        <div className="text-sm">
          <span className="font-semibold text-critical">Clear master inventory?</span>{' '}
          This removes every Base Stock count and resets{' '}
          <code className="font-mono">current_stock</code> to 0 on all concession items.
          The shopping list will be empty until a new master inventory xlsx is uploaded.
          Catalog rows themselves are kept so Square sales still match by name.
        </div>
        {error ? <div className="text-sm text-critical">{error}</div> : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClear}
            disabled={stage === 'busy'}
            className="bg-critical hover:bg-critical/90 text-white font-semibold rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {stage === 'busy' ? 'Clearing…' : 'Yes, clear master inventory'}
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

  return (
    <div className="bg-filled/10 border border-filled rounded-lg px-4 py-3 text-sm">
      <div className="font-semibold text-filled mb-1">Master inventory cleared</div>
      <ul className="text-xs text-ink-muted list-disc list-inside space-y-0.5">
        <li>{result?.reconcile_movements_deleted ?? 0} base stock entries removed</li>
        <li>{result?.catalog_items_reset ?? 0} concession items reset to 0</li>
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
