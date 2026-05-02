import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import type { MatchedSquareRow } from '@/lib/square-csv-matcher';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    // Verify the event_id (if any) still exists. The upload UI might be
    // showing a stale event from before a delete; without this check the
    // insert below trips the square_imports_event_id_fkey constraint.
    let eventId: string | null = body.event_id;
    if (eventId) {
      const { data: ev } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .maybeSingle();
      if (!ev) {
        return NextResponse.json(
          {
            error:
              'The selected event no longer exists. Refresh this page to load the current event list, then try again.',
          },
          { status: 400 },
        );
      }
    }

    // Insert square_imports row first so stock_movements can reference it
    const { data: imp, error: impErr } = await supabase
      .from('square_imports')
      .insert({
        club_id: clubId,
        event_id: eventId,
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

    // Partition rows once. Aggregate per catalog_item so each item only
    // touches the database twice (one stock_movement insert + one
    // catalog_items update), rather than 3× per line.
    const movementsToInsert: Array<{
      catalog_item_id: string;
      delta: number;
      source_type: 'sale';
      source_id: string;
      notes: string;
    }> = [];
    const deltaByCatalog = new Map<string, number>();
    let skippedNoCatalog = 0;
    let skippedUserUnchecked = 0;

    for (const row of body.rows) {
      if (!row.apply) {
        skippedUserUnchecked += 1;
        continue;
      }
      if (!row.catalog_match) {
        skippedNoCatalog += 1;
        continue;
      }
      const delta = -Math.abs(Math.round(row.qty));
      if (delta === 0) continue;
      movementsToInsert.push({
        catalog_item_id: row.catalog_match.id,
        delta,
        source_type: 'sale',
        source_id: imp.id as string,
        notes: `Square sale: ${row.item}${row.variation ? ` (${row.variation})` : ''}`,
      });
      deltaByCatalog.set(
        row.catalog_match.id,
        (deltaByCatalog.get(row.catalog_match.id) ?? 0) + delta,
      );
    }

    let depleted = 0;

    if (movementsToInsert.length > 0) {
      const { error: insErr } = await supabase
        .from('stock_movements')
        .insert(movementsToInsert);
      if (insErr) {
        console.error('bulk stock_movements insert failed', insErr);
        return NextResponse.json(
          { error: `stock_movements insert: ${insErr.message}` },
          { status: 500 },
        );
      }

      const ids = Array.from(deltaByCatalog.keys());
      const { data: currents, error: fetchErr } = await supabase
        .from('catalog_items')
        .select('id, current_stock')
        .in('id', ids);
      if (fetchErr) {
        console.error('bulk current_stock fetch failed', fetchErr);
      }

      // Group items into chunks and run updates in parallel — Postgres
      // handles concurrent updates fine since each touches a distinct row.
      const updates = (currents ?? []).map(async (c) => {
        const delta = deltaByCatalog.get(c.id as string) ?? 0;
        const { error: stockErr } = await supabase
          .from('catalog_items')
          .update({ current_stock: c.current_stock + delta })
          .eq('id', c.id);
        if (stockErr) {
          console.error('current_stock update failed', c.id, stockErr.message);
          return false;
        }
        return true;
      });
      const results = await Promise.all(updates);
      depleted = results.filter(Boolean).length;
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
