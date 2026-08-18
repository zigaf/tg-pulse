'use client';

import { Plus } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './faq-section.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

const FAQS = [
  {
    q: 'Does the bot read my messages?',
    a: 'No. Channels have no chat, and the bot needs a single permission: invite via link. Revoke it anytime.',
  },
  {
    q: 'How is this different from tracker bots?',
    a: 'Accuracy does not degrade with volume: attribution is built on Telegram invite links, not time matching. Plus a live dashboard instead of spreadsheets, unlimited history and team access.',
  },
  {
    q: 'What if a subscriber joins without my link?',
    a: 'They land in a separate organic row. You see its share and dynamics.',
  },
  {
    q: 'Does it work with seeding, Telegram Ads and Meta?',
    a: 'Yes. A tracking link goes anywhere: a seeding creative, a landing page, an ad.',
  },
  {
    q: 'What happens to subscriber data?',
    a: 'We store the minimum: ID, join date and source. Lists are never sold or shared.',
  },
  {
    q: 'Can I leave?',
    a: 'Yes. One-click CSV export, and the bot is removed with one button.',
  },
] as const;

/* Static, build-time structured data. No user input involved. */
const FAQ_JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

export function FaqSection() {
  const reduce = useReducedMotion();

  return (
    <section className={styles.section} aria-labelledby="faq-heading">
      <script type="application/ld+json">{FAQ_JSON_LD}</script>

      <motion.h2
        id="faq-heading"
        className={styles.heading}
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        Questions people ask before connecting
      </motion.h2>

      <motion.div
        className={styles.list}
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
      >
        {FAQS.map((f) => (
          <details key={f.q} className={styles.item}>
            <summary className={styles.summary}>
              <span className={styles.question}>{f.q}</span>
              <Plus size={18} weight="bold" className={styles.icon} aria-hidden="true" />
            </summary>
            <p className={styles.answer}>{f.a}</p>
          </details>
        ))}
      </motion.div>
    </section>
  );
}
