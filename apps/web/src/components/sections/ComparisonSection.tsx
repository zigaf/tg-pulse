'use client';

import { Check, Minus } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './comparison-section.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

const ROW_LABELS = [
  'Attribution accuracy',
  'Report format',
  'Data history',
  'Team and roles',
  'Sales and ROMI',
] as const;

type Column = {
  name: string;
  highlight?: boolean;
  cells: readonly (string | null)[];
};

const COLUMNS: readonly Column[] = [
  {
    name: 'Spreadsheets',
    cells: ['manual', 'a file', 'gets lost', null, null],
  },
  {
    name: 'Tracker bots',
    cells: ['degrades past 50 joins a day', 'an Excel file', '1 year', null, null],
  },
  {
    name: 'TGPulse',
    highlight: true,
    cells: [
      'invite links: exact at any volume',
      'live dashboard plus a client link',
      'unlimited',
      'workspaces, white-label',
      'webhooks, CRM integrations',
    ],
  },
];

export function ComparisonSection() {
  const reduce = useReducedMotion();

  return (
    <section className={styles.section} aria-labelledby="comparison-heading">
      <motion.h2
        id="comparison-heading"
        className={styles.heading}
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        Spreadsheet reports used to be the norm. Used to be.
      </motion.h2>

      <div className={styles.grid}>
        {COLUMNS.map((col, i) => (
          <motion.article
            key={col.name}
            className={col.highlight ? `${styles.col} ${styles.colHighlight}` : styles.col}
            initial={reduce ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
          >
            <h3 className={col.highlight ? `${styles.colName} ${styles.colNameHighlight}` : styles.colName}>
              {col.name}
            </h3>

            <dl className={styles.rows}>
              {col.cells.map((cell, r) => (
                <div key={ROW_LABELS[r]} className={styles.row}>
                  <dt className={styles.rowLabel}>{ROW_LABELS[r]}</dt>
                  <dd className={styles.rowValue}>
                    {cell === null ? (
                      <>
                        <Minus size={16} weight="bold" className={styles.minusIcon} aria-hidden="true" />
                        <span className={styles.visuallyHidden}>not included</span>
                      </>
                    ) : col.highlight ? (
                      <>
                        <Check size={16} weight="bold" className={styles.checkIcon} aria-hidden="true" />
                        <span>{cell}</span>
                      </>
                    ) : (
                      <span className={styles.mutedValue}>{cell}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.article>
        ))}
      </div>

      <motion.p
        className={styles.caption}
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
      >
        Respect to the category pioneers. We removed its limits.
      </motion.p>
    </section>
  );
}
