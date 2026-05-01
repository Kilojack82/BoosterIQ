import type { ScrapedSlot } from './signupgenius-scraper';

export type PasteParseResult = {
  ok: true;
  slots: ScrapedSlot[];
};

export type PasteParseFailure = {
  ok: false;
  reason: string;
};

/**
 * Parse a copy-pasted SignUp Genius roster into volunteer slots.
 *
 * V1 first pass uses a pure-text heuristic parser, not Claude API
 * (per DECISIONS.md D15 — Claude swap-in is a follow-up). The parser
 * recognizes the common copy-paste shape:
 *
 *   Role Name (optional time range)
 *   1. Person A
 *   2. (open)
 *   3. Person B
 *
 *   Another Role (optional time range)
 *   1. Person C
 *
 * Heuristics:
 *   - A line with no leading number is a candidate role header
 *   - A "1. Name" or "1. (open)" line is a slot
 *   - Empty lines reset role context
 *   - We require at least one slot under a role for the role to count
 */
export function parsePastedRoster(input: string): PasteParseResult | PasteParseFailure {
  const cleaned = input.replace(/\r\n/g, '\n').trim();
  if (!cleaned) {
    return { ok: false, reason: 'Empty paste' };
  }

  const lines = cleaned.split('\n').map((l) => l.trim());
  const slots: ScrapedSlot[] = [];
  let currentRole: string | null = null;

  for (const line of lines) {
    if (!line) {
      currentRole = null;
      continue;
    }

    const slotMatch = line.match(/^(\d+)[\.\)]\s*(.*)$/);
    if (slotMatch && currentRole) {
      const namePart = slotMatch[2]!.trim();
      const isOpen =
        namePart === '' ||
        /^\(?open\)?$/i.test(namePart) ||
        /^needed$/i.test(namePart) ||
        /^empty$/i.test(namePart);
      slots.push({
        role: currentRole,
        slot_position: Number(slotMatch[1]),
        filled_by_name: isOpen ? null : namePart,
      });
      continue;
    }

    // Anything else is a candidate role header. Strip trailing time ranges
    // like "(3:30 PM - 5:30 PM)" or " - Saturday".
    const headerCandidate = line
      .replace(/\s*\([^)]*\d{1,2}:\d{2}[^)]*\)\s*$/i, '')
      .replace(/\s+-\s+.*$/, '')
      .trim();
    if (headerCandidate && headerCandidate.length < 120) {
      currentRole = headerCandidate;
    }
  }

  if (slots.length === 0) {
    return {
      ok: false,
      reason: 'No volunteer slots detected. Format expected: a role header line, then numbered slots.',
    };
  }

  return { ok: true, slots };
}
