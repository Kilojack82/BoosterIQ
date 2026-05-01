'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/Card';

type Result = {
  raw_event_count: number;
  total_parsed: number;
  created: number;
  duplicates_skipped: number;
};

export function CalendarUploadFlow() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/events/upload-calendar', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Upload an iCalendar (.ics) file" />
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-muted">
          Export your school&apos;s sports calendar from Google Calendar (settings → export
          calendar) or any iCalendar-compatible source. We&apos;ll create one event per
          VEVENT, infer opponent and home/away from the title, and skip duplicates that
          already match an existing event by name + date.
        </p>

        <form onSubmit={handleUpload} className="space-y-3">
          <input
            type="file"
            name="ics"
            accept=".ics,text/calendar"
            required
            disabled={busy}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-royal file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-royal/90"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Importing…' : 'Import calendar'}
          </button>
          {error ? <p className="text-sm text-critical">{error}</p> : null}
        </form>

        {result ? (
          <div className="bg-filled/10 border border-filled rounded-lg px-3 py-3 text-sm space-y-1">
            <div className="text-filled font-semibold">Calendar imported</div>
            <div className="text-ink-muted text-xs space-y-0.5">
              <div>{result.raw_event_count} events found in file</div>
              <div>{result.created} new events created</div>
              {result.duplicates_skipped > 0 ? (
                <div>
                  {result.duplicates_skipped} duplicates skipped (already in your calendar)
                </div>
              ) : null}
            </div>
            <Link
              href="/events"
              className="inline-block bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-3 py-1.5 text-xs mt-2"
            >
              View all events →
            </Link>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
