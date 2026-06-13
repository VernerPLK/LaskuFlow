import { NextRequest, NextResponse } from 'next/server';
import { processPaymentWebhook } from '@/src/lib/payments/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawBody = JSON.stringify({
      providerEventId: `mock_evt_${crypto.randomUUID()}`,
      outcome: body.outcome,
      paymentSessionId: body.paymentSessionId,
      invoiceId: body.invoiceId,
      organizationId: body.organizationId,
      amount: body.amount,
      currency: body.currency || 'EUR',
    });
    const result = await processPaymentWebhook('mock', rawBody, new Headers({ 'content-type': 'application/json' }));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Mock payment failed' }, { status: 400 });
  }
}
