'use client';

import { useState } from 'react';

export function CopyPaymentLinkButton({ url }: { url?: string | null }) {
  const [label, setLabel] = useState('Kopioi maksulinkki');

  if (!url) return <button className="button" disabled>Kopioi maksulinkki</button>;

  return (
    <button
      className="button"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setLabel('Kopioitu');
        setTimeout(() => setLabel('Kopioi maksulinkki'), 1800);
      }}
    >
      {label}
    </button>
  );
}
