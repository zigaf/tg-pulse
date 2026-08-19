'use client';

import { ArrowUpRight, Broadcast, Pulse, SignOut, TelegramLogo, UsersFour } from '@phosphor-icons/react';
import Link from 'next/link';
import type { ApiChannel, MeData } from '@/lib/api';
import { logout } from '@/lib/api';
import { normalizePlan } from '@/lib/billing';
import { BOT_USERNAME, formatNumber } from '@/lib/format';
import { PlanBadge } from '../shared/PlanBadge';
import { EmptyState } from '../shared/States';
import { teamHref } from '../team/team-href';
import ui from '../shared/ui.module.css';
import styles from './channels.module.css';

function botStatusBadge(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'ACTIVE') return ui.badgePositive;
  if (normalized === 'PENDING') return ui.badgeWarning;
  return ui.badgeNegative;
}

function ChannelCard({ channel }: { channel: ApiChannel }) {
  return (
    <Link href={`/app/channels/${channel.id}`} className={styles.card}>
      <span className={styles.avatar} aria-hidden="true">
        {channel.title.slice(0, 1).toUpperCase()}
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{channel.title}</span>
          <span className={botStatusBadge(channel.botStatus)}>{channel.botStatus.toLowerCase()}</span>
        </span>
        {channel.username ? <span className={styles.cardUsername}>@{channel.username}</span> : null}
        <span className={styles.cardMeta}>
          <span className={styles.cardCount}>{formatNumber(channel.subscriberCount)}</span> subscribers
        </span>
      </span>
      <ArrowUpRight size={16} className={styles.cardArrow} aria-hidden="true" />
    </Link>
  );
}

function NoChannels() {
  return (
    <div className={ui.card}>
      <EmptyState icon={<Broadcast size={26} weight="duotone" />} title="No channels yet">
        <ol className={styles.steps}>
          <li>Open your channel settings in Telegram and add @{BOT_USERNAME} as an administrator.</li>
          <li>Grant it permission to invite users via link.</li>
          <li>The bot confirms in chat and the channel appears here within a minute.</li>
        </ol>
        <a
          className={ui.btnPrimary}
          href={`https://t.me/${BOT_USERNAME}`}
          target="_blank"
          rel="noreferrer"
        >
          <TelegramLogo size={16} weight="fill" />
          Open @{BOT_USERNAME}
        </a>
      </EmptyState>
    </div>
  );
}

/** Signed-in root: workspace channels as cards. */
export function ChannelsHome({ me }: { me: MeData }) {
  const channels = me.workspaces.flatMap((workspace) => workspace.channels);
  const primaryWorkspace = me.workspaces[0];

  const handleSignOut = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.wordmark}>
          <Pulse size={18} weight="bold" />
          TGPulse
        </span>
        <div className={styles.topbarRight}>
          <Link href={teamHref(primaryWorkspace?.id)} className={styles.topbarLink}>
            <UsersFour size={15} />
            Team
          </Link>
          {primaryWorkspace ? (
            <PlanBadge plan={normalizePlan(primaryWorkspace.plan)} workspaceId={primaryWorkspace.id} />
          ) : null}
          <span className={styles.userName}>{me.user.firstName}</span>
          <button type="button" className={ui.btnGhost} onClick={() => void handleSignOut()}>
            <SignOut size={15} />
            Sign out
          </button>
        </div>
      </header>

      <section aria-labelledby="channels-heading" className={styles.content}>
        <div className={styles.headingRow}>
          <h1 id="channels-heading" className={styles.heading}>
            Your channels
          </h1>
          <p className={styles.headingHint}>Pick a channel to see attribution and links.</p>
        </div>

        {channels.length === 0 ? (
          <NoChannels />
        ) : (
          <div className={styles.grid}>
            {channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
