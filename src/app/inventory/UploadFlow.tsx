'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Result = {
  catalog_concessions: number;
  catalog_merch: number;
  menu_items: number;
  menu_items_matched: number;
  base_stock_applied: number;
  base_stock_skipped: number;
  settings_fields_updated: number;
};

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
          Excel (.xlsx) with tabs: Catalog, Apparel &amp; Merch, Menu, Settings, and an
          optional <strong>Base Stock</strong> tab for current physical counts. Uploading
          replaces existing data; existing rows are upserted by code.
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

      {result ? (
        <div className="bg-filled/10 border border-filled rounded-lg px-3 py-3 text-sm space-y-1">
          <div className="text-filled font-semibold">Import complete</div>
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
