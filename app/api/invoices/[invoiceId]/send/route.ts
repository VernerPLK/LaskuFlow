import { NextRequest, NextResponse } from 'next/server';
import { sendInvoiceEmail } from '@/src/lib/email/resend';

export async function POST(_request: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { invoiceId } = await context.params;
    const result = await sendInvoiceEmail(invoiceId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not send invoice' }, { status: 400 });
  }
}
