'use client';

import { Receipt } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import type { PaymentRecord } from '@/lib/api';
import { normalizePlan, planLabel } from '@/lib/billing';
import { formatFullDate, formatPaymentAmount } from '@/lib/format';
import { EmptyState } from '../shared/States';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import styles from './billing.module.css';

const TABLE_STYLE = { '--cols': '1fr 1fr 0.9fr', '--min-width': '420px' } as CSSProperties;

/** Every Stars charge the bot recorded for this workspace, newest first. */
export function PaymentsTable({ payments }: { payments: PaymentRecord[] }) {
  if (payments.length === 0) {
    return (
      <div className={ui.card}>
        <EmptyState icon={<Receipt size={26} weight="duotone" />} title="No payments yet">
          <p>Charges appear here right after the bot confirms a Stars payment.</p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={table.scroll}>
      <div className={table.table} style={TABLE_STYLE}>
        <div className={table.headRow}>
          <span>date</span>
          <span>plan</span>
          <span className={table.alignRight}>amount</span>
        </div>
        {payments.map((payment) => (
          <div key={payment.id} className={`${table.row} ${table.rowHover}`}>
            <span className={styles.paymentDate}>{formatFullDate(payment.createdAt)}</span>
            <span className={styles.paymentPlan}>{planLabel(normalizePlan(payment.plan))}</span>
            <span className={table.numStrong}>{formatPaymentAmount(payment.amount, payment.currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
