import Script from 'next/script';
import '../globals.css';
import { RootDocument, rootMetadata } from '../root-document';

export const metadata = rootMetadata;

/**
 * Dashboard root (/app/...). Loads the Telegram Mini App SDK before hydration so
 * `window.Telegram.WebApp` (and its initData) exists when the first effect runs;
 * outside Telegram the script is inert. It writes --tg-viewport-* inline styles
 * onto <html> before React hydrates, hence suppressHydrationWarning on the root.
 * CSP allows script-src https://telegram.org (next.config.mjs).
 */
export default function MiniAppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument
      suppressHydrationWarning
      head={<Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />}
    >
      {children}
    </RootDocument>
  );
}
