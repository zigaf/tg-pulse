'use client';

import { X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPostback, type ApiPostback, type CreatePostbackInput } from '@/lib/api';
// Modal primitives (overlay, dialog, header, footer) are shared with the links feature.
import modal from '../links/links.module.css';
import ui from '../shared/ui.module.css';
import styles from './postbacks.module.css';

interface AddPostbackModalProps {
  channelId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (postback: ApiPostback) => void;
}

/** Macros supported by the postback engine; chips insert them into the template. */
const MACROS = ['event', 'slug', 'label', 'cid', 'yclid', 'gclid', 'fbclid', 'ttclid', 'tg_user_id'] as const;

const TEMPLATE_PLACEHOLDER = 'https://example.com/postback?cid={yclid}&event={event}';

const EMPTY_FORM: CreatePostbackInput = { name: '', urlTemplate: '', onJoin: true, onLeave: false };

/** Modal form: name, urlTemplate with clickable macro chips, join/leave event checkboxes. */
export function AddPostbackModal({ channelId, isOpen, onClose, onCreated }: AddPostbackModalProps) {
  const [form, setForm] = useState<CreatePostbackInput>(EMPTY_FORM);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const templateRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setForm(EMPTY_FORM);
    setError('');
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const insertMacro = (macro: string) => {
    const token = `{${macro}}`;
    const el = templateRef.current;
    if (!el) {
      setForm((previous) => ({ ...previous, urlTemplate: previous.urlTemplate + token }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setForm((previous) => ({ ...previous, urlTemplate: next }));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const canSubmit =
    form.name.trim().length > 0 && form.urlTemplate.trim().length > 0 && (form.onJoin || form.onLeave);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isPending || !canSubmit) return;
    setIsPending(true);
    setError('');
    const result = await createPostback(channelId, {
      name: form.name.trim(),
      urlTemplate: form.urlTemplate.trim(),
      onJoin: form.onJoin,
      onLeave: form.onLeave,
    });
    setIsPending(false);
    if (result.ok) {
      onCreated(result.data);
      onClose();
      return;
    }
    setError(result.error);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={modal.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-postback-title"
            className={modal.modal}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={modal.modalHead}>
              <h2 id="add-postback-title" className={modal.modalTitle}>
                Add postback
              </h2>
              <button type="button" className={modal.modalClose} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            <form onSubmit={(event) => void handleSubmit(event)} className={modal.form}>
              <div>
                <label htmlFor="postback-name" className={ui.label}>
                  Name
                </label>
                <input
                  id="postback-name"
                  className={ui.input}
                  value={form.name}
                  onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="Yandex Direct conversions"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="postback-template" className={ui.label}>
                  URL template
                </label>
                <textarea
                  id="postback-template"
                  ref={templateRef}
                  className={`${ui.input} ${styles.templateInput}`}
                  value={form.urlTemplate}
                  onChange={(event) => setForm((previous) => ({ ...previous, urlTemplate: event.target.value }))}
                  placeholder={TEMPLATE_PLACEHOLDER}
                  spellCheck={false}
                  required
                />
                <p className={styles.macroHint}>Click a macro to insert it at the cursor:</p>
                <div className={styles.macroChips}>
                  {MACROS.map((macro) => (
                    <button
                      key={macro}
                      type="button"
                      className={styles.macroChip}
                      onClick={() => insertMacro(macro)}
                    >
                      {`{${macro}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.checkRow}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={form.onJoin}
                    onChange={(event) => setForm((previous) => ({ ...previous, onJoin: event.target.checked }))}
                  />
                  On join
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={form.onLeave}
                    onChange={(event) => setForm((previous) => ({ ...previous, onLeave: event.target.checked }))}
                  />
                  On leave
                </label>
              </div>

              {error ? (
                <p className={modal.formError} role="alert">
                  {error}
                </p>
              ) : null}

              <footer className={modal.modalFoot}>
                <button type="button" className={ui.btnGhost} onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className={ui.btnPrimary} disabled={isPending || !canSubmit}>
                  {isPending ? 'Adding' : 'Add postback'}
                </button>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
