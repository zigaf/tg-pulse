/**
 * One-off generator for src/components/sections/world-mask.ts.
 *
 * Rasterises Natural Earth land polygons into a 128 x 44 equirectangular bitmask
 * so the landing map ships as ~1.5 kB of hex instead of a geo library plus TopoJSON.
 * Nothing here runs at build or request time: run it by hand when the grid changes.
 *
 *   node scripts/build-world-mask.mjs
 *
 * world-atlas, topojson-client and d3-geo are devDependencies for exactly this reason
 * and must never be imported from src/.
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** Grid contract. Mirrored by MAP in reach-data.ts; changing one means changing both. */
const COLS = 128;
const ROWS = 44;
const LON_MIN = -180;
const LON_SPAN = 360;
const LAT_MAX = 72;
const LAT_SPAN = 128;

const LON_STEP = LON_SPAN / COLS;
const LAT_STEP = LAT_SPAN / ROWS;

/** Sub-samples per cell axis. 1 drops thin coasts, 3 keeps Italy and Japan readable. */
const SUB = 3;

const OUT_FILE = resolve(here, '../src/components/sections/world-mask.ts');

function loadLand() {
  const topology = require('world-atlas/land-50m.json');
  return feature(topology, topology.objects.land);
}

/** Cells are centred on their dot, so the sample window is +/- half a step. */
function sampleCell(land, col, row) {
  const lon = LON_MIN + col * LON_STEP;
  const lat = LAT_MAX - row * LAT_STEP;

  for (let sy = 0; sy < SUB; sy += 1) {
    for (let sx = 0; sx < SUB; sx += 1) {
      const ox = (sx / (SUB - 1) - 0.5) * LON_STEP;
      const oy = (sy / (SUB - 1) - 0.5) * LAT_STEP;
      if (geoContains(land, [lon + ox, lat - oy])) return true;
    }
  }
  return false;
}

function buildRows(land) {
  const rows = [];

  for (let row = 0; row < ROWS; row += 1) {
    let hex = '';
    for (let col = 0; col < COLS; col += 4) {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit += 1) {
        if (sampleCell(land, col + bit, row)) nibble |= 1 << (3 - bit);
      }
      hex += nibble.toString(16);
    }
    rows.push(hex);
  }

  return rows;
}

function preview(rows) {
  return rows
    .map((hex) =>
      [...hex]
        .flatMap((char) => {
          const nibble = parseInt(char, 16);
          return [3, 2, 1, 0].map((bit) => ((nibble >> bit) & 1 ? '#' : '.'));
        })
        .join(''),
    )
    .join('\n');
}

function render(rows) {
  const literals = rows.map((hex) => `  '${hex}',`).join('\n');

  return `/**
 * GENERATED FILE. Do not edit by hand.
 * Run \`node scripts/build-world-mask.mjs\` from apps/web to rebuild.
 *
 * Land coverage of a ${COLS} x ${ROWS} equirectangular grid spanning
 * lon ${LON_MIN}..${LON_MIN + LON_SPAN} and lat ${LAT_MAX}..${LAT_MAX - LAT_SPAN},
 * source: Natural Earth 1:50m land via world-atlas.
 *
 * One string per row, one hex character per four columns, most significant bit leftmost.
 */

export const MASK_COLS = ${COLS};
export const MASK_ROWS = ${ROWS};

export const WORLD_MASK_HEX: readonly string[] = [
${literals}
];

function decode(rows: readonly string[]): readonly Uint8Array[] {
  return rows.map((hex) => {
    const cells = new Uint8Array(MASK_COLS);
    for (let i = 0; i < hex.length; i += 1) {
      const nibble = parseInt(hex[i]!, 16);
      for (let bit = 0; bit < 4; bit += 1) {
        cells[i * 4 + bit] = (nibble >> (3 - bit)) & 1;
      }
    }
    return cells;
  });
}

/** LAND[row][col] is 1 for land. Decoded once at module load, on the server. */
export const LAND: readonly Uint8Array[] = decode(WORLD_MASK_HEX);
`;
}

const land = loadLand();
const rows = buildRows(land);

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, render(rows), 'utf8');

const filled = rows.reduce(
  (total, hex) => total + [...hex].reduce((sum, ch) => sum + (parseInt(ch, 16).toString(2).match(/1/g)?.length ?? 0), 0),
  0,
);

process.stdout.write(`${preview(rows)}\n\n`);
process.stdout.write(`${filled} land cells of ${COLS * ROWS} written to ${OUT_FILE}\n`);
