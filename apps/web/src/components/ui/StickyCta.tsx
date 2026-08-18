'use client';

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useState } from 'react';
import styles from './sticky-cta.module.css';

const SHOW_AFTER_PX = 900;

/** Mobile-only bottom bar with the primary CTA, shown after the hero scrolls away. */
export function StickyCta() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => {
    setVisible(y > SHOW_AFTER_PX);
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.bar}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        >
          <span className={styles.hint}>Free for one channel</span>
          <a href="/app" className={styles.cta}>
            Start free
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
