'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { formatCents } from '@/lib/format';

type LineItem = {
  description: string;
  quantity: number;
  unit_price_cents: number | null;
  total_cents: number | null;
  confidence: 'high' | 'medium' | 'low';
  catalog_match: { id: string; code: string; name: string } | null;
};

type ParseResponse = {
  vendor: string;
  receipt_date: string | null;
  total_cents: number | null;
  total_reconciles: boolean;
  line_items: LineItem[];
};

type Stage = 'idle' | 'review' | 'done';

export function UploadFlow() {
  const [stage, setStage] = useState<Stage>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [applyMap, setApplyMap] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<{
    applied: number;
    created: number;
    skipped: number;
  } | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await fetch('/api/receipts/parse', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Parse failed');
      setParsed(json);
      const defaults: Record<number, boolean> = {};
      json.line_items.forEach((li: LineItem, i: number) => {
        defaults[i] = li.catalog_match != null;
      });
      setApplyMap(defaults);
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...parsed,
        line_items: parsed.line_items.map((li, i) => ({ ...li, apply: !!applyMap[i] })),
      };
      const res = await fetch('/api/receipts/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setResult({ applied: json.applied, created: json.created ?? 0, skipped: json.skipped });
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'idle') {
    return (
      <Card>
        <CardHeader title="Upload a receipt photo" />
        <CardBody>
          <form onSubmit={handleUpload} className="space-y-4">
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp,image/gif"
              required
              disabled={busy}
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-royal file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-royal/90"
            />
            <p className="text-xs text-ink-muted">
              JPEG, PNG, WebP, or GIF. Max 10MB. Photo is parsed in-memory and not stored
              (Drive integration lands in a follow-up).
            </p>
            <button
              type="submit"
              disabled={busy}
              className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {busy ? 'Parsing receipt…' : 'Parse with Claude'}
            </button>
            {error ? <p className="text-sm text-critical">{error}</p> : null}
          </form>
        </CardBody>
      </Card>
    );
  }

  if (stage === 'review' && parsed) {
    const matchedCount = parsed.line_items.filter((li) => li.catalog_match).length;
    return (
      <div className="space-y-4">
        <Card accentLeft="gold">
          <CardHeader
            eyebrow={parsed.vendor}
            title={parsed.receipt_date ?? 'Date not detected'}
            meta={
              <div className="text-right">
                <div className="text-sm">{formatCents(parsed.total_cents)}</div>
                <div className="text-[11px] text-ink-muted">
                  {parsed.total_reconciles ? 'reconciled' : 'totals do not match — review'}
                </div>
              </div>
            }
          />
          <CardBody>
            <div className="text-sm text-ink-muted">
              {parsed.line_items.length} line items detected ·{' '}
              <span className="text-filled font-semibold">{matchedCount} matched</span>{' '}
              ·{' '}
              <span className="text-low font-semibold">
                {parsed.line_items.length - matchedCount} unmatched
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Line items" meta="Check the ones to apply to inventory" />
          <CardBody className="space-y-2">
            {parsed.line_items.map((li, i) => (
              <label
                key={i}
                className={`flex items-start gap-3 rounded-lg border border-border-subtle px-3 py-3 ${
                  applyMap[i] ? 'bg-white/5' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!applyMap[i]}
                  onChange={(e) =>
                    setApplyMap((m) => ({ ...m, [i]: e.target.checked }))
                  }
                  className="mt-1 size-4 accent-royal"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{li.description}</div>
                  <div className="text-xs text-ink-muted">
                    qty {li.quantity}
                    {li.unit_price_cents != null
                      ? ` · ${formatCents(li.unit_price_cents)} ea`
                      : ''}
                    {li.total_cents != null ? ` · ${formatCents(li.total_cents)}` : ''}
                    {' · '}
                    <span
                      className={
                        li.confidence === 'high'
                          ? 'text-filled'
                          : li.confidence === 'medium'
                            ? 'text-low'
                            : 'text-critical'
                      }
                    >
                      {li.confidence}
                    </span>
                  </div>
                  {li.catalog_match ? (
                    <div className="text-xs text-filled mt-1">
                      → {li.catalog_match.code} · {li.catalog_match.name}
                    </div>
                  ) : (
                    <div className="text-xs text-low mt-1">
                      No catalog match — checking the box adds it as a new catalog item (Ingredient)
                    </div>
                  )}
                </div>
              </label>
            ))}
            <button
              type="button"
              onClick={handleApply}
              disabled={busy}
              className="bg-royal hover:bg-royal/90 text-white font-semibold w-full rounded-lg py-3 mt-2 disabled:opacity-50"
            >
              {busy
                ? 'Applying…'
                : `Apply ${Object.values(applyMap).filter(Boolean).length} items to inventory`}
            </button>
            {error ? <p className="text-sm text-critical">{error}</p> : null}
          </CardBody>
        </Card>
      </div>
    );
  }

  if (stage === 'done' && result) {
    return (
      <Card accentLeft="filled">
        <CardHeader title="Receipt applied" />
        <CardBody>
          <p className="text-sm text-ink-muted">
            {result.applied} item{result.applied === 1 ? '' : 's'} applied to inventory.
            {result.created > 0
              ? ` ${result.created} new catalog item${result.created === 1 ? '' : 's'} created.`
              : ''}
            {result.skipped > 0 ? ` ${result.skipped} skipped.` : ''}
          </p>
          <div className="flex gap-3 mt-4">
            <Link
              href="/"
              className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                setStage('idle');
                setParsed(null);
                setResult(null);
              }}
              className="border border-border-subtle hover:bg-white/5 font-semibold rounded-lg px-4 py-2"
            >
              Snap another
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return null;
}
