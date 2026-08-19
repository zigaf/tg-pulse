'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RevenuePoint } from '@/lib/api';
import { formatCompactMoney, formatMoney, formatShortDate } from '@/lib/format';
import styles from './revenue.module.css';

interface TooltipEntry {
  value?: number | string;
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  currency: string;
}) {
  const entry = payload?.[0];
  if (!active || !entry) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{label ? formatShortDate(label) : ''}</p>
      <p className={styles.tooltipRow}>
        <span className={styles.tooltipDot} />
        <span className={styles.tooltipValue}>{formatMoney(Number(entry.value ?? 0), currency)}</span>
      </p>
    </div>
  );
}

/** Daily revenue area chart; same construction as the overview trend chart. */
export function RevenueChart({ series, currency }: { series: RevenuePoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <defs>
          <linearGradient id="tgpRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.38} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="oklch(45% 0.04 290 / 0.12)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fill: 'oklch(60% 0.02 290)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'oklch(45% 0.04 290 / 0.2)' }}
          minTickGap={26}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompactMoney(value, currency)}
          tick={{ fill: 'oklch(60% 0.02 290)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={62}
        />
        <Tooltip
          content={<ChartTooltip currency={currency} />}
          cursor={{ stroke: 'oklch(60% 0.05 290 / 0.3)' }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-accent-bright)"
          strokeWidth={2}
          fill="url(#tgpRevenueFill)"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
