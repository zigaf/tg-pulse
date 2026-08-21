'use client';

import { useState } from 'react';
import { isUpgradeRequired, updateWorkspaceBranding, type ApiWorkspace } from '@/lib/api';
import { isFeatureLocked } from '@/lib/billing';
import ui from '../shared/ui.module.css';
import { UpgradeCard } from '../shared/UpgradeCard';
import styles from './team.module.css';

const UPGRADE_TITLE = 'White-label reports are part of Agency';
const UPGRADE_BODY =
  'Client report links carry your agency name instead of TGPulse — the page, the bar, the footer. Your clients see your brand only.';

/**
 * Workspace branding for public client reports (Agency feature). Saving empty
 * fields clears the branding; the server enforces the plan gate with 402.
 */
export function BrandingCard({
  workspace,
  isManager,
}: {
  workspace: ApiWorkspace;
  isManager: boolean;
}) {
  const [brandName, setBrandName] = useState(workspace.brandName ?? '');
  const [brandUrl, setBrandUrl] = useState(workspace.brandUrl ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const [isLockedByApi, setIsLockedByApi] = useState(false);

  const isLocked = isFeatureLocked(workspace.entitlements, 'whiteLabel') || isLockedByApi;

  const handleSave = async () => {
    setIsSaving(true);
    setIsSaved(false);
    setError('');
    const result = await updateWorkspaceBranding(workspace.id, { brandName, brandUrl });
    setIsSaving(false);

    if (!result.ok) {
      if (isUpgradeRequired(result)) {
        setIsLockedByApi(true);
        return;
      }
      setError(result.error);
      return;
    }
    setBrandName(result.data.brandName ?? '');
    setBrandUrl(result.data.brandUrl ?? '');
    setIsSaved(true);
  };

  if (isLocked) {
    return (
      <div className={styles.upgradeWrap}>
        <UpgradeCard title={UPGRADE_TITLE} description={UPGRADE_BODY} workspaceId={workspace.id} />
      </div>
    );
  }

  return (
    <div className={`${ui.card} ${styles.brandingCard}`}>
      <div className={styles.brandingFields}>
        <label className={styles.brandingField}>
          <span className={ui.label}>Brand name</span>
          <input
            className={ui.input}
            value={brandName}
            onChange={(event) => {
              setBrandName(event.target.value);
              setIsSaved(false);
            }}
            placeholder="Acme Media"
            maxLength={60}
            disabled={!isManager || isSaving}
          />
          <span className={styles.brandingHint}>Shown on report pages instead of TGPulse.</span>
        </label>
        <label className={styles.brandingField}>
          <span className={ui.label}>Brand link</span>
          <input
            className={ui.input}
            value={brandUrl}
            onChange={(event) => {
              setBrandUrl(event.target.value);
              setIsSaved(false);
            }}
            placeholder="https://acme.agency"
            maxLength={200}
            disabled={!isManager || isSaving}
          />
          <span className={styles.brandingHint}>Optional. The brand name links here.</span>
        </label>
      </div>

      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}

      {isManager ? (
        <div className={styles.brandingActions}>
          <button type="button" className={ui.btnPrimary} onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save branding'}
          </button>
          {isSaved ? <span className={styles.brandingSaved}>Saved</span> : null}
          <span className={styles.brandingHint}>Leave both fields empty and save to restore TGPulse branding.</span>
        </div>
      ) : (
        <p className={styles.brandingHint}>Branding is managed by owners and admins.</p>
      )}
    </div>
  );
}
