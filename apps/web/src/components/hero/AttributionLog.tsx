import styles from './attribution-log.module.css';

/**
 * Live attribution log: a slow upward stream of join/click/postback events
 * filling the empty right side of the hero. src= tokens are tinted with the
 * categorical source palette, visually feeding the particle stream below.
 */

type LogRow = {
  time: string;
  event: string;
  src: string;
  tone: 'tgads' | 'meta' | 'seeding' | 'organic' | 'negative';
};

/* sample data */
const ROWS: LogRow[] = [
  { time: '14:02:11', event: 'join @daily_alpha', src: 'src=tgads creative=4', tone: 'tgads' },
  { time: '14:02:37', event: 'click t.me/+8fj2kQ', src: 'src=seed@crypto_daily', tone: 'seeding' },
  { time: '14:02:58', event: 'join @daily_alpha', src: 'src=meta lp=a', tone: 'meta' },
  { time: '14:03:02', event: 'leave @daily_alpha', src: 'src=seed@spam_gems ttl=2d', tone: 'negative' },
  { time: '14:03:19', event: 'postback subscribe', src: 'src=tgads creative=4', tone: 'tgads' },
  { time: '14:03:44', event: 'join @daily_alpha', src: 'src=organic', tone: 'organic' },
  { time: '14:04:05', event: 'click t.me/+q77zn', src: 'src=tgads creative=7', tone: 'tgads' },
  { time: '14:04:31', event: 'join @daily_alpha', src: 'src=seed@crypto_daily', tone: 'seeding' },
  { time: '14:04:56', event: 'postback subscribe', src: 'src=meta lp=a', tone: 'meta' },
  { time: '14:05:12', event: 'click t.me/+m30aa', src: 'src=meta lp=b', tone: 'meta' },
  { time: '14:05:40', event: 'join @daily_alpha', src: 'src=tgads creative=7', tone: 'tgads' },
  { time: '14:06:03', event: 'flag bot-pour', src: 'src=seed@spam_gems', tone: 'negative' },
  { time: '14:06:27', event: 'join @daily_alpha', src: 'src=seed@alpha_signals', tone: 'seeding' },
  { time: '14:06:52', event: 'postback subscribe', src: 'src=tgads creative=2', tone: 'tgads' },
];

function Column() {
  return (
    <ul className={styles.column}>
      {ROWS.map((row) => (
        <li key={`${row.time}-${row.event}`} className={styles.row}>
          <span className={styles.time}>{row.time}</span>
          <span className={styles.event}>{row.event}</span>
          <span className={`${styles.src} ${styles[row.tone]}`}>{row.src}</span>
        </li>
      ))}
    </ul>
  );
}

export function AttributionLog() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      {/* two copies for a seamless vertical loop */}
      <div className={styles.track}>
        <Column />
        <Column />
      </div>
    </div>
  );
}
