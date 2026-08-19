'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { getShareLinks, revokeShareLink, shareReportUrl, type ShareLink } from '@/lib/api';
import { formatFullDate, formatNumber } from '@/lib/format';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import styles from './share.module.css';

const TABLE_STYLE = { '--cols': '1.5fr 0.6fr 0.5fr 0.8fr 1fr', '--min-width': '640px' } as CSSProperties;
const CONFIRM_RESET_MS = 3000;
const COPIED_RESET_MS = 2000;

function isDead(link: ShareLink): boolean {
  if (link.revokedAt) return true;
  if (!link.expiresAt) return false;
  const expiry = new Date(link.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry < Date.now();
}

/**
 * Live report links for the channel. Stays invisible while there is nothing to show,
 * so the Overview page does not grow an empty section for a feature nobody used yet.
 */
export function ShareLinksPanel({
  channelId,
  refreshKey,
  canRevoke,
}: {
  channelId: string;
  /** Bumped by the parent after a link is created. */
  refreshKey: number;
  canRevoke: boolean;
}) {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const result = await getShareLinks(channelId);
    if (result.ok) {
      setLinks(result.data);
      setLoadError(null);
      return;
    }
    // A missing endpoint (no envelope) keeps the section hidden instead of shouting at the user.
    setLinks([]);
    setLoadError(result.envelope ? result.error : null);
  }, [channelId]);

  useEffect(() => {
    void load();
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [load, refreshKey]);

  const handleCopy = async (link: ShareLink) => {
    const url = shareReportUrl(link);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((current) => (current === link.id ? null : current)), COPIED_RESET_MS);
    } catch {
      // Clipboard unavailable (permissions / insecure context): leave the button as is.
    }
  };

  const handleRevokeClick = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingId(null), CONFIRM_RESET_MS);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(null);
    setPendingId(id);
    setActionError('');

    const result = await revokeShareLink(id);
    setPendingId(null);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setLinks((previous) =>
      previous
        ? previous.map((link) =>
            link.id === id ? { ...link, revokedAt: result.data?.revokedAt ?? new Date().toISOString() } : link,
          )
        : previous,
    );
  };

  if (links === null) return null;
  if (links.length === 0 && !loadError) return null;

  return (
    <section aria-labelledby="shared-reports-heading">
      <div className={styles.sectionHead}>
        <h2 id="shared-reports-heading" className={styles.sectionTitle}>
          Shared reports
        </h2>
        <p className={styles.sectionHint}>Read-only links for clients, no account needed</p>
      </div>

      {loadError ? (
        <p className={styles.actionError} role="alert">
          {loadError}
        </p>
      ) : null}

      {links.length > 0 ? (
        <div className={table.scroll}>
          <div className={table.table} style={TABLE_STYLE}>
            <div className={table.headRow}>
              <span>report</span>
              <span className={table.alignRight}>window</span>
              <span className={table.alignRight}>views</span>
              <span className={table.alignRight}>created</span>
              <span className={table.alignRight}>actions</span>
            </div>

            {links.map((link) => {
              const dead = isDead(link);
              return (
                <div key={link.id} className={`${table.row} ${table.rowHover} ${dead ? styles.rowDead : ''}`}>
                  <span className={styles.labelCell}>
                    <span className={table.cellTitle}>{link.label || 'Client report'}</span>
                    <span className={table.cellSub}>
                      {link.expiresAt ? `expires ${formatFullDate(link.expiresAt)}` : 'no expiry'}
                    </span>
                  </span>
                  <span className={`${table.num} ${styles.window}`}>{link.windowDays}d</span>
                  <span className={table.numStrong}>{formatNumber(link.viewCount)}</span>
                  <span className={table.num}>{formatFullDate(link.createdAt)}</span>
                  <span className={styles.actionsCell}>
                    {link.revokedAt ? (
                      <span className={ui.badgeNegative}>revoked</span>
                    ) : (
                      <>
                        <button type="button" className={styles.rowBtn} onClick={() => void handleCopy(link)}>
                          {copiedId === link.id ? 'Copied' : 'Copy link'}
                        </button>
                        {canRevoke ? (
                          <button
                            type="button"
                            className={`${styles.dangerBtn} ${confirmingId === link.id ? styles.dangerConfirm : ''}`}
                            onClick={() => void handleRevokeClick(link.id)}
                            disabled={pendingId === link.id}
                          >
                            {pendingId === link.id ? 'Revoking' : confirmingId === link.id ? 'Confirm?' : 'Revoke'}
                          </button>
                        ) : null}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
