'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type SimpleResult = {
  format: 'simple';
  total_rows: number;
  matched_by_code: number;
  matched_by_name: number;
  created: number;
  base_stock_applied: number;
  skipped: number;
  skipped_reasons: string[];
};

type MasterResult = {
  format: 'master';
  catalog_concessions: number;
  catalog_merch: number;
  menu_items: number;
  menu_items_matched: number;
  base_stock_applied: number;
  base_stock_skipped: number;
  settings_fields_updated: number;
};

type Result = SimpleResult | MasterResult;

export function UploadFlow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/inventory/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setResult(json);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card border border-border-subtle rounded-xl px-5 py-5 space-y-4">
      <div>
        <div className="text-xs text-ink-muted tracking-wider uppercase mb-1">
          Upload master inventory
        </div>
        <p className="text-sm text-ink-muted">
          Recommended format: a one-page xlsx with two columns —{' '}
          <code className="font-mono">Item Name</code> and{' '}
          <code className="font-mono">Base Stock</code>. Items match by name to your
          existing catalog. Unknown names are added as new catalog rows automatically.
        </p>
        <p className="text-xs text-ink-muted mt-2">
          Full master-sheet format (with Catalog / Menu / Apparel / Settings tabs) still
          works if uploaded — auto-detected.
        </p>
      </div>

      <form onSubmit={handleUpload} className="space-y-3">
        <input
          type="file"
          name="xlsx"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={busy}
          className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-royal file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-royal/90"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Import master inventory'}
        </button>
        {error ? <p className="text-sm text-critical">{error}</p> : null}
      </form>

      {result?.format === 'simple' ? (
        <div className="bg-filled/10 border border-filled rounded-lg px-3 py-3 text-sm space-y-1">
          <div className="text-filled font-semibold">Base stock import complete</div>
          <div className="text-ink-muted text-xs space-y-0.5">
            <div>{result.total_rows} rows scanned</div>
            <div>{result.base_stock_applied} base stock counts applied</div>
            <div>
              {result.matched_by_code} matched by Item ID ·{' '}
              {result.matched_by_name} matched by name · {result.created} created
            </div>
            {result.skipped > 0 ? (
              <div className="text-critical">
                {result.skipped} skipped
                {result.skipped_reasons.length > 0 ? (
                  <ul className="list-disc list-inside mt-1">
                    {result.skipped_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {result?.format === 'master' ? (
        <div className="bg-filled/10 border border-filled rounded-lg px-3 py-3 text-sm space-y-1">
          <div className="text-filled font-semibold">Master sheet import complete</div>
          <div className="text-ink-muted text-xs space-y-0.5">
            <div>{result.catalog_concessions} concession items</div>
            <div>{result.catalog_merch} merch items</div>
            <div>
              {result.menu_items} menu items ({result.menu_items_matched} linked to
              catalog)
            </div>
            <div>
              {result.base_stock_applied} base stock counts applied
              {result.base_stock_skipped > 0
                ? ` · ${result.base_stock_skipped} skipped (unknown Item ID)`
                : ''}
            </div>
            <div>{result.settings_fields_updated} club settings updated</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
