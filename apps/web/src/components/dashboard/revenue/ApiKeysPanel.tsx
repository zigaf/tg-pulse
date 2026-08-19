'use client';

import { Key, Plus } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createApiKey, getApiKeys, revokeApiKey, type ApiApiKey } from '@/lib/api';
import { formatFullDate } from '@/lib/format';
import { EmptyState, ErrorState, SkeletonRows } from '../shared/States';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import { NewKeyModal } from './NewKeyModal';
import styles from './revenue.module.css';

const TABLE_STYLE = { '--cols': '1.3fr 0.9fr 0.55fr 0.7fr', '--min-width': '540px' } as CSSProperties;
const CONFIRM_RESET_MS = 3000;

function KeyRow({
  apiKey,
  isConfirming,
  isRevoking,
  onRevokeClick,
}: {
  apiKey: ApiApiKey;
  isConfirming: boolean;
  isRevoking: boolean;
  onRevokeClick: (id: string) => void;
}) {
  const isRevoked = apiKey.revokedAt !== null;
  return (
    <div className={`${table.row} ${table.rowHover} ${isRevoked ? styles.rowRevoked : ''}`}>
      <span className={styles.keyCell}>
        <span className={styles.keyPrefix}>{apiKey.prefix}</span>
        <span className={styles.keyMask} aria-hidden="true">
          ........................
        </span>
      </span>
      <span className={table.num}>{formatFullDate(apiKey.createdAt)}</span>
      <span className={styles.statusCell}>
        {isRevoked ? <span className={ui.badgeNegative}>revoked</span> : <span className={ui.badgePositive}>active</span>}
      </span>
      <span className={styles.actionsCell}>
        {isRevoked ? null : (
          <button
            type="button"
            className={`${styles.revokeBtn} ${isConfirming ? styles.revokeConfirm : ''}`}
            onClick={() => onRevokeClick(apiKey.id)}
            disabled={isRevoking}
          >
            {isRevoking ? 'Revoking' : isConfirming ? 'Confirm?' : 'Revoke'}
          </button>
        )}
      </span>
    </div>
  );
}

/** Ingest keys: list, create (raw value shown once), revoke with inline confirm. */
export function ApiKeysPanel({ channelId }: { channelId: string }) {
  const [keys, setKeys] = useState<ApiApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setKeys(null);
    const result = await getApiKeys(channelId);
    if (result.ok) setKeys(result.data);
    else setError(result.error);
  }, [channelId]);

  useEffect(() => {
    void load();
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [load]);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setActionError('');
    const result = await createApiKey(channelId);
    setIsCreating(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    const { key, ...created } = result.data;
    setKeys((previous) => (previous ? [created, ...previous] : [created]));
    setRawKey(key);
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
    setRevokingId(id);
    setActionError('');
    const result = await revokeApiKey(id);
    setRevokingId(null);
    if (result.ok) {
      setKeys((previous) => (previous ? previous.map((item) => (item.id === id ? result.data : item)) : previous));
    } else {
      setActionError(result.error);
    }
  };

  return (
    <section className={`${ui.card} ${styles.panel}`} aria-labelledby="api-keys-title">
      <header className={styles.panelHead}>
        <span className={styles.panelHeading}>
          <span className={styles.panelIcon} aria-hidden="true">
            <Key size={16} weight="duotone" />
          </span>
          <h2 id="api-keys-title" className={styles.panelTitle}>
            API keys
          </h2>
        </span>
        <button type="button" className={ui.btn} onClick={() => void handleCreate()} disabled={isCreating}>
          <Plus size={14} weight="bold" />
          {isCreating ? 'Creating' : 'Create key'}
        </button>
      </header>

      <p className={styles.panelHint}>
        Each key authorizes the sales webhook for this channel only. The full value is shown once at creation;
        revoke a key the moment it leaks.
      </p>

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : keys === null ? (
        <SkeletonRows rows={2} height={44} />
      ) : keys.length === 0 ? (
        <EmptyState icon={<Key size={26} weight="duotone" />} title="No keys yet">
          <p>Create a key to start sending purchase events from your payment provider or bot.</p>
        </EmptyState>
      ) : (
        <div className={table.scroll}>
          <div className={table.table} style={TABLE_STYLE}>
            <div className={table.headRow}>
              <span>key</span>
              <span className={table.alignRight}>created</span>
              <span>status</span>
              <span className={table.alignRight}>actions</span>
            </div>
            {keys.map((apiKey) => (
              <KeyRow
                key={apiKey.id}
                apiKey={apiKey}
                isConfirming={confirmingId === apiKey.id}
                isRevoking={revokingId === apiKey.id}
                onRevokeClick={(id) => void handleRevokeClick(id)}
              />
            ))}
          </div>
        </div>
      )}

      <NewKeyModal rawKey={rawKey} onClose={() => setRawKey(null)} />
    </section>
  );
}
