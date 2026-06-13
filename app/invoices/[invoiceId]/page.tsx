import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

function eur(value: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function statusText(type: string) {
  const map: Record<string, string> = {
    'payment_link_created': 'Maksulinkki luotu',
    'payment_session_created_mock': 'Mock-maksu aloitettu',
    'payment_session_created_stripe': 'Maksu aloitettu Stripessä',
    'payment_webhook_processed_mock': 'Webhook vastaanotettu',
    'payment_webhook_processed_stripe': 'Stripe-webhook vastaanotettu',
    'payment_reconciled_to_invoice': 'Maksu täsmäytetty laskuun',
    'payment_reconciled_overpaid': 'Maksu täsmäytetty laskuun: ylisuoritus',
    'invoice_email_sent': 'Laskusähköposti lähetetty',
  };
  return map[type] || type;
}

export default async function InvoiceDetailPage(props: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await props.params;
  const supabase = getSupabaseAdmin();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, customers(name, email), organizations(name)')
    .eq('id', invoiceId)
    .single();

  const [{ data: links }, { data: sessions }, { data: events }, { data: payments }, { data: webhooks }, { data: logs }] = await Promise.all([
    supabase.from('payment_links').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    supabase.from('payment_sessions').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    supabase.from('payment_events').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    supabase.from('payments').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    supabase.from('payment_webhook_deliveries').select('*').eq('organization_id', invoice?.organization_id || '').order('created_at', { ascending: false }).limit(20),
    supabase.from('audit_logs').select('*').eq('entity_id', invoiceId).order('created_at', { ascending: false }).limit(50),
  ]);

  if (!invoice) return <main className="pageShell"><div className="card"><h1>Laskua ei löytynyt</h1></div></main>;

  const firstLink = links?.[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const paymentUrl = firstLink ? `${appUrl}/pay/${firstLink.public_token}` : null;

  return (
    <main className="pageShell">
      <section className="card heroCard">
        <div><p className="eyebrow">Lasku</p><h1>{invoice.invoice_number}</h1><p className="muted">{invoice.customers?.name} · status {invoice.status}</p></div>
        <div className="amountBox"><span>Avoinna</span><strong>{eur(Number(invoice.amount_open))}</strong></div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Maksulinkki</h2>
          {paymentUrl ? <div className="stack"><code>{paymentUrl}</code><a className="button primary" href={paymentUrl}>Avaa julkinen maksusivu</a><a className="button" href={`/api/invoices/${invoice.id}/print`}>Tulosta / tallenna PDF</a></div> : <p className="muted">Tälle laskulle ei ole vielä maksulinkkiä.</p>}
        </div>
        <div className="card">
          <h2>Onnistuneet maksut</h2>
          {(payments || []).length === 0 ? <p className="muted">Ei maksuja vielä.</p> : payments?.map((payment: any) => <div className="lineRow" key={payment.id}><span>{payment.provider_key || payment.payment_method}</span><span>{payment.reconciliation_status}</span><strong>{eur(Number(payment.amount))}</strong><span>{new Date(payment.created_at).toLocaleString('fi-FI')}</span></div>)}
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card"><h2>Payment sessions</h2>{(sessions || []).map((session: any) => <div className="lineRow" key={session.id}><span>{session.provider_key}</span><span>{session.status}</span><strong>{eur(Number(session.amount))}</strong><span>{session.selected_method}</span></div>)}</div>
        <div className="card"><h2>Payment events</h2>{(events || []).map((event: any) => <div className="lineRow" key={event.id}><span>{event.event_type}</span><span>{event.status}</span><strong>{event.amount ? eur(Number(event.amount)) : '-'}</strong><span>{event.provider_key}</span></div>)}</div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card"><h2>Webhook-tapahtumat</h2>{(webhooks || []).map((delivery: any) => <div className="lineRow" key={delivery.id}><span>{delivery.provider_key}</span><span>{delivery.status}</span><strong>{delivery.signature_valid ? 'Allekirjoitus ok' : 'Ei vahvistettu'}</strong><span>{delivery.event_type || '-'}</span></div>)}</div>
        <div className="card"><h2>Tapahtumaketju</h2>{(logs || []).map((log: any) => <div className="lineRow" key={log.id}><span>{statusText(log.action)}</span><span>{new Date(log.created_at).toLocaleString('fi-FI')}</span><strong>{log.entity_type}</strong><span></span></div>)}</div>
      </section>
    </main>
  );
}
