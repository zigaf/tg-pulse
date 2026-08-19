'use client';

import { CheckCircle, Clock, PlugsConnected, WarningCircle } from '@phosphor-icons/react';
import type { ApiIntegration } from '@/lib/api';
import type { AdProviderDescriptor } from '@/lib/ad-providers';
import styles from './integrations.module.css';
import ui from '../shared/ui.module.css';

export type ConnectionStatus = 'comingSoon' | 'disconnected' | 'connected' | 'disabled' | 'error';

export type TestState = { pending: true } | { pending: false; ok: boolean; detail: string };

/** One card per platform, so the section reads the same whether a platform is live or queued. */
export function connectionStatus(
  descriptor: AdProviderDescriptor,
  integration: ApiIntegration | null,
): ConnectionStatus {
  if (descriptor.comingSoon) return 'comingSoon';
  if (!integration) return 'disconnected';
  if (integration.needsReconnect || integration.lastError) return 'error';
  if (!integration.isActive) return 'disabled';
  return 'connected';
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  comingSoon: 'Coming soon',
  disconnected: 'Not connected',
  connected: 'Connected',
  disabled: 'Disabled',
  error: 'Error',
};

function StatusPill({ status }: { status: ConnectionStatus }) {
  const label = STATUS_LABELS[status];
  if (status === 'connected') {
    return (
      <span className={ui.badgePositive}>
        <CheckCircle size={11} weight="fill" aria-hidden="true" />
        {label}
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className={ui.badgeNegative}>
        <WarningCircle size={11} weight="fill" aria-hidden="true" />
        {label}
      </span>
    );
  }
  if (status === 'comingSoon') {
    return (
      <span className={ui.badge}>
        <Clock size={11} weight="fill" aria-hidden="true" />
        {label}
      </span>
    );
  }
  if (status === 'disabled') return <span className={ui.badgeWarning}>{label}</span>;
  return <span className={ui.badge}>{label}</span>;
}

interface ProviderCardProps {
  descriptor: AdProviderDescriptor;
  integration: ApiIntegration | null;
  canMutate: boolean;
  isBusy: boolean;
  isConfirmingDelete: boolean;
  testState: TestState | undefined;
  onConnect: () => void;
  onToggle: () => void;
  onTest: () => void;
  onDelete: () => void;
}

export function ProviderCard({
  descriptor,
  integration,
  canMutate,
  isBusy,
  isConfirmingDelete,
  testState,
  onConnect,
  onToggle,
  onTest,
  onDelete,
}: ProviderCardProps) {
  const status = connectionStatus(descriptor, integration);
  const isComingSoon = status === 'comingSoon';
  const settings = descriptor.configFields
    .map((field) => ({ label: field.label, value: integration?.config?.[field.name] ?? '' }))
    .filter((row) => row.value.length > 0);

  return (
    <article className={`${styles.card} ${isComingSoon ? styles.cardMuted : ''}`}>
      <header className={styles.cardHead}>
        <span className={styles.cardIcon} aria-hidden="true">
          <PlugsConnected size={18} weight="duotone" />
        </span>
        <div className={styles.cardHeadText}>
          <h3 className={styles.cardTitle}>{descriptor.name}</h3>
          <p className={styles.cardProduct}>{descriptor.product}</p>
        </div>
        <StatusPill status={status} />
      </header>

      <p className={styles.cardSummary}>{descriptor.summary}</p>

      <p className={styles.clickId}>
        matches on <code>{descriptor.clickId}</code>
      </p>

      {integration ? (
        <dl className={styles.settings}>
          {integration.credentialHint ? (
            <div className={styles.settingRow}>
              <dt>Token</dt>
              <dd className={styles.settingMono}>{integration.credentialHint}</dd>
            </div>
          ) : null}
          {settings.map((row) => (
            <div key={row.label} className={styles.settingRow}>
              <dt>{row.label}</dt>
              <dd className={styles.settingMono}>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {integration?.needsReconnect ? (
        <p className={styles.cardError}>
          The stored credentials can no longer be read. Reconnect this platform to restore delivery.
        </p>
      ) : null}

      {testState ? (
        <p
          className={
            testState.pending
              ? styles.testPending
              : testState.ok
                ? styles.testOk
                : styles.testFail
          }
          role="status"
        >
          {testState.pending ? 'Calling the platform…' : testState.detail}
        </p>
      ) : null}

      <footer className={styles.cardFoot}>
        {isComingSoon ? (
          <button type="button" className={ui.btnGhost} disabled>
            Connect
          </button>
        ) : !canMutate ? (
          integration ? null : <span className={styles.readOnlyHint}>Read-only access</span>
        ) : integration ? (
          <>
            <button type="button" className={ui.btnGhost} onClick={onTest} disabled={isBusy || testState?.pending}>
              Test
            </button>
            <button type="button" className={ui.btnGhost} onClick={onConnect} disabled={isBusy}>
              Edit
            </button>
            <button type="button" className={ui.btnGhost} onClick={onToggle} disabled={isBusy}>
              {integration.isActive ? 'Disable' : 'Enable'}
            </button>
            <button
              type="button"
              className={`${ui.btnDanger} ${isConfirmingDelete ? styles.deleteConfirm : ''}`}
              onClick={onDelete}
              disabled={isBusy}
            >
              {isConfirmingDelete ? 'Confirm?' : 'Delete'}
            </button>
          </>
        ) : (
          <button type="button" className={ui.btnPrimary} onClick={onConnect} disabled={isBusy}>
            Connect
          </button>
        )}
      </footer>
    </article>
  );
}
