'use client';

import { ArrowRight, DownloadSimple, Info } from '@phosphor-icons/react';
import Link from 'next/link';
import { useState } from 'react';
import { downloadExport, type ExportType } from '@/lib/api';
import { useWorkspace } from '../shell/workspace-context';
import { billingHref } from './UpgradeCard';
import styles from './export.module.css';
import ui from './ui.module.css';

/** Rows a Free workspace gets per export (docs/PHASE7-BUILD.md section 3). */
export const FREE_EXPORT_ROWS = 100;

/**
 * Streams a CSV through fetch instead of navigating away, so a plan gate or a
 * permission error stays on the page and is shown next to the button.
 */
export function ExportButton({
  channelId,
  type,
  days,
  label = 'Export CSV',
}: {
  channelId: string;
  type: ExportType;
  days?: number;
  label?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const [isTruncated, setIsTruncated] = useState(false);
  const workspace = useWorkspace();

  const handleClick = async () => {
    if (isPending) return;
    setIsPending(true);
    setError('');
    setIsTruncated(false);

    const result = await downloadExport(channelId, type, days);
    setIsPending(false);
    if (result.ok) {
      setIsTruncated(result.data.truncated);
      return;
    }
    setError(result.error);
  };

  return (
    <span className={styles.wrap}>
      <button type="button" className={ui.btnGhost} onClick={() => void handleClick()} disabled={isPending}>
        <DownloadSimple size={15} />
        {isPending ? 'Preparing' : label}
      </button>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
      {isTruncated ? (
        <span className={styles.truncated} role="status">
          Cut off at the plan limit.{' '}
          <Link href={billingHref(workspace?.id)} className={styles.noteLink}>
            See plans
          </Link>
        </span>
      ) : null}
    </span>
  );
}

/** Free-plan row cap, shown above the table the export belongs to. */
export function ExportLimitNote() {
  const workspace = useWorkspace();
  if (!workspace || workspace.plan !== 'FREE') return null;

  return (
    <p className={styles.note}>
      <Info size={14} weight="duotone" className={styles.noteIcon} aria-hidden="true" />
      <span>Exports on the Free plan stop after the first {FREE_EXPORT_ROWS} rows.</span>
      <Link href={billingHref(workspace.id)} className={styles.noteLink}>
        See plans
        <ArrowRight size={12} weight="bold" />
      </Link>
    </p>
  );
}
