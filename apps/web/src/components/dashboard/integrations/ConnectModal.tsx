'use client';

import { X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { saveIntegration, type ApiIntegration } from '@/lib/api';
import { providerFields, type AdProviderDescriptor, type ProviderField } from '@/lib/ad-providers';
// Modal primitives (overlay, dialog, header, footer) are shared with the links feature.
import modal from '../links/links.module.css';
import ui from '../shared/ui.module.css';
import styles from './integrations.module.css';

interface ConnectModalProps {
  channelId: string;
  descriptor: AdProviderDescriptor | null;
  /** Present when reconnecting or editing an existing connection. */
  integration: ApiIntegration | null;
  onClose: () => void;
  onSaved: (integration: ApiIntegration) => void;
}

type FormValues = Record<string, string>;

/**
 * Initial values: config comes from the stored row, secrets always start empty.
 * A stored secret is never sent back to the browser, so an empty field means "keep it".
 */
function initialValues(descriptor: AdProviderDescriptor, integration: ApiIntegration | null): FormValues {
  const entries = providerFields(descriptor).map((field) => {
    if (field.secret) return [field.name, ''] as const;
    const stored = integration?.config?.[field.name];
    return [field.name, stored ?? field.defaultValue ?? ''] as const;
  });
  return Object.fromEntries(entries);
}

function isMissing(field: ProviderField, value: string, isEditing: boolean): boolean {
  if (field.optional) return false;
  // Editing keeps the stored secret when the field is left empty.
  if (field.secret && isEditing) return false;
  return value.trim().length === 0;
}

/** Connect form for one platform: secrets, non-secret settings and the platform setup checklist. */
export function ConnectModal({ channelId, descriptor, integration, onClose, onSaved }: ConnectModalProps) {
  const [values, setValues] = useState<FormValues>({});
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  const isOpen = descriptor !== null;
  const isEditing = integration !== null;

  useEffect(() => {
    if (!descriptor) return undefined;
    setValues(initialValues(descriptor, integration));
    setError('');
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [descriptor, integration, onClose]);

  const fields = useMemo(() => (descriptor ? providerFields(descriptor) : []), [descriptor]);
  const canSubmit =
    descriptor !== null && fields.every((field) => !isMissing(field, values[field.name] ?? '', isEditing));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!descriptor || isPending || !canSubmit) return;

    const credentials = Object.fromEntries(
      descriptor.credentialFields
        .map((field) => [field.name, (values[field.name] ?? '').trim()] as const)
        .filter(([, value]) => value.length > 0),
    );
    const config = Object.fromEntries(
      descriptor.configFields.map((field) => [field.name, (values[field.name] ?? '').trim()] as const),
    );

    setIsPending(true);
    setError('');
    const result = await saveIntegration(channelId, {
      provider: descriptor.provider,
      // Omitted on an edit with untouched secrets, which keeps the stored token.
      ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
      config,
    });
    setIsPending(false);

    if (result.ok) {
      onSaved(result.data);
      onClose();
      return;
    }
    setError(result.error);
  };

  return (
    <AnimatePresence>
      {isOpen && descriptor ? (
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
            aria-labelledby="connect-integration-title"
            className={`${modal.modal} ${styles.connectModal}`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={modal.modalHead}>
              <h2 id="connect-integration-title" className={modal.modalTitle}>
                {isEditing ? 'Edit' : 'Connect'} {descriptor.name}
              </h2>
              <button type="button" className={modal.modalClose} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            <p className={styles.modalIntro}>{descriptor.summary}</p>

            {descriptor.setupSteps.length > 0 ? (
              <ol className={styles.setupSteps}>
                {descriptor.setupSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}

            <form onSubmit={(event) => void handleSubmit(event)} className={modal.form}>
              {fields.map((field) => {
                const inputId = `integration-${descriptor.provider}-${field.name}`;
                const isSecret = field.secret === true;
                return (
                  <div key={field.name}>
                    <label htmlFor={inputId} className={ui.label}>
                      {field.label}
                      {field.optional ? <span className={styles.optionalTag}>optional</span> : null}
                    </label>
                    <input
                      id={inputId}
                      className={ui.input}
                      type={isSecret ? 'password' : 'text'}
                      value={values[field.name] ?? ''}
                      onChange={(event) =>
                        setValues((previous) => ({ ...previous, [field.name]: event.target.value }))
                      }
                      placeholder={
                        isSecret && isEditing ? 'Leave empty to keep the stored token' : field.placeholder
                      }
                      autoComplete={isSecret ? 'new-password' : 'off'}
                      spellCheck={false}
                      required={!field.optional && !(isSecret && isEditing)}
                    />
                    {field.hint ? <p className={styles.fieldHint}>{field.hint}</p> : null}
                  </div>
                );
              })}

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
                  {isPending ? 'Saving' : isEditing ? 'Save changes' : 'Connect'}
                </button>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
