import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

type PaymentRow = {
  id: string;
  organization_id: string;
  invoice_id: string;
  amount: number;
  status: string;
};

export async function reconcilePaymentToInvoice(payment: PaymentRow) {
  const supabase = getSupabaseAdmin();

  if (payment.status !== 'succeeded') {
    await supabase.from('audit_logs').insert({
      organization_id: payment.organization_id,
      action: 'payment_not_reconciled_failed_status',
      entity_type: 'payment',
      entity_id: payment.id,
      metadata: { status: payment.status },
    });
    return { reconciliationStatus: 'unmatched' as const };
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, organization_id, amount_paid, amount_open, total_inc_vat, status')
    .eq('id', payment.invoice_id)
    .single();

  if (error || !invoice) throw new Error('Invoice not found for reconciliation');

  const open = Number(invoice.amount_open ?? invoice.total_inc_vat ?? 0);
  const paidBefore = Number(invoice.amount_paid ?? 0);
  const amount = Number(payment.amount);

  let reconciliationStatus: 'matched' | 'underpaid' | 'overpaid';
  let invoiceStatus: 'paid' | 'partially_paid';
  let newOpen = 0;

  if (amount === open) {
    reconciliationStatus = 'matched';
    invoiceStatus = 'paid';
    newOpen = 0;
  } else if (amount < open) {
    reconciliationStatus = 'underpaid';
    invoiceStatus = 'partially_paid';
    newOpen = Math.max(open - amount, 0);
  } else {
    reconciliationStatus = 'overpaid';
    invoiceStatus = 'paid';
    newOpen = 0;
  }

  const paidAt = invoiceStatus === 'paid' ? new Date().toISOString() : null;

  await supabase.from('payments').update({ reconciliation_status: reconciliationStatus }).eq('id', payment.id);
  await supabase.from('invoices').update({
    amount_paid: paidBefore + amount,
    amount_open: newOpen,
    status: invoiceStatus,
    paid_at: paidAt,
  }).eq('id', payment.invoice_id);

  await supabase.from('audit_logs').insert({
    organization_id: payment.organization_id,
    action: reconciliationStatus === 'overpaid' ? 'payment_reconciled_overpaid' : 'payment_reconciled_to_invoice',
    entity_type: 'invoice',
    entity_id: payment.invoice_id,
    metadata: { paymentId: payment.id, amount, openBefore: open, reconciliationStatus },
  });

  return { reconciliationStatus, invoiceStatus };
}
