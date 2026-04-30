import { NextResponse } from 'next/server';
import { parseReceipt } from '@/lib/receipt-parser';
import { matchLineItemsToCatalog, type MatchedLineItem } from '@/lib/catalog-matcher';
import { createAdminClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_MEDIA = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('photo');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }
    if (!ALLOWED_MEDIA.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported image type ${file.type}. Use JPEG, PNG, WebP, or GIF.` },
        { status: 400 },
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Photo larger than 10MB. Resize and try again.' },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString('base64');

    const parsed = await parseReceipt(
      base64,
      file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
    );

    // Resolve Vikings club_id (V1 single-tenant)
    const supabase = createAdminClient();
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('shortname', 'LakeVistaVikings')
      .single();
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 500 });
    }

    const matched: MatchedLineItem[] = await matchLineItemsToCatalog(
      club.id as string,
      parsed.line_items,
    );

    return NextResponse.json({
      vendor: parsed.vendor,
      receipt_date: parsed.receipt_date,
      total_cents: parsed.total_cents,
      total_reconciles: parsed.total_reconciles,
      line_items: matched,
    });
  } catch (err) {
    console.error('Receipt parse failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
