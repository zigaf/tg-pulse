'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OverviewPoint } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import styles from './overview.module.css';

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{label ? formatShortDate(label) : ''}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className={styles.tooltipRow}>
          <span
            className={styles.tooltipDot}
            style={{
              background: entry.dataKey === 'joins' ? 'var(--color-accent-bright)' : 'var(--color-negative)',
            }}
          />
          <span className={styles.tooltipKey}>{entry.dataKey === 'joins' ? 'joins' : 'leaves'}</span>
          <span className={styles.tooltipValue}>{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Joins vs leaves area chart over the selected period. */
export function TrendChart({ series }: { series: OverviewPoint[] }) {
  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={series} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="tgpJoinsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="tgpLeavesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-negative)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-negative)" stopOpacity={0.02} />
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
            tick={{ fill: 'oklch(60% 0.02 290)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={44}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'oklch(60% 0.05 290 / 0.3)' }} />
          <Area
            type="monotone"
            dataKey="joins"
            stroke="var(--color-accent-bright)"
            strokeWidth={2}
            fill="url(#tgpJoinsFill)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="leaves"
            stroke="var(--color-negative)"
            strokeWidth={1.5}
            fill="url(#tgpLeavesFill)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={styles.tooltipDot} style={{ background: 'var(--color-accent-bright)' }} />
          joins
        </span>
        <span className={styles.legendItem}>
          <span className={styles.tooltipDot} style={{ background: 'var(--color-negative)' }} />
          leaves
        </span>
      </div>
    </div>
  );
}
