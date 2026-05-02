import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getEventReportData } from '@/lib/event-report-data';
import { EventReportPdfDocument } from '@/lib/event-report-pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const data = await getEventReportData(id);
    if (!data) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const buffer = await renderToBuffer(<EventReportPdfDocument data={data} />);

    const safeName = data.event.name
      .replace(/[^A-Za-z0-9 _-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    const filename = `BoosterIQ_${safeName}_${data.event.date}.pdf`;

    // ?inline=1 → render in the browser's PDF viewer (used by the Print
    // button so the printed output matches the downloaded file). Default
    // is attachment for the Download button.
    const inline = new URL(request.url).searchParams.get('inline') === '1';
    const disposition = inline
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Report PDF render failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
