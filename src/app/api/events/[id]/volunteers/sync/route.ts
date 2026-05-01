import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { scrapeSignUpGenius } from '@/lib/signupgenius-scraper';
import { parsePastedRoster } from '@/lib/signupgenius-paste-parser';
import type { ScrapedSlot } from '@/lib/signupgenius-scraper';

export const runtime = 'nodejs';
export const maxDuration = 60;

type SyncBody =
  | { mode: 'url'; url: string }
  | { mode: 'paste'; text: string };

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as SyncBody;

    let slots: ScrapedSlot[];
    if (body.mode === 'url') {
      const result = await scrapeSignUpGenius(body.url);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.reason, raw_html_length: result.raw_html_length },
          { status: 422 },
        );
      }
      slots = result.slots;
    } else if (body.mode === 'paste') {
      const result = parsePastedRoster(body.text);
      if (!result.ok) {
        return NextResponse.json({ error: result.reason }, { status: 422 });
      }
      slots = result.slots;
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Confirm the event exists before clearing its slots
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', id)
      .single();
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Replace the volunteer_slots set for this event (idempotent sync)
    const { error: delErr } = await supabase
      .from('volunteer_slots')
      .delete()
      .eq('event_id', id);
    if (delErr) {
      return NextResponse.json({ error: `delete failed: ${delErr.message}` }, { status: 500 });
    }

    if (slots.length > 0) {
      const rows = slots.map((s) => ({
        event_id: id,
        role: s.role,
        slot_position: s.slot_position,
        filled_by_name: s.filled_by_name,
        filled_at: s.filled_by_name ? new Date().toISOString() : null,
      }));
      const { error: insErr } = await supabase.from('volunteer_slots').insert(rows);
      if (insErr) {
        return NextResponse.json(
          { error: `insert failed: ${insErr.message}` },
          { status: 500 },
        );
      }
    }

    revalidatePath('/');
    revalidatePath(`/events/${id}`);

    const filled = slots.filter((s) => s.filled_by_name).length;
    return NextResponse.json({
      total: slots.length,
      filled,
      open: slots.length - filled,
      mode: body.mode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
