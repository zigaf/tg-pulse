'use client';

import { CursorClick, FileXls, Robot } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './pain-section.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

const PAINS = [
  {
    icon: FileXls,
    title: "The buyer's report is a 40-tab spreadsheet",
    body: '12 placements bought. Which three brought 80% of subscribers? Nobody knows.',
    cell: 'cellA',
  },
  {
    icon: Robot,
    title: '+300 subscribers overnight',
    body: "Real people, or bots poured in before the contractor's report?",
    cell: 'cellB',
  },
  {
    icon: CursorClick,
    title: 'Ads eat budget per click',
    body: 'Clicks exist. Subscribers exist somewhere. Nothing connects the two.',
    cell: 'cellC',
  },
] as const;

export function PainSection() {
  const reduce = useReducedMotion();

  return (
    <section className={styles.section} aria-labelledby="pain-heading">
      <motion.h2
        id="pain-heading"
        className={styles.heading}
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        Sound familiar?
      </motion.h2>

      <div className={styles.grid}>
        {PAINS.map(({ icon: Icon, title, body, cell }, i) => (
          <motion.article
            key={title}
            className={`${styles.card} ${styles[cell]}`}
            initial={reduce ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, delay: i * 0.12, ease: EASE }}
          >
            <Icon size={30} weight="duotone" className={styles.icon} aria-hidden="true" />
            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardBody}>{body}</p>
          </motion.article>
        ))}
      </div>

      <motion.p
        className={styles.bridge}
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
      >
        TGPulse closes all three. With one admin bot in your channel.
      </motion.p>
    </section>
  );
}
