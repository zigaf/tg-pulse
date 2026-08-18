'use client';

import { X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import type { TrackedLink } from '@/lib/api';
import { pixelSnippet } from '@/lib/format';
import { CopyButton } from './CopyButton';
import styles from './links.module.css';

interface InstallPixelModalProps {
  /** Link whose pixel is being installed; null keeps the modal closed. */
  link: TrackedLink | null;
  onClose: () => void;
}

const INSTRUCTIONS = [
  'Paste the snippet right before the closing </body> tag of your landing page.',
  'The script automatically captures UTM tags and ad-platform click IDs (yclid, gclid, fbclid, ttclid).',
  'Clicks on the go-link get tied to the visit, so joins are attributed back to the ad.',
];

/** Modal with a ready-to-paste landing pixel snippet for one tracked link. */
export function InstallPixelModal({ link, onClose }: InstallPixelModalProps) {
  const isOpen = link !== null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const snippet = link ? pixelSnippet(link.slug) : '';

  return (
    <AnimatePresence>
      {link ? (
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
            aria-labelledby="install-pixel-title"
            className={styles.modal}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHead}>
              <h2 id="install-pixel-title" className={styles.modalTitle}>
                Install pixel
              </h2>
              <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            <p className={styles.pixelIntro}>
              Landing pixel for <strong>{link.label}</strong>
            </p>

            <div className={styles.snippetBlock}>
              <code className={styles.snippetCode}>{snippet}</code>
              <CopyButton text={snippet} label="Copy snippet" />
            </div>

            <ol className={styles.pixelSteps}>
              {INSTRUCTIONS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
