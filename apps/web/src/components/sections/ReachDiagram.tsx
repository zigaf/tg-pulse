/**
 * SVG parts of the Global reach diagram.
 *
 * All of it is server rendered: the path strings are built once from reach-geometry
 * and the motion lives entirely in CSS, so the map ships no client JavaScript.
 * Section shell, panel and copy are in GlobalReachSection.tsx.
 */

import { MARKETS, PLATFORMS, isHotCell, tagBox } from './reach-data';
import {
  DOT_DASH,
  HUB_STACK,
  HUB_WIDE,
  MAP,
  STRAND,
  arcPath,
  dotsPath,
  strandPath,
  strandRowY,
} from './reach-geometry';
import mapStyles from './global-reach-map.module.css';
import flowStyles from './global-reach-flow.module.css';

/** Built once on the server; never shipped as JavaScript. */
const DOTS = dotsPath();
const HOT_DOTS = dotsPath(isHotCell);

/** Deliberately out of step so inbound pulses never march in formation. */
const PULSE_PERIODS = ['6s', '6.4s', '6.8s', '7.4s'];

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/**
 * The land path and the glow filter, defined once and referenced by both the stage
 * map and the phone atmosphere layer, so the payload is not paid for twice.
 */
export function ReachSprite() {
  return (
    <svg className={mapStyles.sprite} aria-hidden="true" focusable="false">
      <defs>
        <path id="reachDots" d={DOTS} />
        <path id="reachHotDots" d={HOT_DOTS} />
        <filter id="reachGlow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
    </svg>
  );
}

/** Phone only: the same field scaled down behind the heading. */
export function ReachAmbient({
  width,
  height,
  transform,
}: {
  width: number;
  height: number;
  transform: string;
}) {
  return (
    <svg
      className={mapStyles.ambient}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <g className={mapStyles.ambientField} strokeDasharray={DOT_DASH}>
        <use href="#reachDots" transform={transform} />
      </g>
    </svg>
  );
}

function ArcField({ hub, className }: { hub: { x: number; y: number }; className: string }) {
  const paths = MARKETS.map((m) => arcPath(m.x, m.y, hub));

  return (
    <g className={className} aria-hidden="true">
      {/* Every casing is laid down first so no arc cuts a hole in its neighbour. */}
      {paths.map((d, i) => (
        <path key={`base-${i}`} className={flowStyles.arcBase} d={d} />
      ))}
      {paths.map((d, i) => (
        <path
          key={`arc-${i}`}
          className={flowStyles.arc}
          d={d}
          pathLength={1}
          style={{ '--i': i } as Vars}
        />
      ))}
      {paths.map((d, i) => (
        <path
          key={`pulse-${i}`}
          className={flowStyles.arcPulse}
          d={d}
          pathLength={1}
          style={{ '--i': i, '--dur': PULSE_PERIODS[i % PULSE_PERIODS.length]! } as Vars}
        />
      ))}
      <g>
        <circle className={flowStyles.hubRing} cx={hub.x} cy={hub.y} r={10} />
        <circle
          className={`${flowStyles.hubRing} ${flowStyles.hubRingLate}`}
          cx={hub.x}
          cy={hub.y}
          r={10}
        />
        <circle
          className={flowStyles.hubGlow}
          cx={hub.x}
          cy={hub.y}
          r={4}
          filter="url(#reachGlow)"
        />
        <circle className={flowStyles.hubCore} cx={hub.x} cy={hub.y} r={4} />
        <text className={flowStyles.hubLabel} x={hub.x} y={hub.y + 21} textAnchor="middle">
          TGPulse
        </text>
      </g>
    </g>
  );
}

function Markers() {
  return (
    <g>
      {MARKETS.map((m, i) => {
        const r = m.tier === 'A' ? 3.6 : 2.7;
        const tag = tagBox(m);

        return (
          <g
            key={m.name}
            className={mapStyles.marker}
            role="img"
            aria-label={`${m.name}. Buys ${m.buys}.`}
            tabIndex={0}
          >
            {m.tier === 'A' && (
              <circle
                className={mapStyles.markerPulse}
                cx={m.x}
                cy={m.y}
                r={r}
                style={{ '--d': `${i * 1.6}s` } as Vars}
              />
            )}
            <circle
              className={mapStyles.markerGlow}
              cx={m.x}
              cy={m.y}
              r={r}
              filter="url(#reachGlow)"
            />
            <circle className={mapStyles.markerDot} cx={m.x} cy={m.y} r={r} />
            {m.satellites?.map((s) => (
              <circle
                key={`${s.x}-${s.y}`}
                className={mapStyles.markerDot}
                cx={s.x}
                cy={s.y}
                r={r}
              />
            ))}
            <text
              className={mapStyles.markerLabel}
              x={m.x + m.dx}
              y={m.y + m.dy}
              textAnchor={m.anchor}
            >
              {m.name}
            </text>
            <g className={mapStyles.tag} aria-hidden="true">
              <rect x={tag.x} y={tag.y} width={tag.w} height={tag.h} rx={4} />
              <text x={tag.textX} y={tag.textY} dominantBaseline="central">
                {m.buys}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

/**
 * Two stacked layers: the masked dot field, and the arcs, hub and markers above it.
 * Both hub positions are rendered and swapped by media query, so the tablet reflow
 * needs no JavaScript.
 */
export function ReachMap() {
  return (
    <>
      <svg
        className={mapStyles.dotLayer}
        viewBox={`0 0 ${MAP.width} ${MAP.height}`}
        aria-hidden="true"
        focusable="false"
      >
        <g className={mapStyles.field}>
          <g className={mapStyles.dots} strokeDasharray={DOT_DASH}>
            <use href="#reachDots" />
          </g>
          <g className={mapStyles.hotDots} strokeDasharray={DOT_DASH}>
            <use href="#reachHotDots" />
          </g>
        </g>
      </svg>

      <svg
        className={mapStyles.map}
        viewBox={`0 0 ${MAP.width} ${MAP.height}`}
        role="group"
        aria-label="Markets where Telegram advertising demand is concentrated"
      >
        <ArcField hub={HUB_WIDE} className={flowStyles.wide} />
        <ArcField hub={HUB_STACK} className={flowStyles.stacked} />
        <Markers />
      </svg>
    </>
  );
}

/** Outbound fan. Platforms with no conversion API get a stub instead of a line. */
export function ReachStrands() {
  return (
    <svg
      className={flowStyles.strands}
      viewBox={`0 0 ${STRAND.width} ${STRAND.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {PLATFORMS.map((p, i) =>
        p.hasStrand ? (
          <g key={p.id} className={flowStyles.strandGroup} data-strand={i}>
            <path
              className={`${flowStyles.strand} ${flowStyles[p.kind]}`}
              d={strandPath(i)}
              /* A normalised pathLength would rescale the dashed "building" pattern
                 into one solid dash, so only the drawn lines get it. */
              pathLength={p.kind === 'building' ? undefined : 1}
              style={{ '--i': i } as Vars}
            />
            {p.kind !== 'building' && (
              <path
                className={flowStyles.strandPulse}
                d={strandPath(i)}
                pathLength={1}
                style={{ '--i': i } as Vars}
              />
            )}
          </g>
        ) : (
          <line
            key={p.id}
            className={flowStyles.stub}
            x1={STRAND.width - 8}
            x2={STRAND.width}
            y1={strandRowY(i)}
            y2={strandRowY(i)}
          />
        ),
      )}
    </svg>
  );
}
