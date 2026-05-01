import * as cheerio from 'cheerio';

export type ScrapedSlot = {
  role: string;
  slot_position: number;
  filled_by_name: string | null;
};

export type ScrapeResult = {
  ok: true;
  slots: ScrapedSlot[];
  raw_html_length: number;
};

export type ScrapeFailure = {
  ok: false;
  reason: string;
  raw_html_length: number;
};

/**
 * Scrape a public SignUp Genius URL into volunteer slots.
 *
 * SignUp Genius public pages render server-side. The structure varies
 * across page templates, so we look for the most stable patterns:
 *   - role headers: typically <strong>, <h3>, or <td class="SUGitem">
 *   - slot lines: text rows under each role with either a name or "(open)"
 *
 * Be defensive: if parsing fails, return the failure and let the caller
 * surface "couldn't sync — last known data shown" UX (per BUILD_BRIEF.md).
 */
export async function scrapeSignUpGenius(url: string): Promise<ScrapeResult | ScrapeFailure> {
  if (!/^https?:\/\/(www\.)?signupgenius\.com\//i.test(url)) {
    return { ok: false, reason: 'Not a SignUp Genius URL', raw_html_length: 0 };
  }

  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 BoosterIQ/1.0',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    const html = await response.text();
    return {
      ok: false,
      reason: `HTTP ${response.status} from SignUp Genius`,
      raw_html_length: html.length,
    };
  }

  const html = await response.text();
  return parseScrapedHtml(html);
}

/**
 * Exposed separately so tests can pass canned HTML without a fetch.
 */
export function parseScrapedHtml(html: string): ScrapeResult | ScrapeFailure {
  const $ = cheerio.load(html);
  const slots: ScrapedSlot[] = [];

  // SignUp Genius's modern public-page template uses a sign-up table where
  // each role section starts with a "SUGitem" or class containing "item",
  // and slots underneath. We try a couple of selectors in priority order.
  const roleHeaders = $(
    '[class*="SUGitem"], [class*="signupItem"], [data-test*="signup-item"], h2, h3, strong',
  );

  let currentRole: string | null = null;

  // Walk all elements in document order so role headers and their slot
  // lines stay in sequence.
  $('body *').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (!text) return;

    const matchesHeader = roleHeaders.is(el);
    if (matchesHeader && text.length > 0 && text.length < 120) {
      if (!/^\d+\.\s/.test(text) && !/\(open\)/i.test(text)) {
        currentRole = text;
      }
      return;
    }

    if (!currentRole) return;

    // Slot lines: "1. Name", "2. (open)", or just a name in a cell.
    const slotMatch = text.match(/^(\d+)\.\s*(.+)$/);
    if (slotMatch) {
      const namePart = slotMatch[2]!.trim();
      const isOpen = /^\(open\)$/i.test(namePart) || namePart === '';
      slots.push({
        role: currentRole,
        slot_position: Number(slotMatch[1]),
        filled_by_name: isOpen ? null : namePart,
      });
    }
  });

  if (slots.length === 0) {
    return {
      ok: false,
      reason: 'No volunteer slots found in HTML — page structure may have changed',
      raw_html_length: html.length,
    };
  }

  return { ok: true, slots, raw_html_length: html.length };
}
