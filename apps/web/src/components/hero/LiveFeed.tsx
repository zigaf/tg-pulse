'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import styles from './live-feed.module.css';

/* sample data */
const FEED_SOURCES = [
  { label: 'tg ads', colorVar: '--src-tgads' },
  { label: 'seeding', colorVar: '--src-seeding' },
  { label: 'meta', colorVar: '--src-yandex' },
] as const;

const ROTATE_MS = 2800;
const VISIBLE_ROWS = 3;
const STAMP_DELAY_S = 0.25;

function sourceAt(id: number) {
  const index = ((id % FEED_SOURCES.length) + FEED_SOURCES.length) % FEED_SOURCES.length;
  return FEED_SOURCES[index];
}

/** Live subscription feed: a new row drops in from the top every ~2.8s, the oldest slides out. */
export function LiveFeed() {
  const reduced = useReducedMotion();
  const [head, setHead] = useState(VISIBLE_ROWS - 1);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setHead((current) => current + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const rows = Array.from({ length: VISIBLE_ROWS }, (_, i) => {
    const id = head - i;
    return { id, ...sourceAt(id) };
  });

  return (
    <div className={styles.feed}>
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((row) => (
          <motion.div
            key={row.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className={styles.row}
          >
            <span className={styles.liveDot} />
            <span className={styles.rowText}>+1 subscriber</span>
            <motion.span
              className={styles.sourceTag}
              style={{ color: `var(${row.colorVar})` }}
              initial={{ opacity: 0, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: STAMP_DELAY_S, type: 'spring', stiffness: 520, damping: 24 }}
            >
              {row.label}
            </motion.span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
