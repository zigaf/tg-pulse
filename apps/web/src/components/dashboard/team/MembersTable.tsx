'use client';

import type { CSSProperties } from 'react';
import type { WorkspaceMember, WorkspaceRole } from '@/lib/api';
import { formatFullDate } from '@/lib/format';
import table from '../shared/table.module.css';
import styles from './team.module.css';

const TABLE_STYLE = { '--cols': '1.7fr 0.8fr 0.8fr 0.7fr', '--min-width': '620px' } as CSSProperties;

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'VIEWER', label: 'Viewer' },
];

function roleLabel(role: WorkspaceRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? 'Viewer';
}

function displayName(member: WorkspaceMember): string {
  const full = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return full || member.username || member.userId;
}

interface MembersTableProps {
  members: WorkspaceMember[];
  selfUserId: string;
  /** OWNER and ADMIN see the controls; VIEWER reads the same data statically. */
  isManager: boolean;
  /** Only an OWNER may promote to, demote or remove another owner (server rule). */
  canManageOwners: boolean;
  pendingUserId: string | null;
  confirmingUserId: string | null;
  onRoleChange: (member: WorkspaceMember, role: WorkspaceRole) => void;
  onRemoveClick: (userId: string) => void;
}

/** Workspace members with role control and a two-step remove. */
export function MembersTable({
  members,
  selfUserId,
  isManager,
  canManageOwners,
  pendingUserId,
  confirmingUserId,
  onRoleChange,
  onRemoveClick,
}: MembersTableProps) {
  return (
    <div className={table.scroll}>
      <div className={table.table} style={TABLE_STYLE}>
        <div className={table.headRow}>
          <span>member</span>
          <span>role</span>
          <span className={table.alignRight}>joined</span>
          <span className={table.alignRight}>actions</span>
        </div>

        {members.map((member) => {
          const name = displayName(member);
          const isSelf = member.userId === selfUserId;
          const isPending = pendingUserId === member.userId;
          const isConfirming = confirmingUserId === member.userId;
          const isOwnerSeat = member.role === 'OWNER';
          const canEditSeat = isManager && (canManageOwners || !isOwnerSeat);

          return (
            <div key={member.userId} className={`${table.row} ${table.rowHover}`}>
              <span className={styles.memberCell}>
                <span className={styles.avatar} aria-hidden="true">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.memberText}>
                  <span className={table.cellTitle}>
                    {name}
                    {isSelf ? <span className={styles.selfTag}>you</span> : null}
                  </span>
                  {member.username ? <span className={table.cellSub}>@{member.username}</span> : null}
                </span>
              </span>

              <span className={styles.roleCell}>
                {canEditSeat ? (
                  <select
                    className={styles.roleSelect}
                    value={member.role}
                    disabled={isPending}
                    aria-label={`Role of ${name}`}
                    onChange={(event) => onRoleChange(member, event.target.value as WorkspaceRole)}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={option.value === 'OWNER' && !canManageOwners}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`${styles.roleStatic} ${isOwnerSeat ? styles.roleOwner : ''}`}>
                    {roleLabel(member.role)}
                  </span>
                )}
              </span>

              <span className={table.num}>{formatFullDate(member.joinedAt)}</span>

              <span className={styles.actionsCell}>
                {canEditSeat && !isSelf ? (
                  <button
                    type="button"
                    className={`${styles.dangerBtn} ${isConfirming ? styles.dangerConfirm : ''}`}
                    onClick={() => onRemoveClick(member.userId)}
                    disabled={isPending}
                  >
                    {isPending ? 'Removing' : isConfirming ? 'Confirm?' : 'Remove'}
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
