import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Pharmodry', template: '%s · Pharmodry' },
  description: 'Pharmodry — Precision in Every Batch. Pharmaceutical operations, quality and compliance intelligence platform.',
  applicationName: 'Pharmodry',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/pharmodry-mark-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/pharmodry-mark-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
