import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { startPaymentSession } from '@/app/actions/payments';
import { MockPaymentButtons } from './MockPaymentButtons';

function eur(value: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value);
}

export default async function PayPage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ session?: string }> }) {
  const { token } = await props.params;
  const { session } = await props.searchParams;
  const supabase = getSupabaseAdmin();

  const { data: link } = await supabase
    .from('payment_links')
    .select(`
      id, public_token, status, organization_id, invoice_id,
      organizations(name, logo_url, default_iban, default_bic),
      invoices(id, invoice_number, reference_number, due_date, total_inc_vat, amount_open, currency, status, pdf_url, customers(name, email), invoice_lines(description, quantity, unit, unit_price_ex_vat, vat_rate, line_total_inc_vat))
    `)
    .eq('public_token', token)
    .eq('status', 'active')
    .single();

  if (!link) notFound();

  const organization = Array.isArray(link.organizations) ? link.organizations[0] : link.organizations;
  const invoice = Array.isArray(link.invoices) ? link.invoices[0] : link.invoices;
  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
  const lines = Array.isArray(invoice.invoice_lines) ? invoice.invoice_lines : [];
  const amountOpen = Number(invoice.amount_open || invoice.total_inc_vat || 0);

  return (
    <main className="pageShell publicPay">
      <section className="card heroCard">
        <div>
          <p className="eyebrow">Turvallinen maksusivu</p>
          <h1>{organization?.name}</h1>
          <p className="muted">Lasku {invoice.invoice_number} · {customer?.name}</p>
        </div>
        <div className="amountBox">
          <span>Avoinna</span>
          <strong>{eur(amountOpen)}</strong>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Laskun tiedot</h2>
          <dl className="details">
            <div><dt>Laskunumero</dt><dd>{invoice.invoice_number}</dd></div>
            <div><dt>Asiakas</dt><dd>{customer?.name}</dd></div>
            <div><dt>Summa</dt><dd>{eur(Number(invoice.total_inc_vat))}</dd></div>
            <div><dt>Avoin summa</dt><dd>{eur(amountOpen)}</dd></div>
            <div><dt>Eräpäivä</dt><dd>{invoice.due_date}</dd></div>
            <div><dt>Viitenumero</dt><dd>{invoice.reference_number}</dd></div>
          </dl>

          <h3>Laskurivit</h3>
          <div className="lineTable">
            {lines.map((line: any, index: number) => (
              <div className="lineRow" key={index}>
                <span>{line.description}</span>
                <span>{line.quantity} {line.unit}</span>
                <span>ALV {line.vat_rate}%</span>
                <strong>{eur(Number(line.line_total_inc_vat))}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Maksa lasku</h2>
          <form action={startPaymentSession} className="stack">
            <input type="hidden" name="paymentLinkId" value={link.id} />
            <input type="hidden" name="publicToken" value={link.public_token} />
            <input type="hidden" name="providerKey" value="stripe" />
            <input type="hidden" name="selectedMethod" value="card" />
            <input type="hidden" name="customerEmail" value={customer?.email || ''} />
            <button className="button primary" type="submit">Maksa kortilla</button>
          </form>

          <form action={startPaymentSession} className="stack">
            <input type="hidden" name="paymentLinkId" value={link.id} />
            <input type="hidden" name="publicToken" value={link.public_token} />
            <input type="hidden" name="providerKey" value="paytrail" />
            <input type="hidden" name="selectedMethod" value="bank_payment" />
            <button className="button" type="submit">Maksa verkkopankissa <span className="badge">valmis yhdistettäväksi</span></button>
          </form>

          <form action={startPaymentSession} className="stack">
            <input type="hidden" name="paymentLinkId" value={link.id} />
            <input type="hidden" name="publicToken" value={link.public_token} />
            <input type="hidden" name="providerKey" value="mobilepay" />
            <input type="hidden" name="selectedMethod" value="mobilepay" />
            <button className="button" type="submit">Maksa MobilePaylla <span className="badge">valmis yhdistettäväksi</span></button>
          </form>

          <MockPaymentButtons
            paymentSessionId={session || null}
            invoiceId={invoice.id}
            organizationId={link.organization_id}
            amountOpen={amountOpen}
            currency={invoice.currency || 'EUR'}
          />

          {invoice.pdf_url ? <a className="button" href={invoice.pdf_url}>Lataa PDF-lasku</a> : <button className="button" disabled>Lataa PDF-lasku</button>}
        </div>
      </section>

      <section className="card">
        <h2>Tilisiirtotiedot</h2>
        <div className="bankGrid">
          <div><span>Saaja</span><strong>{organization?.name}</strong></div>
          <div><span>IBAN</span><strong>{organization?.default_iban || 'Lisää IBAN asetuksissa'}</strong></div>
          <div><span>BIC</span><strong>{organization?.default_bic || 'Lisää BIC asetuksissa'}</strong></div>
          <div><span>Viite</span><strong>{invoice.reference_number}</strong></div>
          <div><span>Summa</span><strong>{eur(amountOpen)}</strong></div>
          <div><span>Eräpäivä</span><strong>{invoice.due_date}</strong></div>
        </div>
      </section>
    </main>
  );
}
