import { inngest } from './client';
import { sendInvoiceEmail } from '@/src/lib/email/resend';
import { processPaymentWebhook } from '@/src/lib/payments/service';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

export const invoiceSent = inngest.createFunction(
  { id: 'invoice-sent-send-email' },
  { event: 'invoice.sent' },
  async ({ event, step }) => {
    const invoiceId = String(event.data.invoiceId);
    await step.run('send invoice email', () => sendInvoiceEmail(invoiceId));
    return { invoiceId };
  },
);

export const paymentWebhookReceived = inngest.createFunction(
  { id: 'payment-webhook-received' },
  { event: 'payment.webhook.received' },
  async ({ event, step }) => {
    const provider = String(event.data.provider);
    const rawBody = String(event.data.rawBody || '{}');
    const headers = new Headers(event.data.headers as Record<string, string>);
    return await step.run('process provider webhook', () => processPaymentWebhook(provider, rawBody, headers));
  },
);

export const invoicePaymentSucceeded = inngest.createFunction(
  { id: 'invoice-payment-succeeded-audit' },
  { event: 'invoice.payment.succeeded' },
  async ({ event, step }) => {
    const db = getSupabaseAdmin();
    await step.run('write success audit log', async () => {
      await db.from('audit_logs').insert({
        organization_id: event.data.organizationId,
        action: 'invoice_payment_succeeded',
        entity_type: 'invoice',
        entity_id: event.data.invoiceId,
        metadata: event.data,
      });
    });
    return event.data;
  },
);

export const invoicePaymentFailed = inngest.createFunction(
  { id: 'invoice-payment-failed-audit' },
  { event: 'invoice.payment.failed' },
  async ({ event, step }) => {
    const db = getSupabaseAdmin();
    await step.run('write failed payment audit log', async () => {
      await db.from('audit_logs').insert({
        organization_id: event.data.organizationId,
        action: 'invoice_payment_failed',
        entity_type: 'invoice',
        entity_id: event.data.invoiceId,
        metadata: event.data,
      });
    });
    return event.data;
  },
);

export const dailyInvoiceAutomation = inngest.createFunction(
  { id: 'daily-invoice-automation' },
  { cron: 'TZ=Europe/Helsinki 0 7 * * *' },
  async ({ step }) => {
    const db = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const { data: invoices } = await step.run('load open invoices', async () => {
      const result = await db
        .from('invoices')
        .select('id, organization_id, due_date, status, amount_open')
        .gt('amount_open', 0)
        .in('status', ['sent', 'open', 'due_soon', 'overdue', 'reminder_sent', 'second_reminder_sent']);
      return result;
    });

    const rows = invoices || [];
    for (const invoice of rows as any[]) {
      const dueDate = String(invoice.due_date);
      if (dueDate < today && invoice.status !== 'overdue') {
        await step.run(`mark overdue ${invoice.id}`, async () => {
          await db.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id);
          await db.from('audit_logs').insert({
            organization_id: invoice.organization_id,
            action: 'invoice_marked_overdue_by_automation',
            entity_type: 'invoice',
            entity_id: invoice.id,
            metadata: { dueDate, today },
          });
        });
      }
    }

    return { checked: rows.length };
  },
);

export const functions = [
  invoiceSent,
  paymentWebhookReceived,
  invoicePaymentSucceeded,
  invoicePaymentFailed,
  dailyInvoiceAutomation,
];
