'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';

type Mode = 'url' | 'paste';

type SyncResponse = { total: number; filled: number; open: number; mode: Mode };

export function SyncFlow({
  eventId,
  initialUrl,
}: {
  eventId: string;
  initialUrl: string;
}) {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState(initialUrl);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResponse | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body =
        mode === 'url' ? { mode, url } : { mode, text: paste };
      const res = await fetch(`/api/events/${eventId}/volunteers/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Sync failed');
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Card accentLeft="filled">
        <CardHeader title="Roster synced" />
        <CardBody>
          <p className="text-sm">
            <span className="font-semibold">{result.total}</span> slots ·{' '}
            <span className="text-filled font-semibold">{result.filled} filled</span> ·{' '}
            <span className="text-low font-semibold">{result.open} open</span>
          </p>
          <p className="text-xs text-ink-muted mt-1">via {result.mode}</p>
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
                setResult(null);
                setError(null);
              }}
              className="border border-border-subtle hover:bg-white/5 font-semibold rounded-lg px-4 py-2"
            >
              Sync again
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Choose source" />
      <CardBody className="space-y-4">
        <div className="flex gap-2">
          <ModeButton active={mode === 'url'} onClick={() => setMode('url')}>
            From URL
          </ModeButton>
          <ModeButton active={mode === 'paste'} onClick={() => setMode('paste')}>
            Paste roster
          </ModeButton>
        </div>

        {mode === 'url' ? (
          <div>
            <label className="block text-xs text-ink-muted mb-1">SignUp Genius URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.signupgenius.com/go/..."
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-ink"
            />
            <p className="text-xs text-ink-muted mt-2">
              Public sign-up pages only. The scraper fetches the HTML and extracts roles +
              slots.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-ink-muted mb-1">Pasted roster</label>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={`Concession stand\n1. Sarah Smith\n2. (open)\n\nGrill\n1. Tom Davis`}
              rows={12}
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-ink font-mono text-sm"
            />
            <p className="text-xs text-ink-muted mt-2">
              Copy from the SignUp Genius page and paste here. Format: role header, then
              numbered slots. &quot;(open)&quot; or empty = unfilled.
            </p>
          </div>
        )}

        {error ? <p className="text-sm text-critical">{error}</p> : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || (mode === 'url' ? !url : !paste)}
          className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {busy ? 'Syncing…' : 'Sync roster'}
        </button>
      </CardBody>
    </Card>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? 'bg-royal text-white'
          : 'bg-card border border-border-subtle text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
