'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { DashboardChart } from './DashboardChart';
import { LiveFeed } from './LiveFeed';
import { SourceDonut } from './SourceDonut';
import { SourcesTable } from './SourcesTable';
import styles from './device.module.css';

/**
 * Layered dashboard mockup: ghost back screen, perspective-tilted main device
 * that straightens on scroll, and floating satellites moving faster than the device.
 */
export function DeviceMockup() {
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: wrap, offset: ['start 90%', 'start 25%'] });

  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const yBack = useTransform(scrollYProgress, [0, 1], [60, 24]);
  const yFloat = useTransform(scrollYProgress, [0, 1], [90, -10]);

  return (
    <div ref={wrap} className={styles.perspective}>
      {/* back layer: ghost outline of a second screen */}
      <motion.div
        className={styles.ghost}
        aria-hidden="true"
        style={reduced ? undefined : { y: yBack, x: '-3%', scale: 0.94 }}
      >
        <div className={styles.ghostBar} />
        <div className={styles.ghostTiles}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.ghostBlock} />
      </motion.div>

      {/* main layer */}
      <motion.div className={styles.device} style={reduced ? undefined : { rotateX, y }}>
        <div className={styles.chromeBar} aria-hidden="true">
          <span className={styles.lights}>
            <span className={`${styles.light} ${styles.lightRed}`} />
            <span className={`${styles.light} ${styles.lightAmber}`} />
            <span className={`${styles.light} ${styles.lightGreen}`} />
          </span>
          <span className={styles.urlPill}>app.tgpulse.io/channels/daily_alpha</span>
          <span />
        </div>

        <div className={styles.topbar}>
          <div className={styles.channel}>
            <span className={styles.avatar} />
            <div>
              <p className={styles.channelName}>Daily Alpha</p>
              {/* sample data */}
              <p className={styles.channelMeta}>@daily_alpha · 48,210 subscribers</p>
            </div>
          </div>
          <div className={styles.segments}>
            <span className={styles.segment}>24h</span>
            <span className={`${styles.segment} ${styles.segmentActive}`}>7d</span>
            <span className={styles.segment}>30d</span>
          </div>
        </div>

        {/* sample data */}
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Subscribers</p>
            <p className={styles.tileValue}>+2,852</p>
            <p className={`${styles.tileDelta} ${styles.up}`}>↑ 18% vs last week</p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Cost per subscriber</p>
            <p className={styles.tileValue}>$1.02</p>
            <p className={`${styles.tileDelta} ${styles.up}`}>↓ $0.37 after pausing #7</p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Unsubs, 7 days</p>
            <p className={styles.tileValue}>3.2%</p>
            <p className={styles.tileDelta}>normal for the niche</p>
          </div>
        </div>

        <DashboardChart />
        <SourcesTable />
      </motion.div>

      {/* float layer: satellites move faster than the device */}
      <motion.div className={styles.floatFeed} style={reduced ? undefined : { y: yFloat }}>
        <LiveFeed />
      </motion.div>
      <motion.div className={styles.floatDonut} style={reduced ? undefined : { y: yFloat }}>
        <SourceDonut />
      </motion.div>

      <div className={styles.deviceGlow} aria-hidden="true" />
      <div className={styles.reflection} aria-hidden="true" />
    </div>
  );
}
