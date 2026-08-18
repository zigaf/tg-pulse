'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import styles from './mobile-hero.module.css';

/* sample data */
const EVENT_SOURCES = [
  { label: 'seeding', colorVar: '--src-seeding' },
  { label: 'tg ads', colorVar: '--src-tgads' },
  { label: 'meta', colorVar: '--src-yandex' },
  { label: 'organic', colorVar: '--src-organic' },
] as const;

const ROTATE_MS = 3000;
const STACK_SIZE = 4;
const DEPTH_SCALE_STEP = 0.04;
const DEPTH_OPACITY_STEP = 0.16;

function eventAt(id: number) {
  const index = ((id % EVENT_SOURCES.length) + EVENT_SOURCES.length) % EVENT_SOURCES.length;
  const minute = (2 + id) % 60;
  return { ...EVENT_SOURCES[index], time: `14:${String(minute).padStart(2, '0')}` };
}

/**
 * Phone-native hero visual: a push-notification stack of live subscription
 * events plus a compact one-line stat strip. Rendered only below 640px.
 */
export function MobileHeroVisual() {
  const reduced = useReducedMotion();
  const [head, setHead] = useState(STACK_SIZE - 1);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setHead((current) => current + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const cards = Array.from({ length: STACK_SIZE }, (_, i) => {
    const id = head - i;
    return { id, ...eventAt(id) };
  });

  return (
    <div className={styles.visual}>
      <div className={styles.stack}>
        <AnimatePresence initial={false} mode="popLayout">
          {cards.map((card, depth) => (
            <motion.div
              key={card.id}
              layout
              className={styles.card}
              style={{ zIndex: STACK_SIZE - depth }}
              initial={{ opacity: 0, y: -14, scale: 1 }}
              animate={{
                opacity: 1 - depth * DEPTH_OPACITY_STEP,
                y: 0,
                scale: 1 - depth * DEPTH_SCALE_STEP,
              }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              {/* semantic live indicator: a real-time subscription event */}
              <span className={styles.liveDot} />
              <span className={styles.cardText}>+1 subscriber</span>
              <span className={styles.sourceTag} style={{ color: `var(${card.colorVar})` }}>
                {card.label}
              </span>
              <span className={styles.time}>{card.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* sample data */}
      <div className={styles.stats}>
        <span className={styles.stat}>
          <span className={`${styles.statValue} ${styles.positive}`}>+2,852</span>
          <span className={styles.statLabel}>joins</span>
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>$1.02</span>
          <span className={styles.statLabel}>CPS</span>
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>3.2%</span>
          <span className={styles.statLabel}>unsubs</span>
        </span>
      </div>
    </div>
  );
}
