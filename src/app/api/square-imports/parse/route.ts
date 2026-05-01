import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { parseSquareCsv } from '@/lib/square-csv-parser';
import { matchSquareRowsToCatalog } from '@/lib/square-csv-matcher';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('csv');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'CSV larger than 5MB' }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseSquareCsv(text);
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

    const matched = await matchSquareRowsToCatalog(club.id as string, parsed.rows);

    return NextResponse.json({
      total_qty: parsed.total_qty,
      total_net_sales_cents: parsed.total_net_sales_cents,
      total_gross_sales_cents: parsed.total_gross_sales_cents,
      date_range: parsed.date_range,
      raw_row_count: parsed.raw_row_count,
      rows: matched,
    });
  } catch (err) {
    console.error('Square CSV parse failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
