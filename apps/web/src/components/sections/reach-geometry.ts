/**
 * Pure geometry for the Global reach diagram: the dot field, the inbound arcs and
 * the outbound strands.
 *
 * Everything here runs on the server, so the map costs zero client JavaScript.
 * The markets and platforms it is applied to live in reach-data.ts.
 */

import { LAND, MASK_COLS, MASK_ROWS } from './world-mask';

/** Dot field. Must match the grid contract in scripts/build-world-mask.mjs. */
export const MAP = {
  width: 780,
  height: 440,
  pitch: 5.95,
  x0: 4,
  y0: 46,
} as const;

/**
 * Mobile atmosphere layer. The same field at pitch 2.65, reached through a <use>
 * reference so the dot path ships in the HTML exactly once.
 * scale = 2.65 / 5.95; the translation re-lands the scaled origin on (0.8, 2).
 */
export const AMBIENT = {
  width: 340,
  height: 120,
  transform: 'translate(-0.98 -18.49) scale(0.445378)',
} as const;

/** Hub sits on the seam between the map column and the gutter. */
export const HUB_WIDE = { x: 768, y: 220 } as const;
/** Tablet: the panel drops below the map, so the hub moves to the bottom edge. */
export const HUB_STACK = { x: 390, y: 428 } as const;

export const STRAND = { width: 60, height: 448, top: 44, rowH: 56 } as const;

/** Shortest decimal that still lands the dot on the grid. */
function fmt(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/** Length of the hairline stub a round linecap turns into a dot. */
const DOT_LEN = 0.01;

/**
 * Dash pattern that turns a horizontal run into evenly spaced dots.
 * SVG restarts the dash pattern at every subpath, so each run stays on the grid.
 */
export const DOT_DASH = `${DOT_LEN} ${MAP.pitch - DOT_LEN}`;

export type CellFilter = (col: number, row: number) => boolean;

/**
 * One <path> for the whole field. Each horizontal run of land collapses into a
 * single dashed segment, so a 2300 dot map costs ~200 subpaths instead of 2300
 * elements, and roughly a tenth of the markup of one move command per dot.
 */
export function dotsPath(filter?: CellFilter): string {
  let d = '';

  for (let row = 0; row < MASK_ROWS; row += 1) {
    const cells = LAND[row]!;
    const y = fmt(MAP.y0 + row * MAP.pitch);
    let start = -1;

    for (let col = 0; col <= MASK_COLS; col += 1) {
      const isLand = col < MASK_COLS && cells[col] === 1 && (!filter || filter(col, row));

      if (isLand) {
        if (start < 0) start = col;
        continue;
      }
      if (start < 0) continue;

      const length = (col - 1 - start) * MAP.pitch + DOT_LEN;
      d += `M${fmt(MAP.x0 + start * MAP.pitch)} ${y}h${fmt(length)}`;
      start = -1;
    }
  }

  return d;
}

/** Marker pixel coordinates back to grid indices, for the hot-cell halo. */
export function toCell(x: number, y: number) {
  return {
    col: Math.round((x - MAP.x0) / MAP.pitch),
    row: Math.round((y - MAP.y0) / MAP.pitch),
  };
}

/** Inbound arc: leaves the marker flat, then swings into the hub from the left. */
export function arcPath(mx: number, my: number, hub: { x: number; y: number }): string {
  const c1x = mx + (hub.x - mx) * 0.45;
  const c2x = hub.x - 120;
  const c2y = hub.y + (my - hub.y) * 0.35;
  return `M${mx} ${my} C${fmt(c1x)} ${my}, ${c2x} ${fmt(c2y)}, ${hub.x} ${hub.y}`;
}

/** Vertical centre of panel row i, in the gutter SVG coordinate space. */
export function strandRowY(index: number): number {
  return STRAND.top + index * STRAND.rowH + STRAND.rowH / 2;
}

/** Outbound strand: hub to the left edge of one panel row. */
export function strandPath(index: number): string {
  const y = strandRowY(index);
  return `M0 224 C24 224, 36 ${y}, ${STRAND.width} ${y}`;
}
