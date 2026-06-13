import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { resolvePaymentProvider } from './provider-registry';
import { reconcilePaymentToInvoice } from './reconcile';

export async function createPaymentSessionForInvoice(input: {
  providerKey: string;
  paymentLinkId: string;
  selectedMethod?: string;
  customerEmail?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data: link, error: linkError } = await supabase
    .from('payment_links')
    .select('id, organization_id, invoice_id, public_token, invoices(id, invoice_number, amount_open, total_inc_vat, currency)')
    .eq('id', input.paymentLinkId)
    .single();

  if (linkError || !link) throw new Error('Payment link not found');

  const invoice = Array.isArray(link.invoices) ? link.invoices[0] : link.invoices;
  const amount = Number(invoice.amount_open || invoice.total_inc_vat);
  const provider = resolvePaymentProvider(input.providerKey);

  const { data: providerRow } = await supabase
    .from('payment_providers')
    .select('id')
    .eq('organization_id', link.organization_id)
    .eq('provider_key', provider.key)
    .maybeSingle();

  const { data: session, error: sessionError } = await supabase.from('payment_sessions').insert({
    organization_id: link.organization_id,
    invoice_id: link.invoice_id,
    payment_link_id: link.id,
    provider_id: providerRow?.id ?? null,
    provider_key: provider.key,
    selected_method: input.selectedMethod ?? provider.key,
    amount,
    currency: invoice.currency || 'EUR',
    customer_email: input.customerEmail ?? null,
    status: 'created',
    metadata: { publicToken: link.public_token },
  }).select('*').single();

  if (sessionError || !session) throw new Error('Could not create payment session');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const result = await provider.createPaymentSession({
    organizationId: link.organization_id,
    invoiceId: link.invoice_id,
    paymentLinkId: link.id,
    paymentSessionId: session.id,
    amount,
    currency: invoice.currency || 'EUR',
    customerEmail: input.customerEmail,
    successUrl: `${appUrl}/pay/${link.public_token}?payment=success`,
    cancelUrl: `${appUrl}/pay/${link.public_token}?payment=cancelled`,
    metadata: { invoiceNumber: invoice.invoice_number },
  });

  await supabase.from('payment_sessions').update({
    provider_session_id: result.providerSessionId,
    provider_payment_id: result.providerPaymentId,
    checkout_url: result.checkoutUrl,
    status: result.status,
    raw_provider_payload: result.rawProviderPayload ?? {},
  }).eq('id', session.id);

  await supabase.from('audit_logs').insert({
    organization_id: link.organization_id,
    action: `payment_session_created_${provider.key}`,
    entity_type: 'payment_session',
    entity_id: session.id,
    metadata: { invoiceId: link.invoice_id, amount, checkoutUrl: result.checkoutUrl },
  });

  return { ...session, ...result, id: session.id };
}

export async function processPaymentWebhook(providerKey: string, rawBody: string, headers: Headers) {
  const supabase = getSupabaseAdmin();
  let parsedBody: unknown = undefined;
  try { parsedBody = JSON.parse(rawBody || '{}'); } catch {}

  const { data: delivery } = await supabase.from('payment_webhook_deliveries').insert({
    provider_key: providerKey,
    headers: Object.fromEntries(headers.entries()),
    body: parsedBody ?? { rawBody },
    status: 'received',
  }).select('*').single();

  const provider = resolvePaymentProvider(providerKey);
  let normalized;

  try {
    normalized = await provider.handleWebhook({ providerKey: provider.key, rawBody, headers, parsedBody });
  } catch (error) {
    await supabase.from('payment_webhook_deliveries').update({
      status: 'failed',
      signature_valid: false,
      error_message: error instanceof Error ? error.message : 'Webhook error',
    }).eq('id', delivery?.id);
    throw error;
  }

  const existing = normalized.providerEventId
    ? await supabase.from('payment_events').select('id').eq('provider_key', provider.key).eq('provider_event_id', normalized.providerEventId).maybeSingle()
    : { data: null };

  if (existing.data?.id) {
    await supabase.from('payment_webhook_deliveries').update({ status: 'ignored', provider_event_id: normalized.providerEventId }).eq('id', delivery?.id);
    return { ignored: true };
  }

  await supabase.from('payment_webhook_deliveries').update({
    organization_id: normalized.organizationId,
    signature_valid: provider.key === 'stripe' ? true : provider.key === 'mock',
    event_type: normalized.eventType,
    provider_event_id: normalized.providerEventId,
    status: normalized.status,
  }).eq('id', delivery?.id);

  const { data: event } = await supabase.from('payment_events').insert({
    organization_id: normalized.organizationId,
    invoice_id: normalized.invoiceId,
    payment_session_id: normalized.paymentSessionId,
    provider_key: provider.key,
    provider_event_id: normalized.providerEventId,
    event_type: normalized.eventType,
    status: normalized.status,
    amount: normalized.amount,
    currency: normalized.currency || 'EUR',
    raw_payload: normalized.rawPayload ?? {},
    processing_error: normalized.errorMessage,
    processed_at: new Date().toISOString(),
  }).select('*').single();

  if (normalized.paymentSessionId) {
    await supabase.from('payment_sessions').update({
      status: normalized.sessionStatus,
      provider_payment_id: normalized.providerPaymentId,
      error_message: normalized.errorMessage,
      raw_provider_payload: normalized.rawPayload ?? {},
    }).eq('id', normalized.paymentSessionId);
  }

  if (normalized.shouldCreatePayment && normalized.invoiceId && normalized.organizationId && normalized.amount) {
    const { data: payment } = await supabase.from('payments').insert({
      organization_id: normalized.organizationId,
      invoice_id: normalized.invoiceId,
      payment_session_id: normalized.paymentSessionId,
      payment_event_id: event?.id,
      amount: normalized.amount,
      currency: normalized.currency || 'EUR',
      payment_method: provider.key,
      provider_key: provider.key,
      provider_payment_id: normalized.providerPaymentId,
      status: 'succeeded',
      raw_payload: normalized.rawPayload ?? {},
    }).select('*').single();

    if (payment) await reconcilePaymentToInvoice(payment);
  }

  await supabase.from('audit_logs').insert({
    organization_id: normalized.organizationId,
    action: `payment_webhook_processed_${provider.key}`,
    entity_type: 'payment_event',
    entity_id: event?.id,
    metadata: { eventType: normalized.eventType, providerEventId: normalized.providerEventId },
  });

  return { ok: true, eventId: event?.id };
}
