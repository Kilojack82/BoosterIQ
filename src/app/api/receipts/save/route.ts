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

const INGREDIENT_CATEGORY = 'Ingredient';

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

    // Resolve next CAT-NNNN sequence number for new catalog items created
    // inline from this receipt (ingredient first-time additions, etc).
    const { data: maxRow } = await supabase
      .from('catalog_items')
      .select('code')
      .eq('club_id', clubId)
      .ilike('code', 'CAT-%')
      .order('code', { ascending: false })
      .limit(1);
    const lastCode = maxRow?.[0]?.code as string | undefined;
    const lastNum = lastCode ? parseInt(lastCode.replace(/^CAT-/, ''), 10) : 0;
    let nextCatNum = (Number.isFinite(lastNum) ? lastNum : 0) + 1;

    let applied = 0;
    let created = 0;

    for (const li of body.line_items) {
      if (!li.apply) continue;
      const delta = Math.round(li.quantity);
      if (delta <= 0) continue;

      let catalogId: string;
      if (li.catalog_match) {
        catalogId = li.catalog_match.id;
      } else {
        // No existing catalog row — create one inline as an ingredient.
        const code = `CAT-${String(nextCatNum).padStart(4, '0')}`;
        nextCatNum += 1;
        const { data: newItem, error: createErr } = await supabase
          .from('catalog_items')
          .insert({
            club_id: clubId,
            code,
            name: li.description.trim(),
            category: INGREDIENT_CATEGORY,
            unit: 'each',
            current_stock: 0,
            cost_basis_cents: li.unit_price_cents,
            vendor: body.vendor,
            is_merch: false,
            notes: `Auto-created from receipt parse on ${new Date().toISOString().slice(0, 10)}`,
          })
          .select('id')
          .single();
        if (createErr || !newItem) {
          console.error('catalog_items create failed', code, createErr);
          continue;
        }
        catalogId = newItem.id as string;
        created += 1;
      }

      const { error: moveErr } = await supabase.from('stock_movements').insert({
        catalog_item_id: catalogId,
        delta,
        source_type: 'receipt',
        source_id: receipt.id,
        notes: `${li.description} (${li.confidence} confidence)`,
      });
      if (moveErr) {
        console.error('stock_movement insert failed', catalogId, moveErr);
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

      applied += 1;
    }

    revalidatePath('/');

    return NextResponse.json({
      receipt_id: receipt.id,
      applied,
      created,
      skipped: body.line_items.length - applied,
    });
  } catch (err) {
    console.error('Receipt save failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
