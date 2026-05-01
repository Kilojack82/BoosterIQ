import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import type { MatchedSquareRow } from '@/lib/square-csv-matcher';

export const runtime = 'nodejs';

type SaveBody = {
  event_id: string | null;
  total_qty: number;
  total_net_sales_cents: number;
  total_gross_sales_cents: number;
  date_range: { start: string | null; end: string | null };
  rows: Array<MatchedSquareRow & { apply: boolean }>;
  summary?: {
    cash_cents: number | null;
    card_cents: number | null;
    cashapp_cents: number | null;
    other_cents: number | null;
    giftcard_cents: number | null;
    fees_cents: number | null;
    net_total_cents: number | null;
  } | null;
  parse_source?: 'csv' | 'pdf';
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveBody;
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

    // Insert square_imports row first so stock_movements can reference it
    const { data: imp, error: impErr } = await supabase
      .from('square_imports')
      .insert({
        club_id: clubId,
        event_id: body.event_id,
        csv_url: null,
        parsed_data_json: {
          total_qty: body.total_qty,
          total_net_sales_cents: body.total_net_sales_cents,
          total_gross_sales_cents: body.total_gross_sales_cents,
          date_range: body.date_range,
          row_count: body.rows.length,
          parse_source: body.parse_source ?? 'csv',
          summary: body.summary ?? null,
        },
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (impErr || !imp) {
      return NextResponse.json(
        { error: `square_imports insert: ${impErr?.message}` },
        { status: 500 },
      );
    }

    let depleted = 0;
    let skippedNoCatalog = 0;
    let skippedUserUnchecked = 0;

    for (const row of body.rows) {
      if (!row.apply) {
        skippedUserUnchecked += 1;
        continue;
      }
      if (!row.catalog_match) {
        // Menu item exists but no catalog_item link (recipe-only items like
        // "Hot Dog"), or no menu match at all. Counted in totals; not
        // depleted from inventory in V1.
        skippedNoCatalog += 1;
        continue;
      }
      const catalogId = row.catalog_match.id;
      const delta = -Math.abs(Math.round(row.qty));
      if (delta === 0) continue;

      const { error: moveErr } = await supabase.from('stock_movements').insert({
        catalog_item_id: catalogId,
        delta,
        source_type: 'sale',
        source_id: imp.id,
        notes: `Square sale: ${row.item}${row.variation ? ` (${row.variation})` : ''}`,
      });
      if (moveErr) {
        console.error('stock_movement insert failed', row.item, moveErr);
        continue;
      }

      const { data: current } = await supabase
        .from('catalog_items')
        .select('current_stock')
        .eq('id', catalogId)
        .single();
      const newStock = (current?.current_stock ?? 0) + delta;
      const { error: stockErr } = await supabase
        .from('catalog_items')
        .update({ current_stock: newStock })
        .eq('id', catalogId);
      if (stockErr) {
        console.error('current_stock update failed', catalogId, stockErr);
        continue;
      }

      depleted += 1;
    }

    revalidatePath('/');

    return NextResponse.json({
      square_import_id: imp.id,
      depleted,
      skippedNoCatalog,
      skippedUserUnchecked,
      total_rows: body.rows.length,
    });
  } catch (err) {
    console.error('Square save failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
