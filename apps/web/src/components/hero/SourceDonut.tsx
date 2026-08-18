'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './donut.module.css';

/** Visual gap between segments, in pathLength units (0..100). */
const SEGMENT_GAP = 1.6;

/* sample data: share of subscriptions per source */
const SEGMENTS = [
  { colorVar: '--src-seeding', pct: 43.5 },
  { colorVar: '--src-tgads', pct: 31.2 },
  { colorVar: '--src-yandex', pct: 21.4 },
  { colorVar: '--src-organic', pct: 3.9 },
] as const;

const SEGMENTS_WITH_START = SEGMENTS.reduce<
  Array<{ colorVar: string; pct: number; start: number }>
>((list, segment) => {
  const previous = list[list.length - 1];
  const start = previous ? previous.start + previous.pct : 0;
  return [...list, { ...segment, start }];
}, []);

/** Donut of subscriptions by source; segments sweep in on viewport entry. */
export function SourceDonut() {
  const reduced = useReducedMotion();

  return (
    <div className={styles.card}>
      <svg viewBox="0 0 100 100" className={styles.donut} aria-hidden="true">
        <circle cx="50" cy="50" r="40" className={styles.track} />
        <g transform="rotate(-90 50 50)">
          {SEGMENTS_WITH_START.map((segment, index) => {
            const visible = Math.max(segment.pct - SEGMENT_GAP, 0.5);
            return (
              <motion.circle
                key={segment.colorVar}
                cx="50"
                cy="50"
                r="40"
                pathLength={100}
                strokeDashoffset={-segment.start}
                className={styles.segment}
                style={{ stroke: `var(${segment.colorVar})` }}
                initial={reduced ? false : { strokeDasharray: '0 100' }}
                whileInView={{ strokeDasharray: `${visible} ${100 - visible}` }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.9, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })}
        </g>
      </svg>
      {/* sample data */}
      <span className={styles.value}>2,852</span>
    </div>
  );
}
