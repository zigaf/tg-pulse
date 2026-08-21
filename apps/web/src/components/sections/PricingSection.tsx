'use client';

import { Check } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './pricing-section.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

type Tier = {
  name: string;
  price: string;
  period: string;
  features: readonly string[];
  cta: { label: string; href: string; external?: boolean };
  featured?: boolean;
  badge?: string;
};

// Keep in sync with docs/BILLING.md, the single source of truth for plans.
const TIERS: readonly Tier[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['1 channel', 'full attribution', 'landing pixel', 'daily bot report'],
    cta: { label: 'Start free', href: '/app' },
  },
  {
    name: 'Pro',
    price: '$0.20',
    period: 'monthly, 3 channels',
    badge: 'most popular',
    featured: true,
    features: [
      'everything in Free',
      'unlimited tracking links',
      'conversion postbacks',
      'revenue and ROMI module',
      'full fraud reports',
      '5 team members',
    ],
    cta: { label: 'Try Pro', href: '/app' },
  },
  {
    name: 'Agency',
    price: '$79',
    period: 'monthly, 25 channels',
    features: [
      'everything in Pro',
      '25 team members',
      'buyer comparison',
      'client-ready reports',
      'priority support',
    ],
    cta: { label: 'Get Agency', href: '/app' },
  },
];

export function PricingSection() {
  const reduce = useReducedMotion();

  return (
    <section className={styles.section} aria-labelledby="pricing-heading">
      <motion.h2
        id="pricing-heading"
        className={styles.heading}
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        Pays for itself with the first dead placement you pause
      </motion.h2>

      <div className={styles.grid}>
        {TIERS.map((tier, i) => (
          <motion.article
            key={tier.name}
            className={tier.featured ? `${styles.card} ${styles.cardFeatured}` : styles.card}
            initial={reduce ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
          >
            {tier.badge ? <span className={styles.badge}>{tier.badge}</span> : null}

            <h3 className={styles.tierName}>{tier.name}</h3>
            <p className={styles.price}>{tier.price}</p>
            <p className={styles.period}>{tier.period}</p>

            <ul className={styles.features}>
              {tier.features.map((f) => (
                <li key={f} className={styles.feature}>
                  <Check size={14} weight="bold" className={styles.checkIcon} aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <a
              href={tier.cta.href}
              className={tier.featured ? styles.ctaPrimary : styles.ctaGhost}
              {...(tier.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {tier.cta.label}
            </a>
          </motion.article>
        ))}
      </div>

      <motion.p
        className={styles.note}
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
      >
        One paused dead placement saves $50-150 of ad budget. Paid in Telegram Stars, inside the bot.
      </motion.p>
    </section>
  );
}
