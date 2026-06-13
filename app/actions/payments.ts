import { redirect } from 'next/navigation';
import { createPaymentSessionForInvoice } from '@/src/lib/payments/service';

export async function startPaymentSession(formData: FormData) {
  'use server';
  const providerKey = String(formData.get('providerKey'));
  const paymentLinkId = String(formData.get('paymentLinkId'));
  const selectedMethod = String(formData.get('selectedMethod') || providerKey);
  const customerEmail = formData.get('customerEmail') ? String(formData.get('customerEmail')) : null;

  const result = await createPaymentSessionForInvoice({ providerKey, paymentLinkId, selectedMethod, customerEmail });
  if (result.checkoutUrl) redirect(result.checkoutUrl);
  redirect(`/pay/${String(formData.get('publicToken'))}?session=${result.id}`);
}
