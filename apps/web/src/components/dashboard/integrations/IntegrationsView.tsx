'use client';

import { Info } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AD_PROVIDER_LIST, type AdProvider, type AdProviderDescriptor } from '@/lib/ad-providers';
import {
  deleteIntegration,
  getIntegrations,
  getIntegrationsHealth,
  isUpgradeRequired,
  testIntegration,
  updateIntegration,
  type ApiIntegration,
  type IntegrationsHealth,
} from '@/lib/api';
import { ErrorState, SkeletonRows } from '../shared/States';
import ui from '../shared/ui.module.css';
import { UpgradeCard } from '../shared/UpgradeCard';
import { useFeatureLocked, useIsViewer, useWorkspace } from '../shell/workspace-context';
import { ConnectModal } from './ConnectModal';
import { HealthTable } from './HealthTable';
import { ProviderCard, type TestState } from './ProviderCard';
import styles from './integrations.module.css';

const CONFIRM_RESET_MS = 3000;

const UPGRADE_TITLE = 'Ad platform integrations are part of Pro';
const UPGRADE_BODY =
  'Push every attributed join back into Meta or Yandex so the algorithm optimizes toward subscribers instead of clicks.';

/** Telegram Ads has no conversion API, so this stays true no matter what we build. */
const TELEGRAM_ADS_NOTE =
  'Telegram Ads has no conversion API, so campaigns there are optimized manually from our own reports.';

/**
 * Ad platforms section: one card per platform, a connect form per provider and a
 * delivery health block. Credentials are write-only, so nothing secret is ever rendered back.
 */
export function IntegrationsView({ channelId }: { channelId: string }) {
  const [integrations, setIntegrations] = useState<ApiIntegration[] | null>(null);
  const [health, setHealth] = useState<IntegrationsHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLockedByApi, setIsLockedByApi] = useState(false);
  const [editing, setEditing] = useState<AdProviderDescriptor | null>(null);
  const [busyProvider, setBusyProvider] = useState<AdProvider | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [actionError, setActionError] = useState('');
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLockedByPlan = useFeatureLocked('postbacks');
  const workspace = useWorkspace();
  const isViewer = useIsViewer();
  const isLocked = isLockedByPlan || isLockedByApi;
  const canMutate = !isLocked && !isViewer;

  const load = useCallback(async () => {
    setError(null);
    setIsLockedByApi(false);
    setIntegrations(null);

    const [list, healthResult] = await Promise.all([
      getIntegrations(channelId),
      getIntegrationsHealth(channelId),
    ]);

    if (healthResult.ok) setHealth(healthResult.data);

    if (list.ok) {
      setIntegrations(list.data);
      return;
    }
    if (isUpgradeRequired(list)) {
      setIsLockedByApi(true);
      return;
    }
    setError(list.error);
  }, [channelId]);

  useEffect(() => {
    void load();
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [load]);

  const refreshHealth = async () => {
    const result = await getIntegrationsHealth(channelId);
    if (result.ok) setHealth(result.data);
  };

  const byProvider = (provider: AdProvider): ApiIntegration | null =>
    integrations?.find((item) => item.provider === provider) ?? null;

  const handleSaved = (saved: ApiIntegration) => {
    setIntegrations((previous) => {
      if (!previous) return [saved];
      const exists = previous.some((item) => item.id === saved.id);
      return exists ? previous.map((item) => (item.id === saved.id ? saved : item)) : [...previous, saved];
    });
    setTestStates((previous) => {
      const { [saved.id]: _removed, ...rest } = previous;
      return rest;
    });
    void refreshHealth();
  };

  const handleToggle = async (integration: ApiIntegration) => {
    setBusyProvider(integration.provider);
    setActionError('');
    const result = await updateIntegration(integration.id, { isActive: !integration.isActive });
    setBusyProvider(null);
    if (result.ok) {
      handleSaved(result.data);
      return;
    }
    if (isUpgradeRequired(result)) setIsLockedByApi(true);
    setActionError(result.error);
  };

  const handleTest = async (integration: ApiIntegration) => {
    setTestStates((previous) => ({ ...previous, [integration.id]: { pending: true } }));
    const result = await testIntegration(integration.id);
    if (!result.ok && isUpgradeRequired(result)) setIsLockedByApi(true);
    setTestStates((previous) => ({
      ...previous,
      [integration.id]: result.ok
        ? { pending: false, ok: result.data.ok, detail: result.data.detail }
        : { pending: false, ok: false, detail: result.error },
    }));
    void refreshHealth();
  };

  const handleDelete = async (integration: ApiIntegration) => {
    if (confirmingId !== integration.id) {
      setConfirmingId(integration.id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingId(null), CONFIRM_RESET_MS);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(null);
    setBusyProvider(integration.provider);
    setActionError('');
    const result = await deleteIntegration(integration.id);
    setBusyProvider(null);
    if (result.ok) {
      setIntegrations((previous) => (previous ? previous.filter((item) => item.id !== integration.id) : previous));
      void refreshHealth();
      return;
    }
    if (isUpgradeRequired(result)) setIsLockedByApi(true);
    setActionError(result.error);
  };

  return (
    <section aria-labelledby="integrations-heading">
      <header className={styles.pageHead}>
        <div>
          <h1 id="integrations-heading" className={styles.pageTitle}>
            Ad platforms
          </h1>
          <p className={styles.pageSubtitle}>
            Send attributed joins back to the platform that paid for them, so it can optimize on subscribers.
          </p>
        </div>
      </header>

      <p className={styles.note}>
        <Info size={15} weight="duotone" className={styles.noteIcon} aria-hidden="true" />
        <span>{TELEGRAM_ADS_NOTE}</span>
      </p>

      {isLocked ? (
        <UpgradeCard title={UPGRADE_TITLE} description={UPGRADE_BODY} workspaceId={workspace?.id} />
      ) : error ? (
        <div className={ui.card}>
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : integrations === null ? (
        <SkeletonRows rows={4} height={168} />
      ) : (
        <>
          {actionError ? (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          ) : null}

          <div className={styles.grid}>
            {AD_PROVIDER_LIST.map((descriptor) => {
              const integration = byProvider(descriptor.provider);
              return (
                <ProviderCard
                  key={descriptor.provider}
                  descriptor={descriptor}
                  integration={integration}
                  canMutate={canMutate}
                  isBusy={busyProvider === descriptor.provider}
                  isConfirmingDelete={integration !== null && confirmingId === integration.id}
                  testState={integration ? testStates[integration.id] : undefined}
                  onConnect={() => setEditing(descriptor)}
                  onToggle={() => {
                    if (integration) void handleToggle(integration);
                  }}
                  onTest={() => {
                    if (integration) void handleTest(integration);
                  }}
                  onDelete={() => {
                    if (integration) void handleDelete(integration);
                  }}
                />
              );
            })}
          </div>

          {health ? <HealthTable health={health} /> : null}
        </>
      )}

      <ConnectModal
        channelId={channelId}
        descriptor={editing}
        integration={editing ? byProvider(editing.provider) : null}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </section>
  );
}
