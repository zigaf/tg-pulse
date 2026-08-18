'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './sources-table.module.css';

/* sample data */
const SOURCES = [
  { name: 'seeding @crypto_daily', colorVar: '--src-seeding', subs: '1,240', cps: '$0.86', churn: '2.9%', width: 92, tone: 'good' },
  { name: 'Telegram Ads · creative #4', colorVar: '--src-tgads', subs: '890', cps: '$1.16', churn: '4.1%', width: 66, tone: 'good' },
  /* --src-yandex doubles as the third-platform (Meta) tick color */
  { name: 'Meta Ads · landing A', colorVar: '--src-yandex', subs: '610', cps: '$1.06', churn: '3.4%', width: 45, tone: 'good' },
  { name: 'seeding @spam_gems', colorVar: '--src-seeding', subs: '112', cps: '$2.63', churn: '19%', width: 9, tone: 'bad' },
] as const;

/** Attribution table: color ticks per source, animated volume bars, fraud flag on the worst row. */
export function SourcesTable() {
  const reduced = useReducedMotion();

  return (
    <div className={styles.table}>
      <div className={styles.headRow} aria-hidden="true">
        <span>source</span>
        <span className={styles.volHead}>volume</span>
        <span className={styles.alignRight}>joins</span>
        <span className={`${styles.alignRight} ${styles.cpsHead}`}>cps</span>
        <span className={styles.alignRight}>unsubs</span>
      </div>

      {SOURCES.map((source, index) => {
        const isBad = source.tone === 'bad';
        return (
          <div key={source.name} className={`${styles.row} ${isBad ? styles.rowBad : ''}`}>
            <span className={styles.rowName}>
              <span className={styles.tick} style={{ background: `var(${source.colorVar})` }} />
              <span className={styles.name}>{source.name}</span>
              {isBad ? <span className={styles.fraudBadge}>fraud?</span> : null}
            </span>
            <span className={styles.rowBar}>
              <motion.span
                className={`${styles.rowFill} ${isBad ? styles.fillBad : ''}`}
                style={{ width: `${source.width}%` }}
                initial={reduced ? false : { scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7, delay: 0.15 + index * 0.09, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
            <span className={styles.num}>{source.subs}</span>
            <span className={`${styles.num} ${styles.cpsCell}`}>{source.cps}</span>
            <span className={`${styles.num} ${isBad ? styles.bad : styles.good}`}>{source.churn}</span>
          </div>
        );
      })}
    </div>
  );
}
