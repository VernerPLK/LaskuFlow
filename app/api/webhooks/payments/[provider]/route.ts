import { NextRequest, NextResponse } from 'next/server';
import { processPaymentWebhook } from '@/src/lib/payments/service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const rawBody = await request.text();

  try {
    const result = await processPaymentWebhook(provider, rawBody, request.headers);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Webhook failed' }, { status: 400 });
  }
}
