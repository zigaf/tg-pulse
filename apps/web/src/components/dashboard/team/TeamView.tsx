'use client';

import { ArrowLeft, EnvelopeSimple, Plus, Pulse, UsersFour } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canManage,
  getMe,
  getMembers,
  removeMember,
  revokeInvite,
  updateMemberRole,
  type ApiWorkspace,
  type MembersData,
  type WorkspaceInvite,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@/lib/api';
import { toQuota } from '@/lib/billing';
import { QuotaMeter } from '../billing/QuotaBars';
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '../shared/States';
import ui from '../shared/ui.module.css';
import { UpgradeCard, UpgradeNotice } from '../shared/UpgradeCard';
import { InviteModal } from './InviteModal';
import { InvitesTable } from './InvitesTable';
import { MembersTable } from './MembersTable';
import styles from './team.module.css';

type Phase = 'loading' | 'ready' | 'error';

const CONFIRM_RESET_MS = 3000;
const CONFLICT = 409;

const UPGRADE_TITLE = 'Your plan is out of member seats';
const UPGRADE_BODY =
  'Pro fits five people per workspace, Agency fits twenty five. Existing members keep working while you decide.';

function isPendingInvite(invite: WorkspaceInvite): boolean {
  const expiry = new Date(invite.expiresAt).getTime();
  return !Number.isFinite(expiry) || expiry >= Date.now();
}

function TeamSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading team">
      <span className={ui.skeleton} style={{ height: 132, borderRadius: 'var(--radius-lg)' }} />
      <div className={styles.sectionHead}>
        <Skeleton width={90} height={18} />
      </div>
      <SkeletonRows rows={3} height={46} />
    </div>
  );
}

/** Team of one workspace: members and roles, pending invites, member quota. */
export function TeamView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceParam = searchParams.get('ws');

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [selfUserId, setSelfUserId] = useState('');
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [data, setData] = useState<MembersData | null>(null);

  const [actionError, setActionError] = useState('');
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [confirmingUserId, setConfirmingUserId] = useState<string | null>(null);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [confirmingInviteId, setConfirmingInviteId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    setActionError('');

    const meResult = await getMe();
    if (!meResult.ok) {
      if (meResult.status === 401) {
        router.replace('/app');
        return;
      }
      setError(meResult.error);
      setPhase('error');
      return;
    }

    const workspaces = meResult.data.workspaces;
    const selected = workspaces.find((item) => item.id === workspaceParam) ?? workspaces[0];
    if (!selected) {
      setError('This account has no workspace yet. Connect a channel first.');
      setPhase('error');
      return;
    }
    setSelfUserId(meResult.data.user.id);
    setWorkspace(selected);

    const membersResult = await getMembers(selected.id);
    if (!membersResult.ok) {
      setError(membersResult.error);
      setPhase('error');
      return;
    }
    setData(membersResult.data);
    setPhase('ready');
  }, [router, workspaceParam]);

  useEffect(() => {
    void load();
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [load]);

  const armConfirm = (reset: () => void) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(reset, CONFIRM_RESET_MS);
  };

  const failureMessage = (message: string, status?: number): string => {
    if (status !== CONFLICT) return message;
    return message || 'A workspace always needs one owner, so this one cannot be changed.';
  };

  const handleRoleChange = async (member: WorkspaceMember, role: WorkspaceRole) => {
    if (!workspace || role === member.role) return;
    setPendingUserId(member.userId);
    setActionError('');
    const result = await updateMemberRole(workspace.id, member.userId, role);
    setPendingUserId(null);

    if (!result.ok) {
      setActionError(failureMessage(result.error, result.status));
      return;
    }
    setData((previous) =>
      previous
        ? {
            ...previous,
            members: previous.members.map((item) =>
              item.userId === member.userId ? { ...item, role } : item,
            ),
          }
        : previous,
    );
  };

  const handleRemoveClick = async (userId: string) => {
    if (!workspace) return;
    if (confirmingUserId !== userId) {
      setConfirmingUserId(userId);
      armConfirm(() => setConfirmingUserId(null));
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingUserId(null);
    setPendingUserId(userId);
    setActionError('');

    const result = await removeMember(workspace.id, userId);
    setPendingUserId(null);
    if (!result.ok) {
      setActionError(failureMessage(result.error, result.status));
      return;
    }
    setData((previous) =>
      previous
        ? { ...previous, members: previous.members.filter((member) => member.userId !== userId) }
        : previous,
    );
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (confirmingInviteId !== inviteId) {
      setConfirmingInviteId(inviteId);
      armConfirm(() => setConfirmingInviteId(null));
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingInviteId(null);
    setPendingInviteId(inviteId);
    setActionError('');

    const result = await revokeInvite(inviteId);
    setPendingInviteId(null);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setData((previous) =>
      previous ? { ...previous, invites: previous.invites.filter((invite) => invite.id !== inviteId) } : previous,
    );
  };

  const handleInviteCreated = (invite: WorkspaceInvite) => {
    setUpgradeMessage('');
    setData((previous) => (previous ? { ...previous, invites: [invite, ...previous.invites] } : previous));
  };

  const handleUpgradeRequired = (message: string) => {
    setUpgradeMessage(message);
  };

  const pendingInvites = data ? data.invites.filter(isPendingInvite) : [];
  const seatsUsed = data ? data.members.length + pendingInvites.length : 0;
  const seatLimit = data?.limit !== undefined ? data.limit : workspace?.entitlements?.limits.members;
  const quota = toQuota(seatLimit);
  const isSeatQuotaFull = quota !== null && seatsUsed >= quota;

  const selfRole =
    workspace?.role ?? data?.role ?? data?.members.find((member) => member.userId === selfUserId)?.role ?? null;
  // Unknown role keeps the full UI: the API answers 403 and nothing is silently hidden.
  const isManager = selfRole === null || canManage(selfRole);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/app" className={styles.backLink}>
          <ArrowLeft size={14} />
          Channels
        </Link>
        <span className={styles.wordmark}>
          <Pulse size={17} weight="bold" />
          TGPulse
        </span>
      </header>

      <section aria-labelledby="team-heading">
        <div className={styles.headingRow}>
          <div className={styles.headingText}>
            <h1 id="team-heading" className={styles.heading}>
              Team
            </h1>
            <p className={styles.headingHint}>
              {workspace ? `${workspace.name} · members, roles and invites` : 'Members, roles and invites'}
            </p>
          </div>
          {phase === 'ready' && isManager && !isSeatQuotaFull ? (
            <button type="button" className={ui.btnPrimary} onClick={() => setIsModalOpen(true)}>
              <Plus size={15} weight="bold" />
              Invite member
            </button>
          ) : null}
        </div>

        {phase === 'error' ? (
          <div className={ui.card}>
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : phase === 'loading' || !data || !workspace ? (
          <TeamSkeleton />
        ) : (
          <>
            {upgradeMessage ? <UpgradeNotice message={upgradeMessage} workspaceId={workspace.id} /> : null}

            <div className={`${ui.card} ${styles.quotaPanel}`}>
              <ul className={styles.quotaPanelList}>
                <QuotaMeter
                  label="Team seats"
                  used={seatsUsed}
                  limit={seatLimit}
                  fullNote="Limit reached. Inviting another member needs a higher plan."
                />
              </ul>
            </div>

            {isSeatQuotaFull ? (
              <div className={styles.upgradeWrap}>
                <UpgradeCard title={UPGRADE_TITLE} description={UPGRADE_BODY} workspaceId={workspace.id} />
              </div>
            ) : null}

            {actionError ? (
              <p className={styles.actionError} role="alert">
                {actionError}
              </p>
            ) : null}

            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Members</h2>
              <p className={styles.sectionHint}>
                {isManager ? 'Owners handle billing, viewers only read' : 'Roles are managed by owners and admins'}
              </p>
            </div>

            {data.members.length === 0 ? (
              <div className={ui.card}>
                <EmptyState icon={<UsersFour size={26} weight="duotone" />} title="No members yet">
                  <p>Invite a teammate or a client and they will appear here after accepting.</p>
                </EmptyState>
              </div>
            ) : (
              <MembersTable
                members={data.members}
                selfUserId={selfUserId}
                isManager={isManager}
                canManageOwners={selfRole === null || selfRole === 'OWNER'}
                pendingUserId={pendingUserId}
                confirmingUserId={confirmingUserId}
                onRoleChange={(member, role) => void handleRoleChange(member, role)}
                onRemoveClick={(userId) => void handleRemoveClick(userId)}
              />
            )}

            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Pending invites</h2>
              <p className={styles.sectionHint}>One-time links, valid for 7 days</p>
            </div>

            {data.invites.length === 0 ? (
              <div className={ui.card}>
                <EmptyState icon={<EnvelopeSimple size={26} weight="duotone" />} title="No pending invites">
                  <p>
                    {isManager
                      ? 'Create an invite link and send it over any channel. It works once.'
                      : 'Owners and admins can invite new members.'}
                  </p>
                </EmptyState>
              </div>
            ) : (
              <InvitesTable
                invites={data.invites}
                isManager={isManager}
                pendingInviteId={pendingInviteId}
                confirmingInviteId={confirmingInviteId}
                onRevokeClick={(id) => void handleRevokeInvite(id)}
              />
            )}
          </>
        )}
      </section>

      {workspace ? (
        <InviteModal
          workspaceId={workspace.id}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreated={handleInviteCreated}
          onUpgradeRequired={handleUpgradeRequired}
        />
      ) : null}
    </main>
  );
}
