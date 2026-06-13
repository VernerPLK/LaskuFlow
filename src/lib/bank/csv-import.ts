import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { reconcilePaymentToInvoice } from '@/src/lib/payments/reconcile';

type CsvBankRow = {
  date: string;
  amount: number;
  referenceNumber?: string | null;
  debtorName?: string | null;
  message?: string | null;
  externalTransactionId?: string | null;
};

export function parseBankCsv(csv: string): CsvBankRow[] {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = headerLine.split(';').map((h) => h.trim().toLowerCase());

  return lines.filter(Boolean).map((line) => {
    const cells = line.split(';').map((cell) => cell.trim());
    const get = (names: string[]) => {
      const index = headers.findIndex((header) => names.includes(header));
      return index >= 0 ? cells[index] : '';
    };

    return {
      date: get(['date', 'päivämäärä', 'booking_date']) || new Date().toISOString().slice(0, 10),
      amount: Number((get(['amount', 'summa']) || '0').replace(',', '.')),
      referenceNumber: get(['reference', 'reference_number', 'viite', 'viitenumero']) || null,
      debtorName: get(['debtor', 'payer', 'maksaja', 'debtor_name']) || null,
      message: get(['message', 'viesti', 'remittance_information']) || null,
      externalTransactionId: get(['id', 'transaction_id', 'external_transaction_id']) || crypto.randomUUID(),
    };
  });
}

export async function importBankCsv(input: { organizationId: string; bankConnectionId?: string | null; csv: string }) {
  const db = getSupabaseAdmin();
  const rows = parseBankCsv(input.csv);
  const results = [];

  for (const row of rows) {
    const { data: invoice } = row.referenceNumber
      ? await db
          .from('invoices')
          .select('id, organization_id, reference_number, amount_open, total_inc_vat')
          .eq('organization_id', input.organizationId)
          .eq('reference_number', row.referenceNumber.replace(/\s/g, ''))
          .maybeSingle()
      : { data: null } as any;

    const matchStatus = invoice ? 'matched_by_reference' : 'unmatched';

    const { data: tx } = await db.from('bank_transactions').insert({
      organization_id: input.organizationId,
      bank_connection_id: input.bankConnectionId || null,
      external_transaction_id: row.externalTransactionId,
      booking_date: row.date,
      amount: row.amount,
      currency: 'EUR',
      debtor_name: row.debtorName,
      remittance_information: row.message,
      reference_number: row.referenceNumber?.replace(/\s/g, ''),
      message: row.message,
      raw_payload: row as any,
      matched_invoice_id: invoice?.id || null,
      match_status: matchStatus,
    }).select('*').single();

    if (invoice && tx && row.amount > 0) {
      const { data: payment } = await db.from('payments').insert({
        organization_id: input.organizationId,
        invoice_id: invoice.id,
        amount: row.amount,
        currency: 'EUR',
        payment_method: 'bank_transfer',
        reference_number: row.referenceNumber?.replace(/\s/g, ''),
        bank_transaction_id: tx.id,
        provider_key: 'bank_transfer',
        status: 'succeeded',
        raw_payload: row as any,
      }).select('*').single();

      if (payment) await reconcilePaymentToInvoice(payment);
    }

    results.push({ row, matchStatus, invoiceId: invoice?.id || null });
  }

  return { imported: results.length, results };
}
