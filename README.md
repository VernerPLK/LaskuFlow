# LaskuFlow — provider-pohjainen maksulinkkiarkkitehtuuri

Tämä repo sisältää ensimmäisen toteutuksen LaskuFlow-maksuarkkitehtuurista: lasku ei tunne Stripeä, Paytrailia, MobilePayta tai mock-maksua. Lasku tuntee vain summat, statuksen, maksulinkin, maksutapahtumat ja täsmäytykset. Provider-kohtainen logiikka on eristetty adaptereihin.

## Toteutettu nyt

- Supabase/PostgreSQL-migraatio provider-pohjaiselle tietomallille
- RLS organisaatiokohtaiseen dataeristykseen
- PaymentProviderAdapter-rajapinta
- Mock-provider kokonaan toimivaksi testimaksuja varten
- Stripe-provider Checkout Session + webhook-normalisointi
- Paytrail, MobilePay, Checkout Finland, Visma Pay ja tilisiirto integration-ready-adaptereina
- Julkinen token-pohjainen maksusivu `/pay/[token]`
- Maksusession luonti `/api/payment-sessions`
- Provider-webhookit `/api/webhooks/payments/[provider]`
- Mock-maksut `/api/mock-payments`
- Keskitetty `reconcilePaymentToInvoice(payment)`-logiikka
- Resend-laskusähköposti lähettäjällä `laskutus@pulkkimedia.com`
- Maksupalvelut-asetussivu `/settings/payments`
- Audit log ja email_events-kirjaukset

## Tärkeät tiedostot

```txt
supabase/migrations/20260613_payment_provider_architecture.sql
src/lib/payments/providers/types.ts
src/lib/payments/providers/mock-provider.ts
src/lib/payments/providers/stripe-provider.ts
src/lib/payments/providers/stub-providers.ts
src/lib/payments/provider-registry.ts
src/lib/payments/service.ts
src/lib/payments/reconcile.ts
src/lib/email/resend.ts
app/pay/[token]/page.tsx
app/api/payment-sessions/route.ts
app/api/mock-payments/route.ts
app/api/webhooks/payments/[provider]/route.ts
app/api/invoices/[invoiceId]/send/route.ts
app/settings/payments/page.tsx
```

## Env-muuttujat

Kopioi `.env.example` -> `.env.local` ja täytä:

```bash
NEXT_PUBLIC_APP_URL=https://oma-domain.fi
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=LaskuFlow <laskutus@pulkkimedia.com>
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Stripe on vapaaehtoinen MVP:ssä. Mock-maksu toimii ilman Stripeä.

## Supabase-migraatio

Aja migraatio Supabase SQL editorissa tai Supabase CLI:llä:

```bash
supabase db push
```

Migraatio luo tai täydentää seuraavat ydintaulut:

- `payment_providers`
- `payment_methods`
- `payment_links`
- `payment_sessions`
- `payment_events`
- `payment_webhook_deliveries`
- `payments` provider-kentillä
- `email_events`
- `audit_logs`

## Ensimmäinen testiflow

1. Luo organisaatio, asiakas, lasku ja laskurivit.
2. Aja SQL-funktio:

```sql
select public.create_payment_link_for_invoice('INVOICE_UUID');
```

3. Avaa selaimessa:

```txt
/pay/TOKEN
```

4. Paina `Testaa onnistunut maksu`, `Testaa osittainen maksu` tai `Testaa epäonnistunut maksu`.
5. Tarkista:
   - `payment_sessions`
   - `payment_events`
   - `payment_webhook_deliveries`
   - `payments`
   - `invoices.status`
   - `audit_logs`

## Maksun täsmäytys

`reconcilePaymentToInvoice(payment)` päivittää laskun näin:

- summa täsmää avoimeen summaan → `paid`
- summa on pienempi → `partially_paid`
- summa on suurempi → `paid` + audit log ylisorituksesta
- epäonnistunut maksu → ei muuta laskun paid-statusta

## Webhook-idempotenssi

`payment_events` sisältää uniikin avaimen `(provider_key, provider_event_id)`. Webhook käsitellään vain kerran, vaikka provider lähettäisi saman eventin uudelleen.

## Stripe

Stripe Checkout Session luodaan vain, jos `STRIPE_SECRET_KEY` on asetettu. Webhook validoidaan `STRIPE_WEBHOOK_SECRET`-salaisuudella.

Webhook URL:

```txt
/api/webhooks/payments/stripe
```

## Paytrail / MobilePay / verkkopankit

Nämä näkyvät UI:ssa integration-ready-statuksella. Niitä ei esitetä live-yhteytenä ennen oikeita tunnuksia ja providerin live-statusta.

## Seuraavat kovennukset

- Lisää invoice detail -välilehti, joka hakee ja näyttää `payment_sessions`, `payment_events`, `payments`, `payment_webhook_deliveries` ja `audit_logs`.
- Lisää PDF-generointi ja suojatut PDF-tokenit.
- Lisää pankkitapahtumien CSV-tuonti ja viitenumerotäsmäytys samaan reconciliation-kerrokseen.
- Lisää Inngest-eventit `invoice.sent`, `payment.webhook.received`, `invoice.payment.succeeded`, `invoice.payment.failed`, `daily.invoice.automation`.
- Lisää provider secrets -salaus KMS/Vault-rakenteella ennen live-avainten tallentamista tietokantaan.
