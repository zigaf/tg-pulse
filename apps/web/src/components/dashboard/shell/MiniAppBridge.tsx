'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { canGoBack, getWebApp, initMiniApp, isMiniApp, shouldShowBackButton } from '@/lib/tma';

/**
 * Mini App mode is only knowable in the browser (it depends on window.Telegram),
 * so it is resolved in an effect: the server and the first client render both see
 * `false`, which keeps hydration consistent and only then flips for Telegram users.
 */
export function useIsMiniApp(): boolean {
  const [isTma, setIsTma] = useState(false);
  useEffect(() => {
    setIsTma(isMiniApp());
  }, []);
  return isTma;
}

/**
 * Renders nothing. Mounted once per dashboard tree (app/app/layout.tsx) to
 * initialise the Telegram chrome and drive the native BackButton from the route:
 * visible on every /app/... page, hidden on the channel list root.
 */
export function MiniAppBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const isTma = useIsMiniApp();

  useEffect(() => {
    if (isTma) initMiniApp();
  }, [isTma]);

  useEffect(() => {
    const webApp = isTma ? getWebApp() : null;
    if (!webApp) return undefined;

    if (!shouldShowBackButton(pathname)) {
      webApp.BackButton.hide();
      return undefined;
    }

    const handleBack = () => {
      // A Mini App opened straight onto a deep page has nowhere to go back to.
      if (canGoBack(window.history.length)) router.back();
      else router.push('/app');
    };

    webApp.BackButton.onClick(handleBack);
    webApp.BackButton.show();
    // Only the handler is detached here; visibility is decided by the next run, so
    // moving between two nested pages does not blink the button off and on.
    return () => webApp.BackButton.offClick(handleBack);
  }, [isTma, pathname, router]);

  // Leaving the dashboard tree altogether is the one case the effect above cannot see.
  useEffect(() => () => getWebApp()?.BackButton.hide(), []);

  return null;
}
