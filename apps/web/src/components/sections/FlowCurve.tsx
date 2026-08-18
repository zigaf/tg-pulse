'use client';

import { motion } from 'framer-motion';
import styles from './flow-curve.module.css';

const CURVE = 'M 80,40 C 260,60 300,190 250,310 C 210,410 300,520 520,560';

const NODES = [
  {
    x: 80,
    y: 40,
    step: 'Connect',
    title: 'Add the bot as channel admin',
    points: ['Needs one permission: invite via link', 'Takes about a minute'],
    side: 'right',
  },
  {
    x: 262,
    y: 210,
    step: 'Tag',
    title: 'A link for every creative',
    points: ['UTM, placement tag, landing post', 'Bulk generation for Telegram Ads'],
    side: 'right',
  },
  {
    x: 255,
    y: 400,
    step: 'Attribute',
    title: 'Subscribers tag themselves',
    points: ['Deterministic, not a 95% guess', 'Unsubscribes tied to the source'],
    side: 'right',
  },
  {
    x: 520,
    y: 560,
    step: 'Result',
    title: 'Budget flows to what works',
    points: ['CPS drops 1.5-2x', 'Conversions post back to ad platforms'],
    side: 'left',
  },
] as const;

export function FlowCurve() {
  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 640 620" className={styles.svg} aria-hidden="true">
        <defs>
          <linearGradient id="curve" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="oklch(74% 0.16 288)" />
            <stop offset="60%" stopColor="oklch(62% 0.21 288)" />
            <stop offset="100%" stopColor="oklch(96% 0.005 290)" />
          </linearGradient>
        </defs>
        <motion.path
          d={CURVE}
          fill="none"
          stroke="url(#curve)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={styles.glowPath}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
        />
        {NODES.map((n, i) => (
          <motion.circle
            key={n.step}
            cx={n.x}
            cy={n.y}
            r="5"
            className={styles.node}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 + i * 0.35, duration: 0.4 }}
          />
        ))}
      </svg>

      {NODES.map((n, i) => (
        <motion.article
          key={n.step}
          className={styles.card}
          style={{
            top: `${(n.y / 620) * 100}%`,
            ...(n.side === 'right'
              ? { left: `${(n.x / 640) * 100 + 4}%` }
              : { right: `${100 - (n.x / 640) * 100 + 4}%` }),
          }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay: 0.5 + i * 0.35, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className={styles.cardStep}>{n.step}</p>
          <h3 className={styles.cardTitle}>{n.title}</h3>
          <ul className={styles.cardList}>
            {n.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </motion.article>
      ))}
    </div>
  );
}
