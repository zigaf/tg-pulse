'use client';

import type { RevenueDays } from '@/lib/api';
import styles from './revenue.module.css';

const OPTIONS: { value: RevenueDays; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
];

/** Pill segment control for the revenue period; mirrors the overview range switcher. */
export function PeriodToggle({
  value,
  onChange,
}: {
  value: RevenueDays;
  onChange: (days: RevenueDays) => void;
}) {
  return (
    <div className={styles.segments} role="group" aria-label="Date range">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.segment} ${value === option.value ? styles.segmentActive : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
