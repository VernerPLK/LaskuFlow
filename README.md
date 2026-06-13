# LaskuFlow — provider-pohjainen maksulinkkiarkkitehtuuri

Tämä repo sisältää LaskuFlow-maksuarkkitehtuurin ensimmäisen toimivan MVP-rungon. Lasku ei tunne Stripeä, Paytrailia, MobilePayta tai mock-maksua. Lasku tuntee vain summat, statuksen, maksulinkin, maksutapahtumat ja täsmäytykset. Provider-kohtainen logiikka on eristetty adaptereihin.

## Toteutettu nyt

- Supabase/PostgreSQL-migraatio provider-pohjaiselle tietomallille
- RLS organisaatiokohtaiseen dataeristykseen
- PaymentProviderAdapter-rajapinta
- Mock-provider testimaksuja varten
- Stripe-provider Checkout Session + webhook-normalisointi
- Paytrail, MobilePay, Checkout Finland, Visma Pay ja tilisiirto integration-ready-adaptereina
- Julkinen token-pohjainen maksusivu `/pay/[token]`
- Maksusession luonti `/api/payment-sessions`
- Provider-webhookit `/api/webhooks/payments/[provider]`
- Mock-maksut `/api/mock-payments`
- Keskitetty `reconcilePaymentToInvoice(payment)`-logiikka
- Resend-laskusähköposti lähettäjällä `laskutus@pulkkimedia.com`
- Maksupalvelut-asetussivu `/settings/payments`
- Invoice detail -maksunäkymä `/invoices/[invoiceId]`
- Tulostettava laskudokumentti `/api/invoices/[invoiceId]/print`
- CSV-pankkirivien tuonti ja automaattinen viitenumerotäsmäytys `/api/imports/bank`
- Suomalaisen viitenumeron laskentafunktio
- Audit log ja email_events-kirjaukset

## Tärkeät tiedostot

```txt
supabase/migrations/20260613_payment_provider_architecture.sql
supabase/migrations/20260614_operational_tables.sql
supabase/migrations/20260614_operational_rls.sql
src/lib/invoices/reference-number.ts
src/lib/bank/import.ts
src/lib/payments/providers/types.ts
src/lib/payments/providers/mock-provider.ts
src/lib/payments/providers/stripe-provider.ts
src/lib/payments/providers/stub-providers.ts
src/lib/payments/provider-registry.ts
src/lib/payments/service.ts
src/lib/payments/reconcile.ts
src/lib/email/resend.ts
app/pay/[token]/page.tsx
app/invoices/[invoiceId]/page.tsx
app/api/payment-sessions/route.ts
app/api/mock-payments/route.ts
app/api/webhooks/payments/[provider]/route.ts
app/api/invoices/[invoiceId]/send/route.ts
app/api/invoices/[invoiceId]/payment-link/route.ts
app/api/invoices/[invoiceId]/print/route.ts
app/api/imports/bank/route.ts
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

Aja migraatiot Supabase SQL editorissa tai Supabase CLI:llä:

```bash
supabase db push
```

Migraatiot luovat tai täydentävät seuraavat taulut:

- `payment_providers`
- `payment_methods`
- `payment_links`
- `payment_sessions`
- `payment_events`
- `payment_webhook_deliveries`
- `payments` provider-kentillä
- `email_events`
- `audit_logs`
- `receipts`
- `imported_bank_rows`
- `reminder_rules`
- `reminders`
- `collection_cases`

## Ensimmäinen testiflow

1. Luo organisaatio, asiakas, lasku ja laskurivit.
2. Luo maksulinkki:

```bash
POST /api/invoices/INVOICE_UUID/payment-link
```

Tai SQL:llä:

```sql
select public.create_payment_link_for_invoice('INVOICE_UUID');
```

3. Avaa selaimessa:

```txt
/pay/TOKEN
```

4. Paina `Testaa onnistunut maksu`, `Testaa osittainen maksu` tai `Testaa epäonnistunut maksu`.
5. Tarkista invoice detail:

```txt
/invoices/INVOICE_UUID
```

## Maksun täsmäytys

`reconcilePaymentToInvoice(payment)` päivittää laskun näin:

- summa täsmää avoimeen summaan → `paid`
- summa on pienempi → `partially_paid`
- summa on suurempi → `paid` + audit log ylisuorituksesta
- epäonnistunut maksu → ei muuta laskun paid-statusta

## Webhook-idempotenssi

`payment_events` sisältää uniikin avaimen `(provider_key, provider_event_id)`. Webhook käsitellään vain kerran, vaikka provider lähettäisi saman eventin uudelleen.

## Stripe

Stripe Checkout Session luodaan vain, jos `STRIPE_SECRET_KEY` on asetettu. Webhook validoidaan `STRIPE_WEBHOOK_SECRET`-salaisuudella.

Webhook URL:

```txt
/api/webhooks/payments/stripe
```

## CSV-pankkituonti

Endpoint:

```txt
POST /api/imports/bank
```

FormData:

- `organizationId`
- `file` CSV-tiedostona

CSV-sarakkeet voivat olla:

```csv
date,amount,reference_number,payer_name,message
2026-06-14,125.50,10095,Asiakas Oy,Lasku 1009
```

Tuonti luo `imported_bank_rows`-rivin, etsii laskun viitenumerolla ja luo `payments`-rivin, joka kulkee saman täsmäytyslogiikan läpi.

## Tulostettava lasku

```txt
/api/invoices/INVOICE_UUID/print
```

Tämä avaa ammattimaisen HTML-laskun, jonka selain voi tulostaa tai tallentaa PDF:nä.

## Paytrail / MobilePay / verkkopankit

Nämä näkyvät UI:ssa integration-ready-statuksella. Niitä ei esitetä live-yhteytenä ennen oikeita tunnuksia ja providerin live-statusta.

## Jäljellä ennen kaupallista tuotantoa

- Aja `npm install`, `npm run typecheck` ja `npm run build`.
- Korjaa mahdolliset Supabase join -tyyppierot buildin mukaan.
- Lisää oikea kirjautuminen/onboarding-polku, jos sitä ei vielä ole appissa.
- Lisää suojatut PDF-tokenit, jos PDF-linkit lähetetään asiakkaalle julkisesti.
- Lisää Inngest myöhemmässä vaiheessa, jos haluat kaikki taustatyöt irti API-pyynnöistä.
- Lisää Paytrailin oikea live-adapteri vasta, kun merchant id ja salaisuudet ovat käytössä.
