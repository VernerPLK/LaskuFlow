import Stripe from 'stripe';
import type { PaymentProviderAdapter } from './types';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion });
}

export const stripeProvider: PaymentProviderAdapter = {
  key: 'stripe',
  name: 'Stripe',
  async createPaymentSession(input) {
    const stripe = getStripe();
    const cents = Math.round(input.amount * 100);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          product_data: { name: `Lasku ${input.metadata?.invoiceNumber || input.invoiceId}` },
          unit_amount: cents,
        },
      }],
      metadata: {
        organization_id: input.organizationId,
        invoice_id: input.invoiceId,
        payment_link_id: input.paymentLinkId,
        payment_session_id: input.paymentSessionId || '',
        ...(input.metadata || {}),
      },
    });

    return {
      providerKey: 'stripe',
      providerSessionId: session.id,
      providerPaymentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      checkoutUrl: session.url,
      status: 'pending',
      rawProviderPayload: session,
    };
  },
  async handleWebhook(input) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing');

    const signature = input.headers.get('stripe-signature');
    if (!signature) throw new Error('Missing Stripe-Signature header');

    const event = getStripe().webhooks.constructEvent(input.rawBody, signature, secret);
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};
    const ok = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
    const failed = event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired';

    return {
      providerKey: 'stripe',
      providerEventId: event.id,
      eventType: event.type,
      status: ok || failed ? 'processed' : 'ignored',
      paymentSessionId: metadata.payment_session_id || null,
      providerSessionId: session.id,
      providerPaymentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      invoiceId: metadata.invoice_id || null,
      organizationId: metadata.organization_id || null,
      amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
      currency: session.currency?.toUpperCase() || 'EUR',
      sessionStatus: ok ? 'succeeded' : failed ? 'failed' : 'pending',
      shouldCreatePayment: ok,
      rawPayload: event,
      errorMessage: failed ? 'Stripe-maksu epäonnistui tai vanheni.' : null,
    };
  },
};
