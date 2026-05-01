import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';
import { importMasterSheet, type ImportResult } from '@/lib/master-sheet-importer';
import {
  detectSimpleFormat,
  importSimpleInventory,
  type SimpleImportResult,
} from '@/lib/simple-inventory-importer';

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
    const wb = XLSX.read(buffer, { type: 'buffer' });

    // Try the simple Item Name + Base Stock format first; fall back to the
    // full master-sheet format (Catalog/Menu/Apparel/Settings tabs).
    const simple = detectSimpleFormat(wb);
    let result: SimpleImportResult | (ImportResult & { format: 'master' });

    if (simple) {
      result = await importSimpleInventory(wb, simple);
    } else {
      const master = await importMasterSheet(buffer);
      result = { ...master, format: 'master' };
    }

    revalidatePath('/');
    revalidatePath('/inventory');

    return NextResponse.json(result);
  } catch (err) {
    console.error('Master sheet import failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
