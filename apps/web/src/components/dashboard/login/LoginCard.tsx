'use client';

import { CircleNotch, Pulse } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { authTelegram, type TelegramAuthPayload } from '@/lib/api';
import { TelegramLoginWidget } from './TelegramLoginWidget';
import styles from './login.module.css';

type Phase = 'idle' | 'pending' | 'error';

interface LoginCardProps {
  title?: string;
  subtitle?: ReactNode;
  /**
   * Called instead of reloading the page once the session cookie is set.
   * The invite screen uses it to retry the accept without losing the token.
   */
  onSignedIn?: () => void;
}

/** Centered sign-in card shown when GET /api/me returns 401. */
export function LoginCard({ title = 'Sign in to TGPulse', subtitle, onSignedIn }: LoginCardProps = {}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');

  const handleAuth = async (payload: TelegramAuthPayload) => {
    setPhase('pending');
    setError('');
    const result = await authTelegram(payload);
    if (result.ok) {
      if (onSignedIn) onSignedIn();
      else window.location.reload();
      return;
    }
    setError(result.error);
    setPhase('error');
  };

  return (
    <main className={styles.screen}>
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.card} aria-labelledby="login-heading">
        <span className={styles.mark}>
          <Pulse size={22} weight="bold" />
        </span>
        <h1 id="login-heading" className={styles.title}>
          {title}
        </h1>
        <p className={styles.subtitle}>
          {subtitle ?? 'Use your Telegram account. We only read your public profile, nothing else.'}
        </p>

        {phase === 'pending' ? (
          <p className={styles.pending} role="status">
            <CircleNotch size={16} className={styles.spin} />
            Confirming with Telegram
          </p>
        ) : (
          <div className={styles.widget}>
            <TelegramLoginWidget onAuth={(payload) => void handleAuth(payload)} />
          </div>
        )}

        {phase === 'error' && error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <p className={styles.footnote}>
          A session cookie keeps you signed in for 30 days on this device.
        </p>
      </section>
    </main>
  );
}
