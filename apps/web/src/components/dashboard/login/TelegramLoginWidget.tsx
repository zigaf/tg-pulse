'use client';

import { useEffect, useRef } from 'react';
import type { TelegramAuthPayload } from '@/lib/api';
import { BOT_USERNAME } from '@/lib/format';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthPayload) => void;
  }
}

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';

/** Mounts the official Telegram Login Widget and forwards its payload to onAuth. */
export function TelegramLoginWidget({ onAuth }: { onAuth: (payload: TelegramAuthPayload) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    window.onTelegramAuth = (payload) => onAuthRef.current(payload);

    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      container.replaceChildren();
    };
  }, []);

  return <div ref={containerRef} style={{ minHeight: 44 }} />;
}
