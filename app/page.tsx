export default function HomePage() {
  return (
    <main className="pageShell">
      <section className="card heroCard">
        <div>
          <p className="eyebrow">LaskuFlow MVP</p>
          <h1>Rahat sisään ilman manuaalista säätöä.</h1>
          <p className="muted">Provider-pohjainen maksulinkkiarkkitehtuuri: mock, Stripe, Paytrail-valmius, tilisiirto ja webhook-tapahtumat.</p>
        </div>
        <div className="amountBox"><span>Arkkitehtuuri</span><strong>Provider-first</strong></div>
      </section>
      <section className="grid three">
        <div className="card"><h2>1. Luo lasku</h2><p>Laskulle luodaan viitenumero ja kryptografisesti vahva maksulinkkitoken.</p></div>
        <div className="card"><h2>2. Lähetä maksulinkki</h2><p>Resend lähettää laskun osoitteesta laskutus@pulkkimedia.com.</p></div>
        <div className="card"><h2>3. Täsmäytä maksu</h2><p>Mock ja Stripe kulkevat saman PaymentProvider-rajapinnan läpi.</p></div>
      </section>
    </main>
  );
}
