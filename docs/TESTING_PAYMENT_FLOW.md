# LaskuFlow maksuflown testaus

## 1. Aja migraatiot

```bash
supabase db push
```

Varmista, että nämä taulut löytyvät:

- payment_providers
- payment_methods
- payment_links
- payment_sessions
- payment_events
- payment_webhook_deliveries
- payments
- bank_connections
- bank_transactions
- reminder_rules
- reminders
- collection_cases
- audit_logs
- email_events

## 2. Lisää ympäristömuuttujat

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=LaskuFlow <laskutus@pulkkimedia.com>
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Mock-maksu toimii ilman Stripe-avaimia.

## 3. Luo testilasku

Luo organisaatio, asiakas ja lasku Supabaseen. Laskulla pitää olla:

- organization_id
- customer_id
- invoice_number
- reference_number
- due_date
- total_inc_vat
- amount_open
- status = open

## 4. Avaa laskun detail

```txt
/invoices/INVOICE_UUID
```

Paina:

1. Luo / hae maksulinkki
2. Kopioi maksulinkki
3. Avaa julkinen maksusivu

## 5. Testaa mock-maksut

Avaa `/pay/[token]` ja paina:

- Testaa onnistunut maksu
- Testaa osittainen maksu
- Testaa epäonnistunut maksu

Tarkista Supabasesta:

- payment_sessions päivittyy
- payment_events syntyy
- payment_webhook_deliveries tallentuu
- payments syntyy vain onnistuneesta tai osittaisesta maksusta
- invoices.status muuttuu paid tai partially_paid
- audit_logs näyttää tapahtumaketjun

## 6. Testaa Stripe

Kun Stripe-avaimet on lisätty:

1. Avaa `/pay/[token]`
2. Paina Maksa kortilla
3. Stripe Checkout avautuu
4. Maksun jälkeen Stripe lähettää webhookin osoitteeseen:

```txt
/api/webhooks/payments/stripe
```

Webhook saa merkitä laskun maksetuksi vain, jos allekirjoitus on validi.

## 7. Testaa pankki-CSV

POST JSON:

```json
{
  "organizationId": "ORG_UUID",
  "csv": "date;amount;reference;debtor\n2026-06-14;100,00;12344;Testi Oy"
}
```

Endpoint:

```txt
/api/bank-transactions/import-csv
```

Jos viite täsmää laskuun, järjestelmä luo pankkitapahtuman, payment-rivin ja käyttää samaa täsmäytyslogiikkaa kuin korttimaksut.
