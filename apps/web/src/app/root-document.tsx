import type { Metadata } from 'next';
import { JetBrains_Mono, Onest } from 'next/font/google';
import type { ReactNode } from 'react';

/**
 * The <html>/<body> shell shared by both root layouts. There are two of them
 * (route groups `(site)` and `(mini-app)`) so that the Telegram Mini App SDK is
 * loaded only for the dashboard: it must be a `beforeInteractive` script, and
 * Next only honours that strategy inside a root layout.
 */

const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });
const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const rootMetadata: Metadata = {
  title: 'TGPulse: see where your Telegram subscribers and revenue come from',
  description:
    'Exact subscriber attribution for Telegram channels, conversion postbacks to ad platforms, ROMI per source. A live dashboard instead of spreadsheets.',
};

export function RootDocument({
  children,
  head,
  suppressHydrationWarning = false,
}: {
  children: ReactNode;
  /** Rendered first inside <body>; used for scripts that must precede hydration. */
  head?: ReactNode;
  suppressHydrationWarning?: boolean;
}) {
  return (
    <html
      lang="en"
      className={`${onest.variable} ${mono.variable}`}
      suppressHydrationWarning={suppressHydrationWarning}
    >
      <body>
        {head}
        {children}
      </body>
    </html>
  );
}
