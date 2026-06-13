import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { paymentEventLabel, paymentStatusLabel, reconciliationLabel } from '@/src/lib/payments/status-labels';
import { createPaymentLinkAction, sendInvoiceEmailAction } from './actions';
import { CopyPaymentLinkButton } from './CopyPaymentLinkButton';

function eur(value: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

export default async function InvoiceDetailPage(props: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await props.params;
  const db = getSupabaseAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { data: invoice } = await db
    .from('invoices')
    .select('id, organization_id, invoice_number, reference_number, due_date, status, total_inc_vat, amount_open, amount_paid, payment_link, pdf_url, customers(name, email), organizations(name, default_iban, default_bic)')
    .eq('id', invoiceId)
    .single();

  if (!invoice) notFound();

  const [{ data: paymentLinks }, { data: sessions }, { data: events }, { data: payments }, { data: webhooks }, { data: auditLogs }] = await Promise.all([
    db.from('payment_links').select('id, public_token, status, created_at').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    db.from('payment_sessions').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    db.from('payment_events').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    db.from('payments').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    db.from('payment_webhook_deliveries').select('*').eq('organization_id', invoice.organization_id).order('created_at', { ascending: false }).limit(20),
    db.from('audit_logs').select('*').eq('entity_id', invoiceId).order('created_at', { ascending: false }).limit(30),
  ]);

  const activeLink = paymentLinks?.find((link: any) => link.status === 'active');
  const paymentUrl = activeLink ? `${appUrl}/pay/${activeLink.public_token}` : null;
  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
  const organization = Array.isArray(invoice.organizations) ? invoice.organizations[0] : invoice.organizations;

  return (
    <main className="pageShell">
      <section className="card heroCard">
        <div>
          <p className="eyebrow">Lasku</p>
          <h1>{invoice.invoice_number}</h1>
          <p className="muted">{customer?.name} · status {invoice.status} · eräpäivä {invoice.due_date} · viite {invoice.reference_number}</p>
        </div>
        <div className="amountBox"><span>Avoinna</span><strong>{eur(Number(invoice.amount_open))}</strong></div>
      </section>

      <section className="grid three">
        <div className="card"><h2>Laskutettu</h2><strong>{eur(Number(invoice.total_inc_vat))}</strong></div>
        <div className="card"><h2>Maksettu</h2><strong>{eur(Number(invoice.amount_paid))}</strong></div>
        <div className="card"><h2>Avoinna</h2><strong>{eur(Number(invoice.amount_open))}</strong></div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="between">
          <div><h2>Maksulinkki</h2><p className="muted">Status: {activeLink?.status || 'ei maksulinkkiä'}</p></div>
          <span className="badge">{paymentLinks?.length || 0} linkkiä</span>
        </div>
        <div className="buttonGrid">
          <form action={createPaymentLinkAction}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <button className="button primary" type="submit">Luo / hae maksulinkki</button>
          </form>
          <CopyPaymentLinkButton url={paymentUrl} />
          {paymentUrl ? <a className="button" href={paymentUrl} target="_blank">Avaa julkinen maksusivu</a> : <button className="button" disabled>Avaa julkinen maksusivu</button>}
          <form action={sendInvoiceEmailAction}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <button className="button" type="submit">Lähetä lasku sähköpostilla</button>
          </form>
        </div>
        {paymentUrl ? <p className="muted">{paymentUrl}</p> : null}
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card">
          <h2>Maksutapahtumat</h2>
          <div className="lineTable">
            {(sessions || []).map((session: any) => (
              <div className="lineRow" key={session.id}>
                <span>{paymentStatusLabel(session.status)}</span>
                <span>{session.provider_key}</span>
                <span>{eur(Number(session.amount))}</span>
                <strong>{new Date(session.created_at).toLocaleString('fi-FI')}</strong>
              </div>
            ))}
            {(!sessions || sessions.length === 0) ? <div className="lineRow"><span>Ei maksusessioita vielä.</span></div> : null}
          </div>

          <h3>Onnistuneet maksut ja täsmäytys</h3>
          <div className="lineTable">
            {(payments || []).map((payment: any) => (
              <div className="lineRow" key={payment.id}>
                <span>{payment.status === 'succeeded' ? 'Maksu onnistui' : 'Maksu epäonnistui'}</span>
                <span>{payment.provider_key || payment.payment_method}</span>
                <span>{reconciliationLabel(payment.reconciliation_status)}</span>
                <strong>{eur(Number(payment.amount))}</strong>
              </div>
            ))}
            {(!payments || payments.length === 0) ? <div className="lineRow"><span>Ei maksurivejä vielä.</span></div> : null}
          </div>
        </div>

        <div className="card">
          <h2>Webhookit ja eventit</h2>
          <div className="lineTable">
            {(events || []).map((event: any) => (
              <div className="lineRow" key={event.id}>
                <span>{paymentEventLabel(event.event_type)}</span>
                <span>{event.provider_key}</span>
                <span>{event.status}</span>
                <strong>{event.provider_event_id || '-'}</strong>
              </div>
            ))}
            {(!events || events.length === 0) ? <div className="lineRow"><span>Ei webhook-eventtejä vielä.</span></div> : null}
          </div>

          <h3>Webhook toimitukset</h3>
          <div className="lineTable">
            {(webhooks || []).map((delivery: any) => (
              <div className="lineRow" key={delivery.id}>
                <span>Webhook vastaanotettu</span>
                <span>{delivery.provider_key}</span>
                <span>{delivery.signature_valid ? 'Allekirjoitus ok' : 'Ei vahvistettu'}</span>
                <strong>{delivery.status}</strong>
              </div>
            ))}
            {(!webhooks || webhooks.length === 0) ? <div className="lineRow"><span>Ei webhook-toimituksia vielä.</span></div> : null}
          </div>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card">
          <h2>Tilisiirtotiedot</h2>
          <div className="bankGrid">
            <div><span>Saaja</span><strong>{organization?.name}</strong></div>
            <div><span>IBAN</span><strong>{organization?.default_iban || 'Puuttuu'}</strong></div>
            <div><span>BIC</span><strong>{organization?.default_bic || 'Puuttuu'}</strong></div>
            <div><span>Viite</span><strong>{invoice.reference_number}</strong></div>
            <div><span>Summa</span><strong>{eur(Number(invoice.amount_open))}</strong></div>
          </div>
        </div>
        <div className="card">
          <h2>Tapahtumaketju</h2>
          <div className="lineTable">
            {(auditLogs || []).map((log: any) => (
              <div className="lineRow" key={log.id}>
                <span>{log.action}</span>
                <span>{new Date(log.created_at).toLocaleString('fi-FI')}</span>
                <span>{log.entity_type}</span>
                <strong></strong>
              </div>
            ))}
            {(!auditLogs || auditLogs.length === 0) ? <div className="lineRow"><span>Ei audit-tapahtumia vielä.</span></div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
