'use client';

import { ArrowClockwise, CircleNotch, Pulse } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureTmaSession, resetTmaSession } from '@/lib/tma';
import ui from '../shared/ui.module.css';
import styles from './login.module.css';

type Phase = 'pending' | 'error';

interface MiniAppSignInProps {
  /** Runs once the initData exchange produced a token; the caller reloads its data. */
  onSignedIn: () => void;
  /**
   * Shown instead of the exchange when the caller already retried with a fresh token
   * and the API still answered 401: exchanging again cannot help, so no auto-retry.
   */
  exhausted?: boolean;
}

const EXCHANGE_FAILED = 'Telegram did not confirm your account. Close the app and open it again from the bot.';
const SESSION_REJECTED = 'Signed in with Telegram, but the dashboard rejected the session. Reopen the app from the bot.';

/**
 * Replaces the Login Widget inside a Telegram Mini App. There is nothing to click:
 * Telegram already vouches for the user through initData, so the card just runs
 * the exchange and hands control back. Reuses the LoginCard styles so the two
 * sign-in screens look identical.
 */
export function MiniAppSignIn({ onSignedIn, exhausted = false }: MiniAppSignInProps) {
  const [phase, setPhase] = useState<Phase>(exhausted ? 'error' : 'pending');
  const [error, setError] = useState(exhausted ? SESSION_REJECTED : '');
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;

  const exchange = useCallback(async () => {
    setPhase('pending');
    setError('');
    const token = await ensureTmaSession();
    if (token) {
      onSignedInRef.current();
      return;
    }
    setError(EXCHANGE_FAILED);
    setPhase('error');
  }, []);

  useEffect(() => {
    if (exhausted) return;
    // A previous token is what brought the user here, so start from a clean exchange.
    resetTmaSession();
    void exchange();
  }, [exchange, exhausted]);

  return (
    <main className={styles.screen}>
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.card} aria-labelledby="tma-login-heading">
        <span className={styles.mark}>
          <Pulse size={22} weight="bold" />
        </span>
        <h1 id="tma-login-heading" className={styles.title}>
          Opening TGPulse
        </h1>
        <p className={styles.subtitle}>Signing you in with your Telegram account.</p>

        {phase === 'pending' ? (
          <p className={styles.pending} role="status">
            <CircleNotch size={16} className={styles.spin} />
            Confirming with Telegram
          </p>
        ) : (
          <>
            <p className={styles.error} role="alert">
              {error}
            </p>
            {exhausted ? null : (
              <div className={styles.widget}>
                <button type="button" className={ui.btnGhost} onClick={() => void exchange()}>
                  <ArrowClockwise size={16} />
                  Try again
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
