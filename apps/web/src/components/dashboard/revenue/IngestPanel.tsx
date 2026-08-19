'use client';

import { PaperPlaneTilt } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { CopyButton } from '../links/CopyButton';
import ui from '../shared/ui.module.css';
import styles from './revenue.module.css';

const INGEST_PATH = '/api/ingest/sales';
const MAX_EVENTS_PER_REQUEST = 500;

const FIELDS: { name: string; meta: string; description: string }[] = [
  {
    name: 'tgUserId',
    meta: 'number, one of two',
    description: 'Telegram user id of the buyer. Matches the subscriber that joined through a tracked link.',
  },
  {
    name: 'username',
    meta: 'string, one of two',
    description: 'Telegram username without @. Used when you do not store the numeric id.',
  },
  { name: 'amount', meta: 'number, required', description: 'Gross amount, never negative. Refunds use kind instead.' },
  { name: 'currency', meta: 'string, USD', description: 'Three-letter code. Reports aggregate one currency at a time.' },
  {
    name: 'kind',
    meta: 'enum, PURCHASE',
    description: 'LEAD, PURCHASE or REFUND. Refunds are subtracted from revenue.',
  },
  {
    name: 'externalId',
    meta: 'string, optional',
    description: 'Your order id. Sending it twice updates the same event instead of double counting.',
  },
  { name: 'occurredAt', meta: 'ISO date, now', description: 'When the payment happened, not when you sent it.' },
];

function buildSnippet(origin: string): string {
  return `curl -X POST ${origin}${INGEST_PATH} \\
  -H "Authorization: Bearer tgp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "events": [
      {
        "tgUserId": 641223510,
        "amount": 49.90,
        "currency": "USD",
        "kind": "PURCHASE",
        "externalId": "order_10241",
        "occurredAt": "2026-08-18T09:41:00Z"
      }
    ]
  }'`;
}

/** Webhook documentation: ready-to-run curl call plus the field contract. */
export function IngestPanel() {
  const [origin, setOrigin] = useState('');

  // window is unavailable during SSR, so resolve the real origin after mount.
  useEffect(() => setOrigin(window.location.origin), []);

  const snippet = buildSnippet(origin);

  return (
    <section className={`${ui.card} ${styles.panel}`} aria-labelledby="send-events-title">
      <header className={styles.panelHead}>
        <span className={styles.panelHeading}>
          <span className={styles.panelIcon} aria-hidden="true">
            <PaperPlaneTilt size={16} weight="duotone" />
          </span>
          <h2 id="send-events-title" className={styles.panelTitle}>
            Send events
          </h2>
        </span>
      </header>

      <p className={styles.panelHint}>
        Post sales from your payment provider, CRM or bot as they happen. Attribution is resolved once, at ingest
        time, so later changes never rewrite historical reports. Up to {MAX_EVENTS_PER_REQUEST} events per request.
      </p>

      <div className={styles.snippetBlock}>
        <code className={styles.snippetCode}>{snippet}</code>
        <CopyButton text={snippet} label="Copy request" />
      </div>

      <dl className={styles.fieldList}>
        {FIELDS.map((field) => (
          <div key={field.name} style={{ display: 'contents' }}>
            <dt className={styles.fieldName}>{field.name}</dt>
            <dd className={styles.fieldMeta}>{field.meta}</dd>
            <dd className={styles.fieldDesc}>{field.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
