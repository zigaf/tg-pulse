'use client';

import { PaperPlaneTilt, Plus } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  deletePostback,
  getPostbacks,
  isUpgradeRequired,
  testPostback,
  updatePostback,
  type ApiPostback,
} from '@/lib/api';
import { EmptyState, ErrorState, SkeletonRows } from '../shared/States';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import { UpgradeCard } from '../shared/UpgradeCard';
import { useFeatureLocked, useIsViewer, useWorkspace } from '../shell/workspace-context';
import { AddPostbackModal } from './AddPostbackModal';
import styles from './postbacks.module.css';

const TABLE_STYLE = { '--cols': '1fr 1.6fr 0.7fr 0.45fr 0.95fr 1.3fr', '--min-width': '960px' } as CSSProperties;
const CONFIRM_RESET_MS = 3000;

const UPGRADE_TITLE = 'Postbacks are part of Pro';
const UPGRADE_BODY =
  'Send every join and leave straight into your ad platform or tracker, so conversions land in the right campaign instead of a spreadsheet.';

type TestResult = { pending: true } | { pending: false; status?: number; error?: string };

function formatMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Outcome of the last real delivery the bot fired, persisted on the postback.
 * Distinct from the Test button, which shows the result of an on-demand probe.
 */
function LastDelivery({ postback }: { postback: ApiPostback }) {
  if (!postback.lastFiredAt) {
    return <span className={styles.deliveryNever}>never fired</span>;
  }

  const isOk =
    postback.lastStatus !== null && postback.lastStatus >= 200 && postback.lastStatus < 400;
  const label =
    postback.lastStatus !== null ? `HTTP ${postback.lastStatus}` : (postback.lastError ?? 'failed');

  return (
    <span className={styles.deliveryCell} title={postback.lastError ?? undefined}>
      <span className={`${styles.testResult} ${isOk ? styles.testOk : styles.testFail}`}>{label}</span>
      <span className={styles.deliveryMoment}>{formatMoment(postback.lastFiredAt)}</span>
    </span>
  );
}

function TestResultLabel({ result }: { result: TestResult }) {
  if (result.pending) return <span className={styles.testResult}>…</span>;
  if (result.status !== undefined) {
    const isOk = result.status >= 200 && result.status < 400;
    return (
      <span className={`${styles.testResult} ${isOk ? styles.testOk : styles.testFail}`}>HTTP {result.status}</span>
    );
  }
  return (
    <span className={`${styles.testResult} ${styles.testFail}`} title={result.error}>
      failed
    </span>
  );
}

function PostbackRow({
  postback,
  canMutate,
  isToggling,
  isConfirming,
  isDeleting,
  testResult,
  onToggle,
  onTest,
  onDeleteClick,
}: {
  postback: ApiPostback;
  canMutate: boolean;
  isToggling: boolean;
  isConfirming: boolean;
  isDeleting: boolean;
  testResult: TestResult | undefined;
  onToggle: (postback: ApiPostback) => void;
  onTest: (id: string) => void;
  onDeleteClick: (id: string) => void;
}) {
  return (
    <div className={`${table.row} ${table.rowHover} ${postback.isActive ? '' : styles.rowInactive}`}>
      <span className={styles.nameCell}>
        <span className={table.cellTitle}>{postback.name}</span>
      </span>
      <span className={styles.templateCell} title={postback.urlTemplate}>
        {postback.urlTemplate}
      </span>
      <span className={styles.eventsCell}>
        {postback.onJoin ? <span className={ui.badgePositive}>join</span> : null}
        {postback.onLeave ? <span className={ui.badgeWarning}>leave</span> : null}
      </span>
      <span>
        <button
          type="button"
          role="switch"
          aria-checked={postback.isActive}
          aria-label={postback.isActive ? 'Deactivate postback' : 'Activate postback'}
          className={`${styles.toggle} ${postback.isActive ? styles.toggleOn : ''}`}
          onClick={() => onToggle(postback)}
          disabled={isToggling || !canMutate}
        />
      </span>
      <LastDelivery postback={postback} />
      <span className={styles.actionsCell}>
        {testResult ? <TestResultLabel result={testResult} /> : null}
        {canMutate ? (
          <>
            <button
              type="button"
              className={styles.testBtn}
              onClick={() => onTest(postback.id)}
              disabled={testResult?.pending === true}
            >
              Test
            </button>
            <button
              type="button"
              className={`${styles.deleteBtn} ${isConfirming ? styles.deleteConfirm : ''}`}
              onClick={() => onDeleteClick(postback.id)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting' : isConfirming ? 'Confirm?' : 'Delete'}
            </button>
          </>
        ) : null}
      </span>
    </div>
  );
}

/** Postbacks: list, add, toggle active, fire test request, delete with inline confirm. */
export function PostbacksView({ channelId }: { channelId: string }) {
  const [postbacks, setPostbacks] = useState<ApiPostback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLockedByApi, setIsLockedByApi] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [actionError, setActionError] = useState('');
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Listing stays open on FREE so a downgraded workspace still sees what it had, so the
   * lock comes from the plan; a 402 on any postback call locks the section as well.
   */
  const isLockedByPlan = useFeatureLocked('postbacks');
  const workspace = useWorkspace();
  const isViewer = useIsViewer();
  const isLocked = isLockedByPlan || isLockedByApi;
  const canMutate = !isLocked && !isViewer;

  const load = useCallback(async () => {
    setError(null);
    setIsLockedByApi(false);
    setPostbacks(null);
    const result = await getPostbacks(channelId);
    if (result.ok) {
      setPostbacks(result.data);
      return;
    }
    if (isUpgradeRequired(result)) {
      setIsLockedByApi(true);
      return;
    }
    setError(result.error);
  }, [channelId]);

  useEffect(() => {
    void load();
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [load]);

  const handleToggle = async (postback: ApiPostback) => {
    setTogglingId(postback.id);
    setActionError('');
    const result = await updatePostback(postback.id, { isActive: !postback.isActive });
    setTogglingId(null);
    if (result.ok) {
      setPostbacks((previous) =>
        previous ? previous.map((item) => (item.id === postback.id ? result.data : item)) : previous,
      );
      return;
    }
    if (isUpgradeRequired(result)) setIsLockedByApi(true);
    setActionError(result.error);
  };

  const handleTest = async (id: string) => {
    setTestResults((previous) => ({ ...previous, [id]: { pending: true } }));
    const result = await testPostback(id);
    if (!result.ok && isUpgradeRequired(result)) setIsLockedByApi(true);
    setTestResults((previous) => ({
      ...previous,
      [id]: result.ok ? { pending: false, status: result.data.status } : { pending: false, error: result.error },
    }));
  };

  const handleDeleteClick = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingId(null), CONFIRM_RESET_MS);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(null);
    setDeletingId(id);
    setActionError('');
    const result = await deletePostback(id);
    setDeletingId(null);
    if (result.ok) {
      setPostbacks((previous) => (previous ? previous.filter((item) => item.id !== id) : previous));
      return;
    }
    if (isUpgradeRequired(result)) setIsLockedByApi(true);
    setActionError(result.error);
  };

  const handleCreated = (postback: ApiPostback) => {
    setPostbacks((previous) => (previous ? [postback, ...previous] : [postback]));
  };

  const hasPostbacks = postbacks !== null && postbacks.length > 0;

  return (
    <section aria-labelledby="postbacks-heading">
      <header className={styles.pageHead}>
        <h1 id="postbacks-heading" className={styles.pageTitle}>
          Postbacks
        </h1>
        {canMutate ? (
          <button type="button" className={ui.btnPrimary} onClick={() => setIsModalOpen(true)}>
            <Plus size={15} weight="bold" />
            Add postback
          </button>
        ) : null}
      </header>

      {isLocked ? (
        <UpgradeCard title={UPGRADE_TITLE} description={UPGRADE_BODY} workspaceId={workspace?.id} />
      ) : null}

      {actionError && !isLocked ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      {error ? (
        <div className={ui.card}>
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : postbacks === null ? (
        isLocked ? null : <SkeletonRows rows={4} height={46} />
      ) : !hasPostbacks ? (
        isLocked ? null : (
          <div className={ui.card}>
            <EmptyState icon={<PaperPlaneTilt size={26} weight="duotone" />} title="No postbacks yet">
              <p>
                A postback sends the subscription event to your ad platform or tracker by requesting a URL template
                you define. Macros like {'{yclid}'} or {'{cid}'} are replaced with real values, so conversions land
                in the right campaign.
              </p>
              {canMutate ? (
                <button type="button" className={ui.btn} onClick={() => setIsModalOpen(true)}>
                  <Plus size={14} weight="bold" />
                  Add postback
                </button>
              ) : null}
            </EmptyState>
          </div>
        )
      ) : (
        <div className={table.scroll}>
          <div className={table.table} style={TABLE_STYLE}>
            <div className={table.headRow}>
              <span>name</span>
              <span>template</span>
              <span>events</span>
              <span>active</span>
              <span>last delivery</span>
              <span className={table.alignRight}>actions</span>
            </div>
            {postbacks.map((postback) => (
              <PostbackRow
                key={postback.id}
                postback={postback}
                canMutate={canMutate}
                isToggling={togglingId === postback.id}
                isConfirming={confirmingId === postback.id}
                isDeleting={deletingId === postback.id}
                testResult={testResults[postback.id]}
                onToggle={(item) => void handleToggle(item)}
                onTest={(id) => void handleTest(id)}
                onDeleteClick={(id) => void handleDeleteClick(id)}
              />
            ))}
          </div>
        </div>
      )}

      <AddPostbackModal
        channelId={channelId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </section>
  );
}
