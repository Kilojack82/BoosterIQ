import ICAL from 'ical.js';

export type ParsedCalendarEvent = {
  name: string;
  date: string; // YYYY-MM-DD
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  description: string | null;
};

const HOME_HINTS = [
  /\bhome\b/i,
  /\bvs\.?\s+/i,
  /\bv\.?\s+/i,
];
const AWAY_HINTS = [/\baway\b/i, /\b@\s+/i, /\bat\s+/i];

const VIKINGS_HINTS = /\b(viking|lago vista|lv)\b/i;

/**
 * Try to extract opponent from a typical sports calendar title.
 * Patterns: "Vikings vs Cedar Park", "LV @ Lake Travis", "Lago Vista vs. Round Rock"
 */
function parseOpponentAndHomeAway(title: string): {
  opponent: string | null;
  is_home: boolean | null;
} {
  // "X vs Y" or "X v Y"
  const vsMatch = title.match(/(.+?)\s+vs?\.?\s+(.+)/i);
  // "X @ Y" or "X at Y"
  const atMatch = title.match(/(.+?)\s+(?:@|at)\s+(.+)/i);

  if (atMatch) {
    const left = atMatch[1]!.trim();
    const right = atMatch[2]!.trim();
    if (VIKINGS_HINTS.test(left)) {
      return { opponent: right, is_home: false };
    }
    if (VIKINGS_HINTS.test(right)) {
      return { opponent: left, is_home: true };
    }
    return { opponent: right, is_home: null };
  }
  if (vsMatch) {
    const left = vsMatch[1]!.trim();
    const right = vsMatch[2]!.trim();
    if (VIKINGS_HINTS.test(left)) {
      return { opponent: right, is_home: null };
    }
    if (VIKINGS_HINTS.test(right)) {
      return { opponent: left, is_home: null };
    }
    return { opponent: right, is_home: null };
  }
  return { opponent: null, is_home: null };
}

function inferHomeAway(
  title: string,
  location: string | null,
  baseGuess: boolean | null,
): boolean | null {
  if (baseGuess !== null) return baseGuess;
  if (HOME_HINTS.some((re) => re.test(title))) return true;
  if (AWAY_HINTS.some((re) => re.test(title))) return false;
  if (location && /\blago vista\b/i.test(location)) return true;
  return null;
}

export type CalendarParseResult =
  | {
      ok: true;
      events: ParsedCalendarEvent[];
      raw_event_count: number;
    }
  | { ok: false; reason: string };

/**
 * Parse an iCalendar (.ics) file. Extracts every VEVENT, attempts to
 * infer opponent and home/away from the title, and emits one
 * ParsedCalendarEvent per VEVENT.
 */
export function parseICalendar(text: string): CalendarParseResult {
  let jcal;
  try {
    jcal = ICAL.parse(text);
  } catch (err) {
    return { ok: false, reason: `Could not parse iCalendar: ${(err as Error).message}` };
  }
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents('vevent');
  if (vevents.length === 0) {
    return { ok: false, reason: 'No VEVENT entries found in calendar file' };
  }

  const events: ParsedCalendarEvent[] = [];
  for (const vevent of vevents) {
    const ev = new ICAL.Event(vevent);
    const summary = (ev.summary ?? '').trim();
    if (!summary) continue;
    const start = ev.startDate;
    if (!start) continue;
    const date = start.toString().slice(0, 10);
    const location = (ev.location ?? '').trim() || null;
    const description = (ev.description ?? '').trim() || null;

    const parsed = parseOpponentAndHomeAway(summary);
    const is_home = inferHomeAway(summary, location, parsed.is_home);

    events.push({
      name: summary,
      date,
      opponent: parsed.opponent,
      is_home,
      location,
      description,
    });
  }

  return { ok: true, events, raw_event_count: vevents.length };
}
