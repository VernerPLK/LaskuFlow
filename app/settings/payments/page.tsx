import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

export default async function PaymentSettingsPage() {
  const supabase = getSupabaseAdmin();
  const { data: providers } = await supabase
    .from('payment_providers')
    .select('provider_key, provider_name, status, mode')
    .order('provider_key');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const rows = providers || [];
  const keys = ['mock','stripe','paytrail','bank_transfer','mobilepay','checkout_finland','visma_pay'];

  return (
    <main className="pageShell">
      <div className="pageHeader">
        <p className="eyebrow">Asetukset</p>
        <h1>Maksupalvelut</h1>
        <p className="muted">Provider-pohjainen maksukerros. Salaisia arvoja ei näytetä käyttöliittymässä.</p>
      </div>
      <div className="grid three">
        {keys.map((key) => {
          const provider = rows.find((p: any) => p.provider_key === key);
          const name = provider?.provider_name || key;
          return (
            <section className="card" key={key}>
              <div className="between"><h2>{name}</h2><span className="badge">{provider?.status || 'not_connected'}</span></div>
              <p className="muted">Mode: {provider?.mode || 'test'}</p>
              {key === 'mock' && <p>Testaa onnistunut, epäonnistunut ja osittainen maksu maksusivulla.</p>}
              {key === 'stripe' && <p>Webhook URL: <code>{appUrl}/api/webhooks/payments/stripe</code>. Lisää tarvittavat Stripe-ympäristömuuttujat palvelimen asetuksiin.</p>}
              {key === 'paytrail' && <p>Valmis yhdistettäväksi merchant-tunnuksilla: suomalaiset verkkopankit, kortit ja MobilePay-tuki sopimuksen mukaan.</p>}
              {key === 'bank_transfer' && <p>Tilisiirto näkyy asiakkaalle, kun organisaation IBAN ja BIC on asetettu.</p>}
              {key === 'mobilepay' && <p>Integration-ready. Ei näytetä live-maksuna ennen API-avaimia.</p>}
              {(key === 'checkout_finland' || key === 'visma_pay') && <p>Provider-paikka on valmiina myöhempää kytkentää varten.</p>}
            </section>
          );
        })}
      </div>
    </main>
  );
}
