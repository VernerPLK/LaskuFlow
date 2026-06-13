import { NextRequest, NextResponse } from 'next/server';
import { createOrGetPaymentLink } from '@/src/lib/invoices/create-payment-link';

export async function POST(_request: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { invoiceId } = await context.params;
    const link = await createOrGetPaymentLink(invoiceId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.json({ ok: true, token: link.public_token, paymentUrl: `${appUrl}/pay/${link.public_token}` });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not create payment link' }, { status: 400 });
  }
}
