'use client';

import { useState, type CSSProperties } from 'react';
import { inviteUrl, type WorkspaceInvite, type WorkspaceRole } from '@/lib/api';
import { formatFullDate } from '@/lib/format';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import styles from './team.module.css';

const TABLE_STYLE = { '--cols': '0.7fr 1.2fr 1fr', '--min-width': '480px' } as CSSProperties;
const COPIED_RESET_MS = 2000;

const ROLE_LABELS: Record<WorkspaceRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', VIEWER: 'Viewer' };

function isExpired(invite: WorkspaceInvite): boolean {
  const expiry = new Date(invite.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry < Date.now();
}

interface InvitesTableProps {
  invites: WorkspaceInvite[];
  isManager: boolean;
  pendingInviteId: string | null;
  confirmingInviteId: string | null;
  onRevokeClick: (id: string) => void;
}

/** Pending invites: role, expiry, copy of the one-time link, revoke. */
export function InvitesTable({
  invites,
  isManager,
  pendingInviteId,
  confirmingInviteId,
  onRevokeClick,
}: InvitesTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (invite: WorkspaceInvite) => {
    const url = inviteUrl(invite);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((current) => (current === invite.id ? null : current)), COPIED_RESET_MS);
    } catch {
      // Clipboard unavailable (permissions / insecure context): leave the button as is.
    }
  };

  return (
    <div className={table.scroll}>
      <div className={table.table} style={TABLE_STYLE}>
        <div className={table.headRow}>
          <span>role</span>
          <span className={table.alignRight}>expires</span>
          <span className={table.alignRight}>actions</span>
        </div>

        {invites.map((invite) => {
          const expired = isExpired(invite);
          const url = inviteUrl(invite);
          const isPending = pendingInviteId === invite.id;
          const isConfirming = confirmingInviteId === invite.id;

          return (
            <div key={invite.id} className={`${table.row} ${table.rowHover}`}>
              <span className={styles.roleCell}>
                <span className={styles.roleStatic}>{ROLE_LABELS[invite.role]}</span>
              </span>

              <span className={`${styles.expiry} ${expired ? styles.expired : ''}`}>
                {expired ? 'expired' : formatFullDate(invite.expiresAt)}
              </span>

              <span className={styles.actionsCell}>
                {url ? (
                  <button type="button" className={styles.rowBtn} onClick={() => void handleCopy(invite)}>
                    {copiedId === invite.id ? 'Copied' : 'Copy link'}
                  </button>
                ) : (
                  <span className={ui.badge} title="The one-time link is shown only when it is created">
                    link hidden
                  </span>
                )}
                {isManager ? (
                  <button
                    type="button"
                    className={`${styles.dangerBtn} ${isConfirming ? styles.dangerConfirm : ''}`}
                    onClick={() => onRevokeClick(invite.id)}
                    disabled={isPending}
                  >
                    {isPending ? 'Revoking' : isConfirming ? 'Confirm?' : 'Revoke'}
                  </button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
