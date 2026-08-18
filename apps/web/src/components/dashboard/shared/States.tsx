'use client';

import { WarningCircle } from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import styles from './states.module.css';
import ui from './ui.module.css';

/** Shimmer placeholder block. */
export function Skeleton({ width, height = 14, radius }: { width: number | string; height?: number; radius?: number }) {
  const style: CSSProperties = { width, height };
  if (radius !== undefined) style.borderRadius = radius;
  return <span className={ui.skeleton} style={style} aria-hidden="true" />;
}

/** A stack of skeleton table rows. */
export function SkeletonRows({ rows = 5, height = 40 }: { rows?: number; height?: number }) {
  return (
    <div className={styles.skeletonRows} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={ui.skeleton} style={{ height, borderRadius: 'var(--radius-md)' }} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.state}>
      {icon ? <span className={styles.stateIcon}>{icon}</span> : null}
      <p className={styles.stateTitle}>{title}</p>
      {children ? <div className={styles.stateBody}>{children}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={styles.state} role="alert">
      <span className={`${styles.stateIcon} ${styles.stateIconError}`}>
        <WarningCircle size={26} weight="duotone" />
      </span>
      <p className={styles.stateTitle}>Could not load data</p>
      <div className={styles.stateBody}>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className={ui.btnGhost} onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
