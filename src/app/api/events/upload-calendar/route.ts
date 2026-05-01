import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { parseICalendar } from '@/lib/ical-parser';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('ics');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No .ics file provided' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '.ics file larger than 5MB' }, { status: 400 });
    }
    const text = await file.text();
    const parsed = parseICalendar(text);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.reason }, { status: 422 });
    }

    const supabase = createAdminClient();
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('shortname', 'LakeVistaVikings')
      .single();
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 500 });
    }
    const clubId = club.id as string;

    // Find existing events that match (same name + date) to avoid dupes
    const { data: existing } = await supabase
      .from('events')
      .select('name, date')
      .eq('club_id', clubId);
    const existingKey = new Set(
      (existing ?? []).map((e) => `${e.name.toLowerCase().trim()}|${e.date}`),
    );

    const toInsert = parsed.events
      .filter((e) => !existingKey.has(`${e.name.toLowerCase().trim()}|${e.date}`))
      .map((e) => ({
        club_id: clubId,
        name: e.name,
        opponent: e.opponent,
        is_home: e.is_home,
        date: e.date,
        notes: [e.location, e.description].filter(Boolean).join(' · ') || null,
      }));

    let created = 0;
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('events').insert(toInsert);
      if (insErr) {
        return NextResponse.json(
          { error: `events insert: ${insErr.message}` },
          { status: 500 },
        );
      }
      created = toInsert.length;
    }

    revalidatePath('/events');
    revalidatePath('/');

    return NextResponse.json({
      raw_event_count: parsed.raw_event_count,
      total_parsed: parsed.events.length,
      created,
      duplicates_skipped: parsed.events.length - created,
    });
  } catch (err) {
    console.error('Calendar upload failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
