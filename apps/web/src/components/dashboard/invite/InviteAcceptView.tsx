'use client';

import { ArrowRight, CheckCircle, LinkBreak, Prohibit, UsersFour } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acceptInvite,
  getInvite,
  getMe,
  type WorkspaceRole,
} from '@/lib/api';
import { LoginCard } from '../login/LoginCard';
import { Skeleton } from '../shared/States';
import ui from '../shared/ui.module.css';
import styles from './invite.module.css';

type Phase = 'checking' | 'login' | 'ready' | 'accepting' | 'accepted' | 'expired' | 'notFound' | 'error';

const GONE = 410;
const NOT_FOUND = 404;

const ROLE_LABELS: Record<WorkspaceRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', VIEWER: 'Viewer' };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.card} aria-labelledby="invite-heading">
        {children}
      </section>
    </main>
  );
}

/**
 * Accept screen for a one-time workspace invite.
 * Without a session it shows the sign-in card and retries the accept right after login,
 * so the token survives the round trip.
 */
export function InviteAcceptView({ token }: { token: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [error, setError] = useState('');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const accept = useCallback(async () => {
    setPhase('accepting');
    setError('');
    const result = await acceptInvite(token);
    if (!isMounted.current) return;

    if (result.ok) {
      setWorkspaceName((previous) => result.data?.workspaceName ?? previous);
      setPhase('accepted');
      router.replace('/app');
      return;
    }
    if (result.status === 401) {
      setPhase('login');
      return;
    }
    // Only a real API envelope is trusted to mean "gone" or "unknown token".
    if (result.envelope && result.status === GONE) {
      setPhase('expired');
      return;
    }
    if (result.envelope && result.status === NOT_FOUND) {
      setPhase('notFound');
      return;
    }
    setError(result.error);
    setPhase('error');
  }, [router, token]);

  const bootstrap = useCallback(
    async (shouldAutoAccept: boolean) => {
      setPhase('checking');
      setError('');

      // The preview is public, so it resolves even before the invitee signs in and the
      // login screen can already name the workspace they are joining.
      const [preview, me] = await Promise.all([getInvite(token), getMe()]);
      if (!isMounted.current) return;

      if (preview.ok) {
        setWorkspaceName(preview.data.workspaceName ?? null);
        setRole(preview.data.role ?? null);
      } else if (preview.envelope && preview.status === GONE) {
        setPhase('expired');
        return;
      } else if (preview.envelope && preview.status === NOT_FOUND) {
        setPhase('notFound');
        return;
      }

      if (!me.ok) {
        if (me.status === 401) {
          setPhase('login');
          return;
        }
        setError(me.error);
        setPhase('error');
        return;
      }

      if (shouldAutoAccept) {
        void accept();
        return;
      }
      setPhase('ready');
    },
    [accept, token],
  );

  useEffect(() => {
    void bootstrap(false);
  }, [bootstrap]);

  if (phase === 'login') {
    return (
      <LoginCard
        title="Sign in to join"
        subtitle={
          workspaceName
            ? `The invite to ${workspaceName} is waiting. Sign in with Telegram and it is applied right away.`
            : 'Sign in with Telegram and the invite is applied right away.'
        }
        onSignedIn={() => void bootstrap(true)}
      />
    );
  }

  if (phase === 'checking') {
    return (
      <Card>
        <div className={styles.skeletonStack} aria-busy="true" aria-label="Loading invite">
          <Skeleton width={46} height={46} radius={14} />
          <Skeleton width={200} height={22} />
          <Skeleton width={260} height={13} />
          <Skeleton width={140} height={36} radius={12} />
        </div>
      </Card>
    );
  }

  if (phase === 'expired') {
    return (
      <Card>
        <span className={styles.markMuted} aria-hidden="true">
          <LinkBreak size={22} weight="duotone" />
        </span>
        <h1 id="invite-heading" className={styles.title}>
          This invite is no longer valid
        </h1>
        <p className={styles.body}>
          Invite links work once and expire after 7 days. Ask the workspace owner for a fresh link.
        </p>
        <div className={styles.actions}>
          <Link href="/app" className={ui.btnGhost}>
            Go to TGPulse
          </Link>
        </div>
      </Card>
    );
  }

  if (phase === 'notFound') {
    return (
      <Card>
        <span className={styles.markMuted} aria-hidden="true">
          <Prohibit size={22} weight="duotone" />
        </span>
        <h1 id="invite-heading" className={styles.title}>
          Invite not found
        </h1>
        <p className={styles.body}>
          The link is incomplete or was revoked. Check that you copied the whole URL, then ask for a new invite.
        </p>
        <div className={styles.actions}>
          <Link href="/app" className={ui.btnGhost}>
            Go to TGPulse
          </Link>
        </div>
      </Card>
    );
  }

  if (phase === 'accepted') {
    return (
      <Card>
        <span className={styles.mark} aria-hidden="true">
          <CheckCircle size={22} weight="fill" />
        </span>
        <h1 id="invite-heading" className={styles.title}>
          You are in
        </h1>
        <p className={styles.body}>
          {workspaceName ? `${workspaceName} is now on your account.` : 'The workspace is now on your account.'} Taking
          you to the dashboard.
        </p>
        <div className={styles.actions}>
          <Link href="/app" className={ui.btnPrimary}>
            Open dashboard
            <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <span className={styles.mark} aria-hidden="true">
        <UsersFour size={22} weight="duotone" />
      </span>
      <p className={styles.eyebrow}>Workspace invite</p>
      <h1 id="invite-heading" className={styles.title}>
        You were invited to
      </h1>
      <p className={styles.workspace}>{workspaceName ?? 'a TGPulse workspace'}</p>
      {role ? <span className={styles.roleLine}>{ROLE_LABELS[role]} access</span> : null}
      <p className={styles.body}>
        Accepting adds the workspace channels to your account with the access level above.
      </p>

      {phase === 'error' && error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Link href="/app" className={ui.btnGhost}>
          Not now
        </Link>
        <button
          type="button"
          className={ui.btnPrimary}
          onClick={() => void accept()}
          disabled={phase === 'accepting'}
        >
          {phase === 'accepting' ? 'Joining' : 'Accept invite'}
          {phase === 'accepting' ? null : <ArrowRight size={14} weight="bold" />}
        </button>
      </div>

      <p className={styles.footnote}>One-time link, expires 7 days after it was created.</p>
    </Card>
  );
}
