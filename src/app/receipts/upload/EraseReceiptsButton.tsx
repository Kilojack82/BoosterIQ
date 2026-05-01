'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ClearResult = {
  receipts_removed: number;
  stock_movements_removed: number;
  catalog_items_restored: number;
};

export function EraseReceiptsButton({ receiptCount }: { receiptCount: number }) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'confirming' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClearResult | null>(null);

  async function handleErase() {
    setStage('busy');
    setError(null);
    try {
      const res = await fetch('/api/receipts/clear', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erase failed');
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
      <div className="bg-card border border-border-subtle rounded-xl px-5 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-ink-muted tracking-wider uppercase">
            Receipts on file
          </div>
          <div className="text-sm">
            {receiptCount} receipt{receiptCount === 1 ? '' : 's'} stored
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStage('confirming')}
          disabled={receiptCount === 0}
          className="text-sm font-semibold text-critical hover:underline disabled:text-ink-faint disabled:no-underline disabled:cursor-not-allowed"
        >
          Erase all receipts
        </button>
      </div>
    );
  }

  if (stage === 'confirming' || stage === 'busy') {
    return (
      <div className="bg-critical/10 border border-critical rounded-lg px-4 py-3 space-y-3">
        <div className="text-sm">
          <span className="font-semibold text-critical">
            Erase all {receiptCount} receipt{receiptCount === 1 ? '' : 's'}?
          </span>{' '}
          This deletes every receipt for the club and reverses the stock additions
          they made (subtracts those quantities back out of{' '}
          <code className="font-mono">current_stock</code>). Square sales and master
          inventory are not touched.
        </div>
        {error ? <div className="text-sm text-critical">{error}</div> : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleErase}
            disabled={stage === 'busy'}
            className="bg-critical hover:bg-critical/90 text-white font-semibold rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {stage === 'busy' ? 'Erasing…' : 'Yes, erase all receipts'}
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
      <div className="font-semibold text-filled mb-1">Receipts erased</div>
      <ul className="text-xs text-ink-muted list-disc list-inside space-y-0.5">
        <li>{result?.receipts_removed ?? 0} receipt(s) removed</li>
        <li>{result?.stock_movements_removed ?? 0} stock movements deleted</li>
        <li>{result?.catalog_items_restored ?? 0} items had stock reversed</li>
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
