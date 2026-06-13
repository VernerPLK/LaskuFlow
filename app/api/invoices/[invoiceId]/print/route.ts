import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

function money(value: number) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, organizations(*), customers(*), invoice_lines(*)')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const organization = Array.isArray(invoice.organizations) ? invoice.organizations[0] : invoice.organizations;
  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
  const lines = Array.isArray(invoice.invoice_lines) ? invoice.invoice_lines : [];

  const html = `<!doctype html><html lang="fi"><head><meta charset="utf-8"/><title>Lasku ${invoice.invoice_number}</title><style>
    body{font-family:Arial,sans-serif;color:#111827;margin:40px} .top{display:flex;justify-content:space-between;margin-bottom:36px}.title{font-size:38px;font-weight:800}.box{border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin:16px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #e5e7eb;padding:10px;text-align:left}th{text-transform:uppercase;font-size:12px;color:#6b7280}.right{text-align:right}.total{font-size:22px;font-weight:800;text-align:right;margin-top:18px}.muted{color:#6b7280}@media print{button{display:none}body{margin:20mm}}
  </style></head><body>
    <button onclick="window.print()">Tulosta / tallenna PDF</button>
    <div class="top"><div><h2>${organization?.name || ''}</h2><p>${organization?.address || ''}<br/>${organization?.postal_code || ''} ${organization?.city || ''}<br/>Y-tunnus: ${organization?.business_id || '-'}<br/>${organization?.email || ''}</p></div><div><div class="title">LASKU</div><p>Laskunumero: ${invoice.invoice_number}<br/>Laskupäivä: ${invoice.issue_date}<br/>Eräpäivä: ${invoice.due_date}<br/>Viitenumero: ${invoice.reference_number}</p></div></div>
    <div class="grid"><div class="box"><h3>Asiakas</h3><p>${customer?.name || ''}<br/>${customer?.address || ''}<br/>${customer?.postal_code || ''} ${customer?.city || ''}<br/>${customer?.email || ''}</p></div><div class="box"><h3>Maksutiedot</h3><p>Saaja: ${organization?.name || ''}<br/>IBAN: ${organization?.default_iban || '-'}<br/>BIC: ${organization?.default_bic || '-'}<br/>Viite: ${invoice.reference_number}<br/>Summa: ${money(invoice.amount_open || invoice.total_inc_vat)}</p></div></div>
    <table><thead><tr><th>Kuvaus</th><th class="right">Määrä</th><th class="right">ALV</th><th class="right">Yhteensä</th></tr></thead><tbody>${lines.map((line: any) => `<tr><td>${line.description}</td><td class="right">${line.quantity} ${line.unit}</td><td class="right">${line.vat_rate}%</td><td class="right">${money(line.line_total_inc_vat)}</td></tr>`).join('')}</tbody></table>
    <div class="total">Maksettava yhteensä: ${money(invoice.total_inc_vat)}</div>
    <p class="muted">${organization?.name || ''} · ${organization?.business_id || ''}</p>
  </body></html>`;

  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
