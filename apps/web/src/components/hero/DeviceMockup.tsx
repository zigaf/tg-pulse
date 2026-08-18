'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import styles from './device.module.css';

const SOURCES = [
  { name: 'посев @invest_talk', subs: '1 240', cps: '71 ₽', churn: '2.9%', width: 92, tone: 'good' },
  { name: 'Telegram Ads · крео #4', subs: '890', cps: '96 ₽', churn: '4.1%', width: 66, tone: 'good' },
  { name: 'Я.Директ · лендинг A', subs: '610', cps: '88 ₽', churn: '3.4%', width: 45, tone: 'good' },
  { name: 'посев @biz_daily', subs: '112', cps: '218 ₽', churn: '19%', width: 9, tone: 'bad' },
] as const;

/** Perspective-tilted dashboard mockup that straightens as you scroll (ref: Nexora hero). */
export function DeviceMockup() {
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: wrap, offset: ['start 90%', 'start 25%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);

  return (
    <div ref={wrap} className={styles.perspective}>
      <motion.div
        className={styles.device}
        style={reduced ? undefined : { rotateX, y }}
      >
        <div className={styles.topbar}>
          <div className={styles.channel}>
            <span className={styles.avatar} />
            <div>
              <p className={styles.channelName}>Инвестиции без воды</p>
              <p className={styles.channelMeta}>@invest_bez_vody · 48 210 подписчиков</p>
            </div>
          </div>
          <div className={styles.range}>7 дней</div>
        </div>

        <div className={styles.tiles}>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Подписки</p>
            <p className={styles.tileValue}>+2 852</p>
            <p className={`${styles.tileDelta} ${styles.up}`}>↑ 18% к прошлой неделе</p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Цена подписчика</p>
            <p className={styles.tileValue}>84 ₽</p>
            <p className={`${styles.tileDelta} ${styles.up}`}>↓ 31 ₽ после отключения #7</p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Отписки 7 дней</p>
            <p className={styles.tileValue}>3.2%</p>
            <p className={styles.tileDelta}>в норме для ниши</p>
          </div>
        </div>

        <div className={styles.chartBlock}>
          <svg viewBox="0 0 560 120" className={styles.chart} aria-hidden="true">
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(62% 0.21 288)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="oklch(62% 0.21 288)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,95 C50,90 80,78 130,74 C180,70 210,60 260,55 C310,50 340,42 390,36 C440,30 490,24 560,14 L560,120 L0,120 Z"
              fill="url(#fill)"
            />
            <path
              d="M0,95 C50,90 80,78 130,74 C180,70 210,60 260,55 C310,50 340,42 390,36 C440,30 490,24 560,14"
              fill="none"
              stroke="oklch(70% 0.18 288)"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className={styles.table}>
          {SOURCES.map((s) => (
            <div key={s.name} className={styles.row}>
              <span className={styles.rowName}>{s.name}</span>
              <span className={styles.rowBar}>
                <span
                  className={`${styles.rowFill} ${s.tone === 'bad' ? styles.fillBad : ''}`}
                  style={{ width: `${s.width}%` }}
                />
              </span>
              <span className={styles.rowStat}>{s.subs}</span>
              <span className={styles.rowStat}>{s.cps}</span>
              <span className={`${styles.rowStat} ${s.tone === 'bad' ? styles.bad : styles.good}`}>
                {s.churn}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
      <div className={styles.deviceGlow} aria-hidden="true" />
    </div>
  );
}
