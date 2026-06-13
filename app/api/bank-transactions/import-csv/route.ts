import { NextRequest, NextResponse } from 'next/server';
import { importBankCsv } from '@/src/lib/bank/csv-import';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const organizationId = String(body.organizationId || '');
    const bankConnectionId = body.bankConnectionId ? String(body.bankConnectionId) : null;
    const csv = String(body.csv || '');

    if (!organizationId) throw new Error('organizationId missing');
    if (!csv) throw new Error('CSV content missing');

    const result = await importBankCsv({ organizationId, bankConnectionId, csv });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'CSV import failed' }, { status: 400 });
  }
}
