'use client';

import { Warning, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { CopyButton } from '../links/CopyButton';
import ui from '../shared/ui.module.css';
import styles from './revenue.module.css';

/** One-shot reveal of a freshly created ingest key; `rawKey` null keeps it closed. */
export function NewKeyModal({ rawKey, onClose }: { rawKey: string | null; onClose: () => void }) {
  const isOpen = rawKey !== null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {rawKey ? (
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
            aria-labelledby="new-key-title"
            className={styles.modal}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHead}>
              <h2 id="new-key-title" className={styles.modalTitle}>
                API key created
              </h2>
              <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            <p className={styles.warnBanner} role="alert">
              <Warning size={16} weight="fill" className={styles.noticeIcon} />
              Store it now, it will not be shown again. Only a hash of the key is kept on our side.
            </p>

            <div className={styles.rawKeyBlock}>
              <code className={styles.rawKey}>{rawKey}</code>
              <CopyButton text={rawKey} label="Copy API key" />
            </div>

            <footer className={styles.modalFoot}>
              <button type="button" className={ui.btnPrimary} onClick={onClose}>
                I stored it
              </button>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
