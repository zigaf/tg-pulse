'use client';

import { Eye, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  createShareLink,
  isUpgradeRequired,
  shareReportUrl,
  type ReportWindowDays,
  type ShareLink,
} from '@/lib/api';
import { CopyButton } from '../links/CopyButton';
import ui from '../shared/ui.module.css';
import styles from './share.module.css';

interface ShareReportModalProps {
  channelId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (link: ShareLink) => void;
  /** Plan gate (HTTP 402): the parent shows an upgrade notice. */
  onUpgradeRequired: (message: string) => void;
}

const WINDOW_OPTIONS: { value: ReportWindowDays; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

/** undefined = the link never expires. */
const EXPIRY_OPTIONS: { key: string; value: number | undefined; label: string }[] = [
  { key: '7', value: 7, label: 'Expires in 7 days' },
  { key: '30', value: 30, label: 'Expires in 30 days' },
  { key: 'never', value: undefined, label: 'No expiry' },
];

/** Creates a read-only report link a client can open without an account. */
export function ShareReportModal({
  channelId,
  isOpen,
  onClose,
  onCreated,
  onUpgradeRequired,
}: ShareReportModalProps) {
  const [windowDays, setWindowDays] = useState<ReportWindowDays>(30);
  const [expiryKey, setExpiryKey] = useState('30');
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<ShareLink | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    setWindowDays(30);
    setExpiryKey('30');
    setLabel('');
    setCreated(null);
    setError('');
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleCreate = async () => {
    if (isPending) return;
    setIsPending(true);
    setError('');

    const expiresInDays = EXPIRY_OPTIONS.find((option) => option.key === expiryKey)?.value;
    const result = await createShareLink(channelId, {
      windowDays,
      ...(expiresInDays === undefined ? {} : { expiresInDays }),
      ...(label.trim() ? { label: label.trim() } : {}),
    });
    setIsPending(false);

    if (result.ok) {
      setCreated(result.data);
      onCreated(result.data);
      return;
    }
    if (isUpgradeRequired(result)) {
      onUpgradeRequired(result.error);
      onClose();
      return;
    }
    setError(result.error);
  };

  const url = created ? shareReportUrl(created) : '';
  const expiryLabel = EXPIRY_OPTIONS.find((option) => option.key === expiryKey)?.label ?? '';

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-report-title"
            className={styles.modal}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHead}>
              <h2 id="share-report-title" className={styles.modalTitle}>
                {created ? 'Report link ready' : 'Share report'}
              </h2>
              <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            {created ? (
              <div className={styles.linkResult}>
                <div className={styles.linkBox}>
                  <span className={styles.linkCode}>{url}</span>
                  {url ? <CopyButton text={url} label="Copy report link" /> : null}
                </div>
                <p className={styles.linkNote}>
                  <Eye size={14} weight="duotone" className={styles.linkNoteIcon} aria-hidden="true" />
                  <span>
                    Anyone with this link sees joins, leaves and sources for the last {created.windowDays} days. No
                    subscriber names, no revenue, no account access.
                  </span>
                </p>
                <footer className={styles.modalFoot}>
                  <button type="button" className={ui.btnPrimary} onClick={onClose}>
                    Done
                  </button>
                </footer>
              </div>
            ) : (
              <div className={styles.form}>
                <div>
                  <label htmlFor="share-label" className={ui.label}>
                    Label
                  </label>
                  <input
                    id="share-label"
                    className={ui.input}
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Optional: who the report is for"
                  />
                </div>

                <fieldset>
                  <legend className={ui.label}>Report window</legend>
                  <div className={styles.choiceRow}>
                    {WINDOW_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.choice} ${windowDays === option.value ? styles.choiceActive : ''}`}
                        aria-pressed={windowDays === option.value}
                        onClick={() => setWindowDays(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className={ui.label}>Link lifetime</legend>
                  <div className={styles.choiceRow}>
                    {EXPIRY_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`${styles.choice} ${expiryKey === option.key ? styles.choiceActive : ''}`}
                        aria-pressed={expiryKey === option.key}
                        onClick={() => setExpiryKey(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {error ? (
                  <p className={styles.formError} role="alert">
                    {error}
                  </p>
                ) : null}

                <footer className={styles.modalFoot}>
                  <button type="button" className={ui.btnGhost} onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={ui.btnPrimary}
                    onClick={() => void handleCreate()}
                    disabled={isPending}
                    title={expiryLabel}
                  >
                    {isPending ? 'Creating' : 'Create link'}
                  </button>
                </footer>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
