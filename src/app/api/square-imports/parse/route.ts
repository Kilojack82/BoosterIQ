import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { parseSquareCsv } from '@/lib/square-csv-parser';
import { matchSquareRowsToCatalog } from '@/lib/square-csv-matcher';
import {
  parseSquareItemsPdf,
  parseSquareSummaryPdf,
  type ParsedSalesSummary,
} from '@/lib/square-pdf-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

const isPdf = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
const isCsv = (file: File) =>
  file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const itemsFile = formData.get('items');
    const summaryFile = formData.get('summary');

    if (!(itemsFile instanceof File)) {
      return NextResponse.json({ error: 'No items file provided' }, { status: 400 });
    }
    if (itemsFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Items file larger than 10MB' }, { status: 400 });
    }

    let parsed;
    let parseSource: 'csv' | 'pdf';

    if (isCsv(itemsFile)) {
      const text = await itemsFile.text();
      parsed = parseSquareCsv(text);
      parseSource = 'csv';
    } else if (isPdf(itemsFile)) {
      const buf = Buffer.from(await itemsFile.arrayBuffer());
      const base64 = buf.toString('base64');
      parsed = await parseSquareItemsPdf(base64);
      parseSource = 'pdf';
    } else {
      return NextResponse.json(
        { error: `Unsupported items file type ${itemsFile.type || itemsFile.name}` },
        { status: 400 },
      );
    }

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.reason }, { status: 422 });
    }

    // Optional sales summary PDF
    let summary: ParsedSalesSummary | null = null;
    if (summaryFile instanceof File && summaryFile.size > 0) {
      if (!isPdf(summaryFile)) {
        return NextResponse.json(
          { error: 'Sales summary must be a PDF' },
          { status: 400 },
        );
      }
      if (summaryFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Sales summary larger than 5MB' },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await summaryFile.arrayBuffer());
      summary = await parseSquareSummaryPdf(buf.toString('base64'));
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
      summary,
      parse_source: parseSource,
    });
  } catch (err) {
    console.error('Square import parse failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
