import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, opponent, is_home, date, signupgenius_url, weather, notes } = body;

    if (!name || !date) {
      return NextResponse.json({ error: 'name and date are required' }, { status: 400 });
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

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        club_id: club.id,
        name,
        opponent: opponent || null,
        is_home: typeof is_home === 'boolean' ? is_home : null,
        date,
        signupgenius_url: signupgenius_url || null,
        weather: weather || null,
        notes: notes || null,
      })
      .select('id')
      .single();
    if (error || !event) {
      return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 });
    }

    return NextResponse.json({ id: event.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
