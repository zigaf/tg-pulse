'use client';

import { LinkSimple, Plus } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { getLinks, revokeLink, type TrackedLink } from '@/lib/api';
import { formatFullDate, formatNumber } from '@/lib/format';
import { EmptyState, ErrorState, SkeletonRows } from '../shared/States';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import { UpgradeNotice } from '../shared/UpgradeCard';
import { useWorkspace } from '../shell/workspace-context';
import { CopyButton } from './CopyButton';
import { CreateLinkModal } from './CreateLinkModal';
import { InstallPixelModal } from './InstallPixelModal';
import styles from './links.module.css';

const TABLE_STYLE = { '--cols': '1.3fr 1.4fr 0.45fr 0.45fr 0.45fr 0.7fr 0.75fr 1.15fr', '--min-width': '900px' } as CSSProperties;
const CONFIRM_RESET_MS = 3000;

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function LandingCell({ views, clicks }: { views: number; clicks: number }) {
  if (views === 0 && clicks === 0) {
    return <span className={styles.landingCell}>—</span>;
  }
  return (
    <span className={styles.landingCell} title="Pixel pageviews → outbound clicks">
      <span className={styles.landingViews}>{formatNumber(views)}</span>
      <span className={styles.landingArrow} aria-hidden="true">
        →
      </span>
      {formatNumber(clicks)}
    </span>
  );
}

function LinkRow({
  link,
  isConfirming,
  isRevoking,
  onRevokeClick,
  onInstallPixel,
}: {
  link: TrackedLink;
  isConfirming: boolean;
  isRevoking: boolean;
  onRevokeClick: (id: string) => void;
  onInstallPixel: (link: TrackedLink) => void;
}) {
  return (
    <div className={`${table.row} ${table.rowHover} ${link.isRevoked ? styles.rowRevoked : ''}`}>
      <span className={styles.labelCell}>
        <span className={table.cellTitle}>{link.label}</span>
        {link.creative ? <span className={table.cellSub}>{link.creative}</span> : null}
      </span>
      <span className={styles.urlCell}>
        <span className={styles.url}>{shortUrl(link.url)}</span>
        <CopyButton text={link.url} />
      </span>
      <span className={table.num}>{formatNumber(link.clicks)}</span>
      <span className={table.numStrong}>{formatNumber(link.joins)}</span>
      <span className={table.num}>{formatNumber(link.leaves)}</span>
      <LandingCell views={link.pixelViews} clicks={link.pixelClicks} />
      <span className={table.num}>{formatFullDate(link.createdAt)}</span>
      <span className={styles.actionsCell}>
        <button type="button" className={styles.pixelBtn} onClick={() => onInstallPixel(link)}>
          Install pixel
        </button>
        {link.isRevoked ? (
          <span className={ui.badgeNegative}>revoked</span>
        ) : (
          <button
            type="button"
            className={`${styles.revokeBtn} ${isConfirming ? styles.revokeConfirm : ''}`}
            onClick={() => onRevokeClick(link.id)}
            disabled={isRevoking}
          >
            {isRevoking ? 'Revoking' : isConfirming ? 'Confirm?' : 'Revoke'}
          </button>
        )}
      </span>
    </div>
  );
}

/** Tracked links: list, create, copy go-URL, revoke with inline confirm. */
export function LinksView({ channelId }: { channelId: string }) {
  const [links, setLinks] = useState<TrackedLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pixelLink, setPixelLink] = useState<TrackedLink | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspace = useWorkspace();

  const load = useCallback(async () => {
    setError(null);
    setLinks(null);
    const result = await getLinks(channelId);
    if (result.ok) setLinks(result.data);
    else setError(result.error);
  }, [channelId]);

  useEffect(() => {
    void load();
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [load]);

  const handleRevokeClick = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingId(null), CONFIRM_RESET_MS);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(null);
    setRevokingId(id);
    setActionError('');
    const result = await revokeLink(id);
    setRevokingId(null);
    if (result.ok) {
      setLinks((previous) =>
        previous ? previous.map((link) => (link.id === id ? { ...link, isRevoked: true } : link)) : previous,
      );
    } else {
      setActionError(result.error);
    }
  };

  const handleCreated = (link: TrackedLink) => {
    setUpgradeMessage('');
    setLinks((previous) => (previous ? [link, ...previous] : [link]));
  };

  return (
    <section aria-labelledby="links-heading">
      <header className={styles.pageHead}>
        <h1 id="links-heading" className={styles.pageTitle}>
          Links
        </h1>
        <button type="button" className={ui.btnPrimary} onClick={() => setIsModalOpen(true)}>
          <Plus size={15} weight="bold" />
          Create link
        </button>
      </header>

      {upgradeMessage ? <UpgradeNotice message={upgradeMessage} workspaceId={workspace?.id} /> : null}

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      {error ? (
        <div className={ui.card}>
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : links === null ? (
        <SkeletonRows rows={5} height={46} />
      ) : links.length === 0 ? (
        <div className={ui.card}>
          <EmptyState icon={<LinkSimple size={26} weight="duotone" />} title="No tracked links yet">
            <p>Create your first link and put it into an ad or a post. Every click and join gets attributed to it.</p>
          </EmptyState>
        </div>
      ) : (
        <div className={table.scroll}>
          <div className={table.table} style={TABLE_STYLE}>
            <div className={table.headRow}>
              <span>label</span>
              <span>url</span>
              <span className={table.alignRight}>clicks</span>
              <span className={table.alignRight}>joins</span>
              <span className={table.alignRight}>leaves</span>
              <span className={table.alignRight} title="Pixel pageviews → outbound clicks">
                landing
              </span>
              <span className={table.alignRight}>created</span>
              <span className={table.alignRight}>actions</span>
            </div>
            {links.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                isConfirming={confirmingId === link.id}
                isRevoking={revokingId === link.id}
                onRevokeClick={(id) => void handleRevokeClick(id)}
                onInstallPixel={setPixelLink}
              />
            ))}
          </div>
        </div>
      )}

      <CreateLinkModal
        channelId={channelId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
        onUpgradeRequired={setUpgradeMessage}
      />
      <InstallPixelModal link={pixelLink} onClose={() => setPixelLink(null)} />
    </section>
  );
}
