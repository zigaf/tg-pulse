'use client';

import { CaretDown, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type FormEvent } from 'react';
import { createLink, type CreateLinkInput, type TrackedLink } from '@/lib/api';
import ui from '../shared/ui.module.css';
import styles from './links.module.css';

interface CreateLinkModalProps {
  channelId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (link: TrackedLink) => void;
}

const EMPTY_FORM: CreateLinkInput = { label: '', creative: '', utmSource: '', utmMedium: '', utmCampaign: '' };

function cleanInput(form: CreateLinkInput): CreateLinkInput {
  const input: CreateLinkInput = { label: form.label.trim() };
  if (form.creative?.trim()) input.creative = form.creative.trim();
  if (form.utmSource?.trim()) input.utmSource = form.utmSource.trim();
  if (form.utmMedium?.trim()) input.utmMedium = form.utmMedium.trim();
  if (form.utmCampaign?.trim()) input.utmCampaign = form.utmCampaign.trim();
  return input;
}

/** Modal form: label (required), creative, collapsed UTM parameters. */
export function CreateLinkModal({ channelId, isOpen, onClose, onCreated }: CreateLinkModalProps) {
  const [form, setForm] = useState<CreateLinkInput>(EMPTY_FORM);
  const [isUtmOpen, setIsUtmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    setForm(EMPTY_FORM);
    setIsUtmOpen(false);
    setError('');
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const setField = (field: keyof CreateLinkInput) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isPending || !form.label.trim()) return;
    setIsPending(true);
    setError('');
    const result = await createLink(channelId, cleanInput(form));
    setIsPending(false);
    if (result.ok) {
      onCreated(result.data);
      onClose();
      return;
    }
    setError(result.error);
  };

  const fields: { key: keyof CreateLinkInput; label: string; placeholder: string }[] = [
    { key: 'utmSource', label: 'utm_source', placeholder: 'telegram_ads' },
    { key: 'utmMedium', label: 'utm_medium', placeholder: 'cpc' },
    { key: 'utmCampaign', label: 'utm_campaign', placeholder: 'august_launch' },
  ];

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
            aria-labelledby="create-link-title"
            className={styles.modal}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHead}>
              <h2 id="create-link-title" className={styles.modalTitle}>
                Create tracked link
              </h2>
              <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            <form onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
              <div>
                <label htmlFor="link-label" className={ui.label}>
                  Label
                </label>
                <input
                  id="link-label"
                  className={ui.input}
                  value={form.label}
                  onChange={(event) => setField('label')(event.target.value)}
                  placeholder="Telegram Ads, creative #4"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="link-creative" className={ui.label}>
                  Creative
                </label>
                <input
                  id="link-creative"
                  className={ui.input}
                  value={form.creative ?? ''}
                  onChange={(event) => setField('creative')(event.target.value)}
                  placeholder="Optional: which ad or post this link runs in"
                />
              </div>

              <button
                type="button"
                className={styles.disclosure}
                onClick={() => setIsUtmOpen((open) => !open)}
                aria-expanded={isUtmOpen}
              >
                <CaretDown size={12} weight="bold" className={isUtmOpen ? styles.caretOpen : styles.caret} />
                UTM parameters
              </button>

              {isUtmOpen ? (
                <div className={styles.utmGrid}>
                  {fields.map((field) => (
                    <div key={field.key}>
                      <label htmlFor={`link-${field.key}`} className={ui.label}>
                        {field.label}
                      </label>
                      <input
                        id={`link-${field.key}`}
                        className={ui.input}
                        value={form[field.key] ?? ''}
                        onChange={(event) => setField(field.key)(event.target.value)}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {error ? (
                <p className={styles.formError} role="alert">
                  {error}
                </p>
              ) : null}

              <footer className={styles.modalFoot}>
                <button type="button" className={ui.btnGhost} onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className={ui.btnPrimary} disabled={isPending || !form.label.trim()}>
                  {isPending ? 'Creating' : 'Create link'}
                </button>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
