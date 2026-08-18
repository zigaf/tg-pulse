'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChannelsHome } from '@/components/dashboard/channels/ChannelsHome';
import { LoginCard } from '@/components/dashboard/login/LoginCard';
import { ErrorState, Skeleton } from '@/components/dashboard/shared/States';
import ui from '@/components/dashboard/shared/ui.module.css';
import { getMe, type MeData } from '@/lib/api';

type Phase = 'loading' | 'login' | 'ready' | 'error';

function LoadingScreen() {
  return (
    <main
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '1.4rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
      aria-busy="true"
    >
      <Skeleton width={220} height={34} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.9rem' }}>
        {Array.from({ length: 3 }, (_, index) => (
          <span key={index} className={ui.skeleton} style={{ height: 104, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    </main>
  );
}

export default function AppRootPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [me, setMe] = useState<MeData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    const result = await getMe();
    if (result.ok) {
      setMe(result.data);
      setPhase('ready');
      return;
    }
    if (result.status === 401) {
      setPhase('login');
      return;
    }
    setError(result.error);
    setPhase('error');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === 'loading') return <LoadingScreen />;
  if (phase === 'login') return <LoginCard />;
  if (phase === 'error') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
        <ErrorState message={error} onRetry={() => void load()} />
      </main>
    );
  }
  return me ? <ChannelsHome me={me} /> : null;
}
