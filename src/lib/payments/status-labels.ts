export function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case 'created': return 'Maksu aloitettu';
    case 'pending': return 'Maksu odottaa vahvistusta';
    case 'requires_action': return 'Maksu vaatii lisätoimenpiteen';
    case 'succeeded': return 'Maksu onnistui';
    case 'failed': return 'Maksu epäonnistui';
    case 'cancelled': return 'Maksu keskeytettiin';
    case 'expired': return 'Maksu vanheni';
    case 'partially_paid': return 'Osittainen maksu vastaanotettu';
    default: return 'Maksutapahtuma';
  }
}

export function paymentEventLabel(eventType?: string | null) {
  if (!eventType) return 'Webhook vastaanotettu';
  if (eventType.includes('completed') || eventType.includes('succeeded')) return 'Maksu onnistui';
  if (eventType.includes('failed')) return 'Maksu epäonnistui';
  if (eventType.includes('partial')) return 'Osittainen maksu vastaanotettu';
  if (eventType.includes('webhook')) return 'Webhook vastaanotettu';
  if (eventType.includes('mock.payment')) return 'Mock-maksutapahtuma';
  return eventType;
}

export function reconciliationLabel(status?: string | null) {
  switch (status) {
    case 'matched': return 'Maksu täsmäytetty laskuun';
    case 'underpaid': return 'Alisuoritus — lasku jäi osittain avoimeksi';
    case 'overpaid': return 'Ylisuoritus — lasku merkitty maksetuksi';
    case 'manually_matched': return 'Täsmäytetty manuaalisesti';
    default: return 'Täsmäyttämättä';
  }
}
