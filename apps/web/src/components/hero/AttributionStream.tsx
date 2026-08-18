import type { CSSProperties } from 'react';
import styles from './attribution-stream.module.css';

/* sample data: traffic sources feeding the dashboard below */
const CHIPS = [
  { label: 'Telegram Ads', colorVar: '--src-tgads', x: 118 },
  { label: 'Meta Ads', colorVar: '--src-yandex', x: 300 },
  { label: 'Seeding @crypto_daily', colorVar: '--src-seeding', x: 486 },
] as const;

/** Paths in the 600x140 stage space, converging toward the mockup center. */
const PATHS = [
  'M 118 34 C 118 76, 300 82, 300 132',
  'M 300 34 C 300 76, 300 88, 300 132',
  'M 486 34 C 486 76, 300 82, 300 132',
] as const;

/** Varied sizes and speeds so the stream reads as organic flow, not a metronome. */
const PARTICLES = [
  { size: 5, duration: 3.0 },
  { size: 7, duration: 2.6 },
  { size: 4, duration: 3.4 },
  { size: 8, duration: 2.4 },
  { size: 6, duration: 3.2 },
  { size: 5, duration: 2.8 },
  { size: 7, duration: 3.6 },
  { size: 4, duration: 2.5 },
  { size: 6, duration: 3.0 },
] as const;

const PATH_STAGGER_S = 0.4;
const RAIL_PULSE_STAGGER_S = 0.9;
const CHIP_FLOAT_DURATIONS_S = [4.6, 5.4, 5.0] as const;
const RING_COUNT = 2;
const RING_PERIOD_S = 1.6;

/** Legend chips with comet-tail particle flows converging into the dashboard mockup below. */
export function AttributionStream() {
  return (
    <div className={styles.stream}>
      <div className={styles.stage}>
        <svg className={styles.paths} viewBox="0 0 600 140" aria-hidden="true">
          {/* base rails */}
          {PATHS.map((d) => (
            <path key={d} d={d} className={styles.path} />
          ))}
          {/* running data pulses on top of the rails */}
          {PATHS.map((d, pathIndex) => (
            <path
              key={`pulse-${d}`}
              d={d}
              className={styles.pulse}
              style={
                {
                  stroke: `var(${CHIPS[pathIndex].colorVar})`,
                  animationDelay: `${-pathIndex * RAIL_PULSE_STAGGER_S}s`,
                } as CSSProperties
              }
            />
          ))}
        </svg>

        {CHIPS.map((chip, chipIndex) => (
          <span
            key={chip.label}
            className={styles.chip}
            style={
              {
                left: chip.x,
                '--pc': `var(${chip.colorVar})`,
                animationDuration: `${CHIP_FLOAT_DURATIONS_S[chipIndex]}s`,
                animationDelay: `${-chipIndex * 1.7}s`,
              } as CSSProperties
            }
          >
            {/* semantic color dot: data-source legend, matches ticks and donut */}
            <span className={styles.chipDot} />
            {chip.label}
          </span>
        ))}

        {PATHS.map((d, pathIndex) =>
          PARTICLES.map((particle, i) => {
            const style = {
              offsetPath: `path("${d}")`,
              width: particle.size,
              height: particle.size,
              '--pc': `var(${CHIPS[pathIndex].colorVar})`,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${(-i * particle.duration) / PARTICLES.length - pathIndex * PATH_STAGGER_S}s`,
              '--rest': `${8 + i * 10}%`,
            } as CSSProperties;
            return (
              <span
                key={`${pathIndex}-${i}`}
                className={styles.particle}
                style={style}
                aria-hidden="true"
              />
            );
          }),
        )}

        {/* landing splashes at the convergence point */}
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <span
            key={`ring-${i}`}
            className={styles.ring}
            style={{ animationDelay: `${(i * RING_PERIOD_S) / RING_COUNT}s` }}
            aria-hidden="true"
          />
        ))}

        <span className={styles.receiverGlow} aria-hidden="true" />
        <span className={styles.receiver} aria-hidden="true" />
      </div>
    </div>
  );
}
