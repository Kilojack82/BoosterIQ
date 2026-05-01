'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';

export function NewEventForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get('name') || '').trim(),
      opponent: String(fd.get('opponent') || '').trim() || null,
      is_home: fd.get('is_home') === 'home' ? true : fd.get('is_home') === 'away' ? false : null,
      date: String(fd.get('date') || '').trim(),
      signupgenius_url: String(fd.get('signupgenius_url') || '').trim() || null,
    };

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Insert failed');
      router.push(payload.signupgenius_url ? `/events/${json.id}/sync` : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="New event" meta="Vikings booster" />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Event name" required>
            <input
              type="text"
              name="name"
              required
              placeholder="Vikings vs. Cedar Park"
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-ink"
            />
          </Field>
          <Field label="Opponent">
            <input
              type="text"
              name="opponent"
              placeholder="Cedar Park"
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-ink"
            />
          </Field>
          <Field label="Home or away">
            <select
              name="is_home"
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-ink"
              defaultValue=""
            >
              <option value="">—</option>
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </Field>
          <Field label="Date" required>
            <input
              type="date"
              name="date"
              required
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-ink"
            />
          </Field>
          <Field label="SignUp Genius URL">
            <input
              type="url"
              name="signupgenius_url"
              placeholder="https://www.signupgenius.com/go/..."
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-ink"
            />
          </Field>
          {error ? <p className="text-sm text-critical">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save event'}
          </button>
        </form>
      </CardBody>
    </Card>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs text-ink-muted mb-1">
        {label}
        {required ? ' *' : ''}
      </div>
      {children}
    </label>
  );
}
