'use client';

import {
  ArrowLeft,
  ChartLineUp,
  CurrencyCircleDollar,
  LinkSimple,
  Lock,
  Megaphone,
  PaperPlaneTilt,
  SignOut,
  UsersFour,
  UsersThree,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  getMe,
  getMembers,
  logout,
  type ApiChannel,
  type ApiWorkspace,
  type WorkspaceRole,
} from '@/lib/api';
import { isFeatureLocked, normalizePlan, type GatedFeature } from '@/lib/billing';
import { formatNumber } from '@/lib/format';
import { PlanBadge } from '../shared/PlanBadge';
import { Skeleton } from '../shared/States';
import { billingHref } from '../shared/UpgradeCard';
import { teamHref } from '../team/team-href';
import { WorkspaceProvider } from './workspace-context';
import styles from './shell.module.css';

const NAV_ITEMS: {
  segment: string;
  label: string;
  icon: typeof ChartLineUp;
  exact: boolean;
  /** Sections the plan can lock; the API is still the authority and answers 402. */
  feature?: GatedFeature;
}[] = [
  { segment: '', label: 'Overview', icon: ChartLineUp, exact: true },
  { segment: '/links', label: 'Links', icon: LinkSimple, exact: false },
  { segment: '/postbacks', label: 'Postbacks', icon: PaperPlaneTilt, exact: false, feature: 'postbacks' },
  // Native ad-platform connections; same gate as postbacks (docs/AD-INTEGRATIONS.md).
  { segment: '/integrations', label: 'Ad platforms', icon: Megaphone, exact: false, feature: 'postbacks' },
  { segment: '/revenue', label: 'Revenue', icon: CurrencyCircleDollar, exact: false, feature: 'revenue' },
  { segment: '/subscribers', label: 'Subscribers', icon: UsersThree, exact: false },
];

/** Sidebar shell for /app/channels/[id]/*. Collapses to top tabs on mobile. */
export function ChannelShell({ channelId, children }: { channelId: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [channel, setChannel] = useState<ApiChannel | null>(null);
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const result = await getMe();
      if (cancelled) return;
      if (!result.ok) {
        if (result.status === 401) router.replace('/app');
        return;
      }

      const owner = result.data.workspaces.find((item) =>
        item.channels.some((candidate) => candidate.id === channelId),
      );
      setWorkspace(owner ?? null);
      setChannel(owner?.channels.find((candidate) => candidate.id === channelId) ?? null);

      if (!owner) return;
      if (owner.role) {
        setRole(owner.role);
        return;
      }

      // Older server builds do not put the role on /api/me, so read it from the member list.
      // A failure here just leaves the role unknown: the API still answers 403 on a real gate.
      const members = await getMembers(owner.id);
      if (cancelled || !members.ok) return;
      const self = members.data.members.find((member) => member.userId === result.data.user.id);
      setRole(members.data.role ?? self?.role ?? null);
    };

    void resolve();
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

          {workspace ? (
            <div className={styles.planRow}>
              <PlanBadge plan={normalizePlan(workspace.plan)} workspaceId={workspace.id} />
            </div>
          ) : null}
        </div>

        <nav className={styles.nav} aria-label="Channel navigation">
          {NAV_ITEMS.map(({ segment, label, icon: Icon, exact, feature }) => {
            const href = `${base}${segment}`;
            const isLocked = feature !== undefined && isFeatureLocked(workspace?.entitlements, feature);

            if (isLocked) {
              return (
                <Link
                  key={href}
                  href={billingHref(workspace?.id)}
                  className={`${styles.navItem} ${styles.navItemLocked}`}
                  aria-label={`${label}, available on a paid plan`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  <Lock size={13} weight="fill" className={styles.navLock} aria-hidden="true" />
                </Link>
              );
            }

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

          {/* Workspace-level, so it sits apart from the channel sections. */}
          <span className={styles.navDivider} aria-hidden="true" />
          <Link href={teamHref(workspace?.id)} className={styles.navItem}>
            <UsersFour size={17} />
            <span>Team</span>
          </Link>
        </nav>

        <button type="button" className={styles.signOut} onClick={() => void handleSignOut()}>
          <SignOut size={16} />
          <span>Sign out</span>
        </button>
      </aside>

      <div className={styles.content}>
        <WorkspaceProvider workspace={workspace} role={role}>
          {children}
        </WorkspaceProvider>
      </div>
    </div>
  );
}
