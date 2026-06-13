import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

export async function sendInvoiceEmail(invoiceId: string) {
  const supabase = getSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, organization_id, invoice_number, due_date, total_inc_vat, amount_open, reference_number, pdf_url, payment_link, organizations(name, default_iban, default_bic), customers(name, email)')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) throw new Error('Invoice not found');
  const organization = Array.isArray(invoice.organizations) ? invoice.organizations[0] : invoice.organizations;
  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
  if (!customer?.email) throw new Error('Customer email missing');

  const from = process.env.RESEND_FROM_EMAIL || 'LaskuFlow <laskutus@pulkkimedia.com>';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const payUrl = invoice.payment_link?.startsWith('http') ? invoice.payment_link : `${appUrl}${invoice.payment_link}`;
  const subject = `Lasku ${invoice.invoice_number} - ${organization?.name}`;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = `
    <p>Hei ${customer.name},</p>
    <p>Teille on lähetetty lasku <strong>${invoice.invoice_number}</strong>, summa <strong>${invoice.amount_open || invoice.total_inc_vat} EUR</strong>, eräpäivä <strong>${invoice.due_date}</strong>.</p>
    <p><a href="${payUrl}">Avaa maksulinkki</a></p>
    <p>Maksutiedot:<br/>Saaja: ${organization?.name}<br/>IBAN: ${organization?.default_iban || ''}<br/>BIC: ${organization?.default_bic || ''}<br/>Viite: ${invoice.reference_number}<br/>Summa: ${invoice.amount_open || invoice.total_inc_vat} EUR</p>
    ${invoice.pdf_url ? `<p><a href="${invoice.pdf_url}">Lataa PDF-lasku</a></p>` : ''}
    <p>Ystävällisin terveisin,<br/>${organization?.name}</p>
  `;

  const { data, error: sendError } = await resend.emails.send({ from, to: [customer.email], subject, html });

  await supabase.from('email_events').insert({
    organization_id: invoice.organization_id,
    invoice_id: invoice.id,
    event_type: sendError ? 'email_failed' : 'invoice_email_sent',
    to_email: customer.email,
    from_email: from,
    subject,
    provider_message_id: data?.id,
    status: sendError ? 'failed' : 'sent',
    error_message: sendError?.message,
    metadata: { payUrl },
  });

  await supabase.from('audit_logs').insert({
    organization_id: invoice.organization_id,
    action: sendError ? 'invoice_email_failed' : 'invoice_email_sent',
    entity_type: 'invoice',
    entity_id: invoice.id,
    metadata: { to: customer.email, providerMessageId: data?.id, error: sendError?.message },
  });

  if (sendError) throw new Error(sendError.message);
  return data;
}
