'use client';

import styles from './overview.module.css';

export type RangeDays = 7 | 30;

const OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
];

/** Pill segment control, same look as the landing DeviceMockup range switcher. */
export function RangeToggle({ value, onChange }: { value: RangeDays; onChange: (days: RangeDays) => void }) {
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
