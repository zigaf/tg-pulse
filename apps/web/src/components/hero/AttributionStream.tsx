import type { CSSProperties } from 'react';
import styles from './attribution-stream.module.css';

type ChipSpec = { label: string; colorVar: string; x: number };
type ParticleSpec = { size: number; duration: number };

type StageSpec = {
  stageClass: string;
  viewBox: string;
  chips: readonly ChipSpec[];
  paths: readonly string[];
  particles: readonly ParticleSpec[];
  ringCenter: { x: number; y: number };
};

const PATH_STAGGER_S = 0.4;
const RAIL_PULSE_STAGGER_S = 0.9;
const CHIP_FLOAT_DURATIONS_S = [4.6, 5.4, 5.0] as const;
const RING_COUNT = 2;
const RING_PERIOD_S = 1.6;
const RING_SIZE = 22;

/** Varied sizes and speeds so the stream reads as organic flow, not a metronome. */
const DESKTOP_PARTICLES: readonly ParticleSpec[] = [
  { size: 5, duration: 3.0 },
  { size: 7, duration: 2.6 },
  { size: 4, duration: 3.4 },
  { size: 8, duration: 2.4 },
  { size: 6, duration: 3.2 },
  { size: 5, duration: 2.8 },
  { size: 7, duration: 3.6 },
  { size: 4, duration: 2.5 },
  { size: 6, duration: 3.0 },
];

const MOBILE_PARTICLES: readonly ParticleSpec[] = [
  { size: 5, duration: 3.0 },
  { size: 7, duration: 2.6 },
  { size: 4, duration: 3.4 },
  { size: 6, duration: 2.4 },
  { size: 5, duration: 3.2 },
  { size: 7, duration: 2.8 },
  { size: 4, duration: 2.5 },
];

/* sample data: traffic sources feeding the dashboard below */
const DESKTOP_STAGE: StageSpec = {
  stageClass: styles.stage,
  viewBox: '0 0 600 140',
  chips: [
    { label: 'Telegram Ads', colorVar: '--src-tgads', x: 118 },
    { label: 'Meta Ads', colorVar: '--src-yandex', x: 300 },
    { label: 'Seeding @crypto_daily', colorVar: '--src-seeding', x: 486 },
  ],
  paths: [
    'M 118 34 C 118 76, 300 82, 300 132',
    'M 300 34 C 300 76, 300 88, 300 132',
    'M 486 34 C 486 76, 300 82, 300 132',
  ],
  particles: DESKTOP_PARTICLES,
  ringCenter: { x: 300, y: 132 },
};

/** Native mobile stage: shorter labels, narrow paths, full-size particles. */
const MOBILE_STAGE: StageSpec = {
  stageClass: styles.stageMobile,
  viewBox: '0 0 300 120',
  chips: [
    { label: 'TG Ads', colorVar: '--src-tgads', x: 55 },
    { label: 'Meta', colorVar: '--src-yandex', x: 150 },
    { label: 'Seeding', colorVar: '--src-seeding', x: 245 },
  ],
  paths: [
    'M 55 30 C 55 62, 150 70, 150 112',
    'M 150 30 C 150 62, 150 76, 150 112',
    'M 245 30 C 245 62, 150 70, 150 112',
  ],
  particles: MOBILE_PARTICLES,
  ringCenter: { x: 150, y: 112 },
};

function Stage({ spec }: { spec: StageSpec }) {
  const { chips, paths, particles, ringCenter } = spec;
  return (
    <div className={spec.stageClass}>
      <svg className={styles.paths} viewBox={spec.viewBox} aria-hidden="true">
        {/* base rails */}
        {paths.map((d) => (
          <path key={d} d={d} className={styles.path} />
        ))}
        {/* running data pulses on top of the rails */}
        {paths.map((d, pathIndex) => (
          <path
            key={`pulse-${d}`}
            d={d}
            className={styles.pulse}
            style={
              {
                stroke: `var(${chips[pathIndex].colorVar})`,
                animationDelay: `${-pathIndex * RAIL_PULSE_STAGGER_S}s`,
              } as CSSProperties
            }
          />
        ))}
      </svg>

      {chips.map((chip, chipIndex) => (
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

      {paths.map((d, pathIndex) =>
        particles.map((particle, i) => {
          const style = {
            offsetPath: `path("${d}")`,
            width: particle.size,
            height: particle.size,
            '--pc': `var(${chips[pathIndex].colorVar})`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${(-i * particle.duration) / particles.length - pathIndex * PATH_STAGGER_S}s`,
            '--rest': `${8 + i * (80 / particles.length)}%`,
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
          style={{
            left: ringCenter.x - RING_SIZE / 2,
            top: ringCenter.y - RING_SIZE / 2,
            animationDelay: `${(i * RING_PERIOD_S) / RING_COUNT}s`,
          }}
          aria-hidden="true"
        />
      ))}

      <span className={styles.receiverGlow} aria-hidden="true" />
      <span className={styles.receiver} aria-hidden="true" />
    </div>
  );
}

/** Legend chips with comet-tail particle flows converging into the dashboard mockup below. */
export function AttributionStream() {
  return (
    <div className={styles.stream}>
      <Stage spec={DESKTOP_STAGE} />
      <Stage spec={MOBILE_STAGE} />
    </div>
  );
}
