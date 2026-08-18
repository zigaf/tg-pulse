import type { Metadata } from 'next';
import { JetBrains_Mono, Onest } from 'next/font/google';
import './globals.css';

const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });
const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'TGPulse: see where your Telegram subscribers and revenue come from',
  description:
    'Exact subscriber attribution for Telegram channels, conversion postbacks to ad platforms, ROMI per source. A live dashboard instead of spreadsheets.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${onest.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
