'use client';

import { useState } from 'react';

export function MockPaymentButtons(props: {
  paymentSessionId?: string | null;
  invoiceId: string;
  organizationId: string;
  amountOpen: number;
  currency: string;
}) {
  const [message, setMessage] = useState<string>('');

  async function runMock(outcome: 'succeeded' | 'failed' | 'partial') {
    setMessage('Käsitellään testimaksua...');
    const amount = outcome === 'partial' ? Math.max(Number((props.amountOpen / 2).toFixed(2)), 0.01) : props.amountOpen;
    const response = await fetch('/api/mock-payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        outcome,
        paymentSessionId: props.paymentSessionId,
        invoiceId: props.invoiceId,
        organizationId: props.organizationId,
        amount,
        currency: props.currency,
      }),
    });
    const data = await response.json();
    setMessage(data.ok ? 'Testimaksu käsitelty. Päivitä sivu nähdäksesi uusi laskustatus.' : data.error);
  }

  return (
    <div className="buttonGrid">
      <button className="button primary" onClick={() => runMock('succeeded')}>Testaa onnistunut maksu</button>
      <button className="button" onClick={() => runMock('partial')}>Testaa osittainen maksu</button>
      <button className="button danger" onClick={() => runMock('failed')}>Testaa epäonnistunut maksu</button>
      {message ? <p className="muted full">{message}</p> : null}
    </div>
  );
}
