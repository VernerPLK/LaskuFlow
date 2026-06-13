import { revalidatePath } from 'next/cache';
import { sendInvoiceEmail } from '@/src/lib/email/resend';
import { createOrGetPaymentLink } from '@/src/lib/invoices/create-payment-link';

export async function createPaymentLinkAction(formData: FormData) {
  'use server';
  const invoiceId = String(formData.get('invoiceId'));
  await createOrGetPaymentLink(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function sendInvoiceEmailAction(formData: FormData) {
  'use server';
  const invoiceId = String(formData.get('invoiceId'));
  await createOrGetPaymentLink(invoiceId);
  await sendInvoiceEmail(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}
