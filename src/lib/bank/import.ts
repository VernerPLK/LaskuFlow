import Papa from 'papaparse';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { reconcilePaymentToInvoice } from '@/src/lib/payments/reconcile';

type BankCsvRow = {
  date?: string;
  booking_date?: string;
  amount?: string | number;
  reference_number?: string;
  reference?: string;
  payer_name?: string;
  name?: string;
  message?: string;
};

export async function importBankCsv(organizationId: string, csvText: string) {
  const supabase = getSupabaseAdmin();
  const parsed = Papa.parse<BankCsvRow>(csvText, { header: true, skipEmptyLines: true });
  const batchId = crypto.randomUUID();
  const imported = [];

  for (const row of parsed.data) {
    const referenceNumber = String(row.reference_number || row.reference || '').trim();
    const amount = Number(String(row.amount || '0').replace(',', '.'));
    const bookingDate = String(row.booking_date || row.date || new Date().toISOString().slice(0, 10));

    const { data: importedRow, error } = await supabase.from('imported_bank_rows').insert({
      organization_id: organizationId,
      booking_date: bookingDate,
      amount,
      currency: 'EUR',
      payer_name: row.payer_name || row.name || null,
      reference_number: referenceNumber || null,
      message: row.message || null,
      import_batch_id: batchId,
      raw_payload: row,
    }).select('*').single();

    if (error || !importedRow) continue;
    imported.push(await matchImportedBankRow(importedRow.id));
  }

  return { batchId, importedCount: imported.length, rows: imported };
}

export async function matchImportedBankRow(importedRowId: string) {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase.from('imported_bank_rows').select('*').eq('id', importedRowId).single();
  if (error || !row) throw new Error('Imported bank row not found');

  if (!row.reference_number) {
    await supabase.from('imported_bank_rows').update({ match_status: 'unmatched' }).eq('id', row.id);
    return { id: row.id, matchStatus: 'unmatched' };
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', row.organization_id)
    .eq('reference_number', row.reference_number)
    .maybeSingle();

  if (!invoice) {
    await supabase.from('imported_bank_rows').update({ match_status: 'unmatched' }).eq('id', row.id);
    return { id: row.id, matchStatus: 'unmatched' };
  }

  const open = Number(invoice.amount_open || invoice.total_inc_vat || 0);
  const amount = Number(row.amount);
  const matchStatus = amount === open ? 'matched' : amount < open ? 'underpaid' : 'overpaid';

  await supabase.from('imported_bank_rows').update({
    matched_invoice_id: invoice.id,
    match_status: matchStatus,
  }).eq('id', row.id);

  const { data: payment } = await supabase.from('payments').insert({
    organization_id: row.organization_id,
    invoice_id: invoice.id,
    amount,
    currency: row.currency || 'EUR',
    payment_method: 'bank_transfer',
    reference_number: row.reference_number,
    provider_key: 'bank_transfer',
    provider_payment_id: row.id,
    status: 'succeeded',
    raw_payload: row.raw_payload || {},
  }).select('*').single();

  if (payment) await reconcilePaymentToInvoice(payment);

  await supabase.from('audit_logs').insert({
    organization_id: row.organization_id,
    action: 'bank_csv_row_matched_to_invoice',
    entity_type: 'invoice',
    entity_id: invoice.id,
    metadata: { importedBankRowId: row.id, matchStatus, amount },
  });

  return { id: row.id, matchStatus, invoiceId: invoice.id };
}
