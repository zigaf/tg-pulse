import styles from './chart.module.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Event marker x-position inside the 560-unit viewBox. */
const EVENT_X = 305;
const EVENT_LEFT_PCT = `${((EVENT_X / 560) * 100).toFixed(1)}%`;

/** Two-line growth chart: subscriptions (accent) vs unsubscribes (dashed red). */
export function DashboardChart() {
  return (
    <div className={styles.chartBlock}>
      <div className={styles.canvas}>
        <svg viewBox="0 0 560 120" className={styles.chart} aria-hidden="true">
          <defs>
            <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(62% 0.21 288)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="oklch(62% 0.21 288)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d="M0,95 C50,90 80,78 130,74 C180,70 210,60 260,55 C310,50 340,42 390,36 C440,30 490,24 560,14 L560,120 L0,120 Z"
            fill="url(#chart-area-fill)"
          />

          {/* event marker: source #7 paused */}
          <line x1={EVENT_X} y1="10" x2={EVENT_X} y2="114" className={styles.eventLine} />

          {/* unsubscribes */}
          <path
            d="M0,104 C50,103 90,101 140,102 C190,103 230,96 280,92 C300,90 320,99 360,104 C420,108 490,109 560,110"
            className={styles.churnLine}
          />

          {/* subscriptions */}
          <path
            d="M0,95 C50,90 80,78 130,74 C180,70 210,60 260,55 C310,50 340,42 390,36 C440,30 490,24 560,14"
            className={styles.subsLine}
          />

          {/* live tip of the subscriptions line */}
          <circle cx="560" cy="14" r="3.5" className={styles.dotCore} />
          <circle cx="560" cy="14" r="3.5" className={styles.dotPulse} />
        </svg>

        <span className={styles.eventFlag} style={{ left: EVENT_LEFT_PCT }}>
          paused #7
        </span>
      </div>

      <div className={styles.axis} aria-hidden="true">
        {DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
    </div>
  );
}
