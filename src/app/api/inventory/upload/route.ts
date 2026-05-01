import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { importMasterSheet } from '@/lib/master-sheet-importer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('xlsx');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No xlsx file provided' }, { status: 400 });
    }
    const allowed =
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.name.toLowerCase().endsWith('.xlsx');
    if (!allowed) {
      return NextResponse.json({ error: 'Upload must be an .xlsx file' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File larger than 25MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importMasterSheet(buffer);

    revalidatePath('/');
    revalidatePath('/inventory');

    return NextResponse.json(result);
  } catch (err) {
    console.error('Master sheet import failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
