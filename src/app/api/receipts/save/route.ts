import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

type SaveRequest = {
  vendor: string;
  receipt_date: string | null;
  total_cents: number | null;
  total_reconciles: boolean;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price_cents: number | null;
    total_cents: number | null;
    confidence: 'high' | 'medium' | 'low';
    catalog_match: { id: string; code: string; name: string } | null;
    apply: boolean;
  }>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveRequest;
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

    // Insert the receipt record (photo_url null per D14)
    const { data: receipt, error: receiptErr } = await supabase
      .from('receipts')
      .insert({
        club_id: clubId,
        vendor: body.vendor,
        receipt_date: body.receipt_date,
        total_cents: body.total_cents,
        photo_url: null,
        parsed_data_json: body,
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (receiptErr || !receipt) {
      return NextResponse.json(
        { error: `receipt insert: ${receiptErr?.message}` },
        { status: 500 },
      );
    }

    // Apply selected line items as stock movements + denormalized cache update
    const toApply = body.line_items.filter((li) => li.apply && li.catalog_match);
    let applied = 0;
    for (const li of toApply) {
      const match = li.catalog_match!;
      const delta = Math.round(li.quantity);
      if (delta <= 0) continue;

      const { error: moveErr } = await supabase.from('stock_movements').insert({
        catalog_item_id: match.id,
        delta,
        source_type: 'receipt',
        source_id: receipt.id,
        notes: `${li.description} (${li.confidence} confidence)`,
      });
      if (moveErr) {
        console.error('stock_movement insert failed', match.code, moveErr);
        continue;
      }

      // Denormalized current_stock update
      const { data: current } = await supabase
        .from('catalog_items')
        .select('current_stock')
        .eq('id', match.id)
        .single();
      const newStock = (current?.current_stock ?? 0) + delta;
      const { error: stockErr } = await supabase
        .from('catalog_items')
        .update({ current_stock: newStock })
        .eq('id', match.id);
      if (stockErr) {
        console.error('current_stock update failed', match.code, stockErr);
        continue;
      }

      applied += 1;
    }

    revalidatePath('/');

    return NextResponse.json({
      receipt_id: receipt.id,
      applied,
      skipped: body.line_items.length - applied,
    });
  } catch (err) {
    console.error('Receipt save failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
