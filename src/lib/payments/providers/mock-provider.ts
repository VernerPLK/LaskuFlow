import { randomUUID } from 'node:crypto';
import type { PaymentProviderAdapter } from './types';

function parseJson(rawBody: string, fallback: unknown) {
  if (fallback && typeof fallback === 'object') return fallback as Record<string, unknown>;
  try {
    return JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const mockProvider: PaymentProviderAdapter = {
  key: 'mock',
  name: 'Mock-maksu',
  async createPaymentSession(input) {
    return {
      providerKey: 'mock',
      providerSessionId: input.paymentSessionId || `mock_session_${randomUUID()}`,
      providerPaymentId: null,
      checkoutUrl: null,
      status: 'created',
      rawProviderPayload: { provider: 'mock', amount: input.amount, currency: input.currency },
    };
  },
  async handleWebhook(input) {
    const body = parseJson(input.rawBody, input.parsedBody);
    const outcome = String(body.outcome || 'succeeded');
    const amount = Number(body.amount || 0);
    const paymentSessionId = String(body.paymentSessionId || '');
    const sessionStatus = outcome === 'failed' ? 'failed' : outcome === 'partial' ? 'partially_paid' : 'succeeded';

    return {
      providerKey: 'mock',
      providerEventId: String(body.providerEventId || `mock_evt_${randomUUID()}`),
      eventType: `mock.payment.${outcome}`,
      status: 'processed',
      paymentSessionId,
      providerSessionId: paymentSessionId,
      providerPaymentId: outcome === 'failed' ? null : `mock_pay_${randomUUID()}`,
      invoiceId: String(body.invoiceId || ''),
      organizationId: String(body.organizationId || ''),
      amount: Number.isFinite(amount) ? amount : null,
      currency: String(body.currency || 'EUR'),
      sessionStatus,
      shouldCreatePayment: outcome !== 'failed',
      rawPayload: body,
      errorMessage: outcome === 'failed' ? 'Mock-maksu epäonnistui testissä.' : null,
    };
  },
};
