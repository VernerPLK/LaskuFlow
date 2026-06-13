import { NextRequest, NextResponse } from 'next/server';
import { importBankCsv } from '@/src/lib/bank/import';

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const organizationId = String(form.get('organizationId'));
    const upload = form.get('file');
    if (!organizationId) throw new Error('organizationId missing');
    if (!(upload instanceof File)) throw new Error('file missing');
    const result = await importBankCsv(organizationId, await upload.text());
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Import failed' }, { status: 400 });
  }
}
