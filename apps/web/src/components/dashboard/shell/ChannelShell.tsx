'use client';

import { ArrowLeft, ChartLineUp, LinkSimple, SignOut, UsersThree } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getMe, logout, type ApiChannel } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { Skeleton } from '../shared/States';
import styles from './shell.module.css';

const NAV_ITEMS = [
  { segment: '', label: 'Overview', icon: ChartLineUp, exact: true },
  { segment: '/links', label: 'Links', icon: LinkSimple, exact: false },
  { segment: '/subscribers', label: 'Subscribers', icon: UsersThree, exact: false },
] as const;

/** Sidebar shell for /app/channels/[id]/*. Collapses to top tabs on mobile. */
export function ChannelShell({ channelId, children }: { channelId: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [channel, setChannel] = useState<ApiChannel | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMe().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        if (result.status === 401) router.replace('/app');
        return;
      }
      const found = result.data.workspaces
        .flatMap((workspace) => workspace.channels)
        .find((item) => item.id === channelId);
      setChannel(found ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId, router]);

  const base = `/app/channels/${channelId}`;

  const handleSignOut = async () => {
    await logout();
    router.replace('/app');
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link href="/app" className={styles.backLink}>
            <ArrowLeft size={14} />
            Channels
          </Link>

          <div className={styles.channelBlock}>
            <span className={styles.avatar} aria-hidden="true">
              {channel ? channel.title.slice(0, 1).toUpperCase() : ''}
            </span>
            <div className={styles.channelText}>
              {channel ? (
                <>
                  <p className={styles.channelTitle}>{channel.title}</p>
                  <p className={styles.channelMeta}>
                    {channel.username ? `@${channel.username}` : formatNumber(channel.subscriberCount)}
                  </p>
                </>
              ) : (
                <>
                  <Skeleton width={110} height={13} />
                  <Skeleton width={70} height={10} />
                </>
              )}
            </div>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Channel navigation">
          {NAV_ITEMS.map(({ segment, label, icon: Icon, exact }) => {
            const href = `${base}${segment}`;
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={17} weight={isActive ? 'fill' : 'regular'} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <button type="button" className={styles.signOut} onClick={() => void handleSignOut()}>
          <SignOut size={16} />
          <span>Sign out</span>
        </button>
      </aside>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
