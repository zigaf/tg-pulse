'use client';

import { Clock, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  createInvite,
  inviteUrl,
  isUpgradeRequired,
  type WorkspaceInvite,
  type WorkspaceRole,
} from '@/lib/api';
import { CopyButton } from '../links/CopyButton';
import ui from '../shared/ui.module.css';
import styles from './team.module.css';

interface InviteModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (invite: WorkspaceInvite) => void;
  /** Member quota hit (HTTP 402): the parent shows an upgrade notice. */
  onUpgradeRequired: (message: string) => void;
}

const INVITE_ROLES: { role: Exclude<WorkspaceRole, 'OWNER'>; name: string; hint: string }[] = [
  {
    role: 'ADMIN',
    name: 'Admin',
    hint: 'Creates links, postbacks and keys. Cannot touch billing or remove owners.',
  },
  {
    role: 'VIEWER',
    name: 'Viewer',
    hint: 'Reads dashboards and exports. Changes nothing.',
  },
];

/** Invite flow: pick a role, create the one-time link, hand it over with a copy button. */
export function InviteModal({ workspaceId, isOpen, onClose, onCreated, onUpgradeRequired }: InviteModalProps) {
  const [role, setRole] = useState<WorkspaceRole>('VIEWER');
  const [invite, setInvite] = useState<WorkspaceInvite | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    setRole('VIEWER');
    setInvite(null);
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
    const result = await createInvite(workspaceId, role);
    setIsPending(false);

    if (result.ok) {
      setInvite(result.data);
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

  const url = invite ? inviteUrl(invite) : '';

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
            aria-labelledby="invite-title"
            className={styles.modal}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHead}>
              <h2 id="invite-title" className={styles.modalTitle}>
                {invite ? 'Invite link ready' : 'Invite member'}
              </h2>
              <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            {invite ? (
              <div className={styles.linkResult}>
                <div className={styles.linkBox}>
                  <span className={styles.linkCode}>{url || 'Link is available in the invites table.'}</span>
                  {url ? <CopyButton text={url} label="Copy invite link" /> : null}
                </div>
                <p className={styles.linkNote}>
                  <Clock size={14} weight="duotone" className={styles.linkNoteIcon} aria-hidden="true" />
                  <span>One-time link, expires in 7 days. It stops working the moment somebody joins with it.</span>
                </p>
                <footer className={styles.modalFoot}>
                  <button type="button" className={ui.btnPrimary} onClick={onClose}>
                    Done
                  </button>
                </footer>
              </div>
            ) : (
              <div className={styles.form}>
                <fieldset>
                  <legend className={ui.label}>Role</legend>
                  <div className={styles.roleOptions}>
                    {INVITE_ROLES.map((option) => (
                      <label
                        key={option.role}
                        className={`${styles.roleOption} ${role === option.role ? styles.roleOptionActive : ''}`}
                      >
                        <input
                          type="radio"
                          name="invite-role"
                          value={option.role}
                          checked={role === option.role}
                          onChange={() => setRole(option.role)}
                        />
                        <span className={styles.roleOptionText}>
                          <span className={styles.roleOptionName}>{option.name}</span>
                          <span className={styles.roleOptionHint}>{option.hint}</span>
                        </span>
                      </label>
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
