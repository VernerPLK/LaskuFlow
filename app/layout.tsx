import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LaskuFlow',
  description: 'Simppelein tapa lähettää lasku, maksulinkki ja seurata maksua.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  );
}
