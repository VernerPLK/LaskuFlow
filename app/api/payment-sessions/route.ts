import { NextRequest, NextResponse } from 'next/server';
import { createPaymentSessionForInvoice } from '@/src/lib/payments/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createPaymentSessionForInvoice({
      providerKey: body.providerKey,
      paymentLinkId: body.paymentLinkId,
      selectedMethod: body.selectedMethod,
      customerEmail: body.customerEmail,
    });

    return NextResponse.json({
      ok: true,
      paymentSessionId: result.id,
      checkoutUrl: result.checkoutUrl,
      status: result.status,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Payment session error' }, { status: 400 });
  }
}
