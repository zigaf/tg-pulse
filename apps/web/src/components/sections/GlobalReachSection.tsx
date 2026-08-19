import { ArrowsLeftRight, Circle, CircleDashed, Prohibit } from '@phosphor-icons/react/ssr';

import { Reveal } from '@/components/ui/Reveal';
import { ReachAmbient, ReachMap, ReachSprite, ReachStrands } from './ReachDiagram';
import { ReachStage } from './ReachStage';
import { LEGEND, MARKETS, PLATFORMS } from './reach-data';
import { AMBIENT } from './reach-geometry';
import styles from './global-reach.module.css';
import flowStyles from './global-reach-flow.module.css';
import panelStyles from './global-reach-panel.module.css';

const LEGEND_ICONS = {
  live: Circle,
  building: CircleDashed,
  postback: ArrowsLeftRight,
  none: Prohibit,
};

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

export function GlobalReachSection() {
  return (
    <section className={styles.section} aria-labelledby="reach-heading">
      <ReachSprite />
      <ReachAmbient {...AMBIENT} />

      <Reveal>
        <h2 id="reach-heading" className={styles.heading}>
          Every market Telegram reached, every platform you buy
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className={styles.sub}>
          Attribution works the same in Jakarta and Berlin. Conversions go back to the ad account
          that paid.
        </p>
      </Reveal>

      <ReachStage className={styles.stage}>
        <h3 className={`${styles.colTitle} ${styles.mapTitle}`}>Where buyers spend</h3>

        <div className={styles.mapCol}>
          <ReachMap />
        </div>

        {/* Visible on phones, where the map becomes atmosphere behind the heading.
            Above that breakpoint it is the screen reader copy of the map. */}
        <ul className={panelStyles.marketList}>
          {MARKETS.map((m) => (
            <li key={m.name} className={panelStyles.marketItem}>
              <span className={panelStyles.marketDot} aria-hidden="true" />
              <span className={panelStyles.marketName}>{m.name}</span>
              <span className={panelStyles.marketBuys}>{m.buys}</span>
            </li>
          ))}
        </ul>

        <h3 className={`${styles.colTitle} ${styles.panelTitle}`}>Where we send conversions</h3>

        <div className={styles.linkCol}>
          <div className={styles.strandsWrap}>
            <ReachStrands />
            <span className={flowStyles.spine} aria-hidden="true" />
          </div>

          <ul className={panelStyles.panel}>
            {PLATFORMS.map((p, i) => (
              <li
                key={p.id}
                className={panelStyles.row}
                data-i={i}
                data-kind={p.kind}
                style={{ '--i': i } as Vars}
              >
                <span className={panelStyles.rail} aria-hidden="true" />
                <span className={panelStyles.rowHead}>
                  <span className={panelStyles.rowName}>{p.name}</span>
                  <span className={panelStyles.rowStatus}>{p.status}</span>
                </span>
                <span className={panelStyles.rowNote}>{p.note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.stageFoot}>
          <ul className={panelStyles.legend}>
            {LEGEND.map(({ key, label }) => {
              const Icon = LEGEND_ICONS[key];
              return (
                <li key={key} data-kind={key}>
                  <Icon size={10} weight="fill" aria-hidden="true" />
                  {label}
                </li>
              );
            })}
          </ul>
          <p className={panelStyles.promise}>
            We never promise a postback the platform does not offer.
          </p>
        </div>
      </ReachStage>
    </section>
  );
}
