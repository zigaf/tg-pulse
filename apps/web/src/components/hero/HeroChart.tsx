'use client';

import { motion } from 'framer-motion';
import styles from './hero.module.css';

/**
 * Animated "live dashboard" teaser: a line chart drawing itself with
 * floating stat cards. Pure SVG + framer-motion, no chart lib on the landing.
 */

const GOOD = 'M0,150 C60,140 90,120 140,110 C190,100 230,70 290,62 C350,54 400,40 460,24';
const BAD = 'M0,155 C70,150 130,146 200,140 C270,134 340,132 460,126';

export function HeroChart() {
  return (
    <div className={styles.chartCard} aria-hidden="true">
      <div className={styles.chartHeader}>
        <span className={styles.dot} />
        <span>Подписчики по источникам · live</span>
      </div>

      <svg viewBox="0 0 460 180" className={styles.chartSvg}>
        {[30, 75, 120].map((y) => (
          <line key={y} x1="0" y1={y} x2="460" y2={y} className={styles.grid} />
        ))}
        <motion.path
          d={BAD}
          fill="none"
          className={styles.lineBad}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: 'easeOut', delay: 0.3 }}
        />
        <motion.path
          d={GOOD}
          fill="none"
          className={styles.lineGood}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: 'easeOut', delay: 0.55 }}
        />
      </svg>

      <motion.div
        className={`${styles.statCard} ${styles.statTop}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.5 }}
      >
        <span className={styles.statLabel}>посев @finance_daily</span>
        <span className={styles.statValue}>CPS 74 ₽ · отписки 4%</span>
      </motion.div>

      <motion.div
        className={`${styles.statCard} ${styles.statBottom}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.7, duration: 0.5 }}
      >
        <span className={styles.statLabel}>Telegram Ads · креатив #3</span>
        <span className={`${styles.statValue} ${styles.negative}`}>CPS 212 ₽ · отключить</span>
      </motion.div>
    </div>
  );
}
