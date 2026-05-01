'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { formatCents } from '@/lib/format';

type EventOption = { id: string; name: string; date: string; opponent: string | null };

type MatchedRow = {
  item: string;
  variation: string | null;
  sku: string | null;
  category: string | null;
  qty: number;
  net_sales_cents: number;
  gross_sales_cents: number;
  menu_match: { id: string; square_item_name: string; variation: string | null } | null;
  catalog_match: { id: string; code: string; name: string } | null;
  match_strategy: 'sku' | 'name+variation' | 'none';
};

type SalesSummary = {
  gross_sales_cents: number | null;
  net_sales_cents: number | null;
  total_cents: number | null;
  cash_cents: number | null;
  card_cents: number | null;
  cashapp_cents: number | null;
  other_cents: number | null;
  giftcard_cents: number | null;
  fees_cents: number | null;
  net_total_cents: number | null;
};

type ParseResponse = {
  total_qty: number;
  total_net_sales_cents: number;
  total_gross_sales_cents: number;
  date_range: { start: string | null; end: string | null };
  raw_row_count: number;
  rows: MatchedRow[];
  summary: SalesSummary | null;
  parse_source: 'csv' | 'pdf';
};

type Stage = 'idle' | 'review' | 'done';

export function UploadFlow({ events }: { events: EventOption[] }) {
  const [stage, setStage] = useState<Stage>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [eventId, setEventId] = useState<string>(events[0]?.id ?? '');
  const [applyMap, setApplyMap] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<{
    depleted: number;
    skippedNoCatalog: number;
    skippedUserUnchecked: number;
    total_rows: number;
  } | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/square-imports/parse', { method: 'POST', body: fd });
      const text = await res.text();
      let json: ParseResponse | { error: string };
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 504
            ? 'Parse timed out. The items PDF may be too large for the platform timeout; try splitting it into a smaller date range.'
            : `Server returned status ${res.status} (non-JSON). Check Netlify function logs.`,
        );
      }
      if (!res.ok) throw new Error((json as { error: string }).error ?? 'Parse failed');
      const parsedResp = json as ParseResponse;
      const defaults: Record<number, boolean> = {};
      parsedResp.rows.forEach((r: MatchedRow, i: number) => {
        defaults[i] = !!r.catalog_match;
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
        event_id: eventId || null,
        total_qty: parsed.total_qty,
        total_net_sales_cents: parsed.total_net_sales_cents,
        total_gross_sales_cents: parsed.total_gross_sales_cents,
        date_range: parsed.date_range,
        rows: parsed.rows.map((r, i) => ({ ...r, apply: !!applyMap[i] })),
        summary: parsed.summary,
        parse_source: parsed.parse_source,
      };
      const res = await fetch('/api/square-imports/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setResult(json);
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
        <CardHeader title="Upload Square reports" />
        <CardBody>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-xs text-ink-muted mb-1">
                Items report (CSV or PDF) <span className="text-critical">*</span>
              </label>
              <input
                type="file"
                name="items"
                accept=".csv,text/csv,.pdf,application/pdf"
                required
                disabled={busy}
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-royal file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-royal/90"
              />
              <p className="text-xs text-ink-muted mt-1">
                Per-item sales detail. Either Square&apos;s CSV export or the PDF version
                from email/mobile.
              </p>
            </div>
            <div>
              <label className="block text-xs text-ink-muted mb-1">
                Sales summary PDF (optional)
              </label>
              <input
                type="file"
                name="summary"
                accept=".pdf,application/pdf"
                disabled={busy}
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-royal/40 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-royal/60"
              />
              <p className="text-xs text-ink-muted mt-1">
                Adds Cash/Card/Cash App breakdown + fees. Cross-checked against the items
                total.
              </p>
            </div>
            <div>
              <label className="block text-xs text-ink-muted mb-1">
                Attach to event (optional)
              </label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={busy}
                className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-ink"
              >
                <option value="">— No event selected —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                    {ev.opponent ? ` vs. ${ev.opponent}` : ''} · {ev.date}
                  </option>
                ))}
              </select>
              {events.length === 0 ? (
                <p className="text-xs text-ink-muted mt-2">
                  No events yet —{' '}
                  <Link href="/events/new" className="text-royal hover:underline">
                    add one
                  </Link>{' '}
                  if you want this report linked to a specific game.
                </p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {busy ? 'Parsing…' : 'Parse reports'}
            </button>
            {error ? <p className="text-sm text-critical">{error}</p> : null}
          </form>
        </CardBody>
      </Card>
    );
  }

  if (stage === 'review' && parsed) {
    const matched = parsed.rows.filter((r) => r.catalog_match).length;
    const unmapped = parsed.rows.filter((r) => !r.menu_match).length;
    const recipeOnly = parsed.rows.filter((r) => r.menu_match && !r.catalog_match).length;
    const range =
      parsed.date_range.start && parsed.date_range.end
        ? parsed.date_range.start === parsed.date_range.end
          ? parsed.date_range.start
          : `${parsed.date_range.start} → ${parsed.date_range.end}`
        : 'Date range not detected';

    const summary = parsed.summary;
    const reconcilesGap =
      summary?.net_sales_cents != null
        ? parsed.total_net_sales_cents - summary.net_sales_cents
        : null;
    const reconcilesOk = reconcilesGap == null || Math.abs(reconcilesGap) <= 50;

    return (
      <div className="space-y-4">
        <Card accentLeft="gold">
          <CardHeader
            eyebrow={`Square sales · parsed from ${parsed.parse_source.toUpperCase()}`}
            title={range}
            meta={
              <div className="text-right">
                <div className="text-sm">{formatCents(parsed.total_net_sales_cents)}</div>
                <div className="text-[11px] text-ink-muted">
                  {parsed.total_qty} items · {parsed.raw_row_count} transactions
                </div>
              </div>
            }
          />
          <CardBody>
            <div className="text-sm text-ink-muted">
              {parsed.rows.length} unique items ·{' '}
              <span className="text-filled font-semibold">{matched} deplete inventory</span>
              {recipeOnly > 0 ? (
                <>
                  {' · '}
                  <span className="text-low font-semibold">
                    {recipeOnly} recipe-only (no auto-deplete)
                  </span>
                </>
              ) : null}
              {unmapped > 0 ? (
                <>
                  {' · '}
                  <span className="text-critical font-semibold">{unmapped} unmapped</span>
                </>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {summary ? (
          <Card accentLeft={reconcilesOk ? 'filled' : 'critical'}>
            <CardHeader
              title="Sales summary"
              meta={
                <div className="text-right">
                  <div className="text-sm">{formatCents(summary.net_total_cents)}</div>
                  <div className="text-[11px] text-ink-muted">net after fees</div>
                </div>
              }
            />
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                {summary.gross_sales_cents != null ? (
                  <SummaryRow label="Gross sales" value={summary.gross_sales_cents} />
                ) : null}
                {summary.net_sales_cents != null ? (
                  <SummaryRow label="Net sales" value={summary.net_sales_cents} />
                ) : null}
                {summary.cash_cents != null ? (
                  <SummaryRow label="Cash" value={summary.cash_cents} />
                ) : null}
                {summary.card_cents != null ? (
                  <SummaryRow label="Card" value={summary.card_cents} />
                ) : null}
                {summary.cashapp_cents != null ? (
                  <SummaryRow label="Cash App" value={summary.cashapp_cents} />
                ) : null}
                {summary.fees_cents != null ? (
                  <SummaryRow label="Fees" value={summary.fees_cents} negative />
                ) : null}
              </div>
              {!reconcilesOk && reconcilesGap != null ? (
                <p className="text-xs text-critical mt-3">
                  Items net sales ({formatCents(parsed.total_net_sales_cents)}) and Sales
                  Summary net ({formatCents(summary.net_sales_cents)}) differ by{' '}
                  {formatCents(Math.abs(reconcilesGap))}. Spot-check before applying.
                </p>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Items"
            meta="Check rows to apply depletion. Top sales first."
          />
          <CardBody className="space-y-2">
            {parsed.rows.map((row, i) => {
              const status: 'will-deplete' | 'recipe' | 'unmapped' = !row.menu_match
                ? 'unmapped'
                : !row.catalog_match
                  ? 'recipe'
                  : 'will-deplete';
              return (
                <label
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border border-border-subtle px-3 py-3 ${
                    applyMap[i] ? 'bg-white/5' : ''
                  } ${status === 'will-deplete' ? '' : 'opacity-70'}`}
                >
                  <input
                    type="checkbox"
                    checked={!!applyMap[i]}
                    disabled={status !== 'will-deplete'}
                    onChange={(e) =>
                      setApplyMap((m) => ({ ...m, [i]: e.target.checked }))
                    }
                    className="mt-1 size-4 accent-royal"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {row.item}
                      {row.variation ? (
                        <span className="text-ink-muted font-normal"> · {row.variation}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-ink-muted">
                      qty {row.qty} · {formatCents(row.net_sales_cents)}
                      {row.sku ? ` · SKU ${row.sku}` : ''}
                      {row.category ? ` · ${row.category}` : ''}
                    </div>
                    {status === 'will-deplete' && row.catalog_match ? (
                      <div className="text-xs text-filled mt-1">
                        Will deplete {row.qty} from {row.catalog_match.code}{' '}
                        {row.catalog_match.name} ·{' '}
                        <span className="text-ink-faint">via {row.match_strategy}</span>
                      </div>
                    ) : status === 'recipe' ? (
                      <div className="text-xs text-low mt-1">
                        Menu item exists ({row.menu_match!.square_item_name}) but no catalog
                        link — counted in sales, not depleted (recipes are V2)
                      </div>
                    ) : (
                      <div className="text-xs text-critical mt-1">
                        Not in menu_items. Add via master sheet then re-run seed, or map
                        manually in Supabase
                      </div>
                    )}
                  </div>
                </label>
              );
            })}

            <button
              type="button"
              onClick={handleApply}
              disabled={busy}
              className="bg-royal hover:bg-royal/90 text-white font-semibold w-full rounded-lg py-3 mt-2 disabled:opacity-50"
            >
              {busy
                ? 'Applying…'
                : `Apply depletion to ${Object.values(applyMap).filter(Boolean).length} items`}
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
        <CardHeader title="Sales applied" />
        <CardBody>
          <p className="text-sm text-ink-muted">
            {result.depleted} item{result.depleted === 1 ? '' : 's'} depleted from inventory.
            {result.skippedNoCatalog > 0
              ? ` ${result.skippedNoCatalog} not auto-depleted (recipe-only or unmapped).`
              : ''}
            {result.skippedUserUnchecked > 0
              ? ` ${result.skippedUserUnchecked} unchecked.`
              : ''}
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
                setApplyMap({});
              }}
              className="border border-border-subtle hover:bg-white/5 font-semibold rounded-lg px-4 py-2"
            >
              Upload another
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return null;
}

function SummaryRow({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-border-subtle py-1">
      <span className="text-ink-muted text-xs">{label}</span>
      <span className={`tabular-nums font-semibold ${negative ? 'text-critical' : ''}`}>
        {formatCents(value)}
      </span>
    </div>
  );
}
