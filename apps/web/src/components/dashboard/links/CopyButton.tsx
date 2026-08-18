'use client';

import { Check, Copy } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import styles from './links.module.css';

const COPIED_RESET_MS = 2000;

/** Copies text to the clipboard, shows a check mark for 2 seconds. */
export function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — leave the button as is.
    }
  };

  return (
    <button
      type="button"
      className={`${styles.copyBtn} ${isCopied ? styles.copyBtnDone : ''}`}
      onClick={() => void handleCopy()}
      aria-label={isCopied ? 'Copied' : label}
      title={isCopied ? 'Copied' : label}
    >
      {isCopied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
    </button>
  );
}
