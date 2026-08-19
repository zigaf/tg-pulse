/**
 * GENERATED FILE. Do not edit by hand.
 * Run `node scripts/build-world-mask.mjs` from apps/web to rebuild.
 *
 * Land coverage of a 128 x 44 equirectangular grid spanning
 * lon -180..180 and lat 72..-56,
 * source: Natural Earth 1:50m land via world-atlas.
 *
 * One string per row, one hex character per four columns, most significant bit leftmost.
 */

export const MASK_COLS = 128;
export const MASK_ROWS = 44;

export const WORLD_MASK_HEX: readonly string[] = [
  '01e03fffff8fff8000f038ffffffffc0',
  'e3ffffffffc7ff0007ffffffffffffff',
  'f7ffffffffe7f8f00fffffffffffffff',
  'bfffffffffc7e0f03fffffffffffffff',
  '07ffffff1f63c0013efffffffffffffe',
  '03e1ffffcfe000033fffffffffffe3f0',
  '0f80fffffff80007bffffffffffff1e0',
  '08007ffffff80007fffffffffffff1c0',
  '00001fffffdc0001fffffffffffff000',
  '00000ffffff40001fffffffffffff800',
  '00000fffffc00007ffffffffffffb800',
  '00000fffff000007f7fffffffffe2000',
  '00000ffffc000007f9fffffffffee000',
  '000007fffc000027fd8ffffffff7e000',
  '000003fff800002ffffffffffff30000',
  '000001ffb800001ffffffffffff20000',
  '000000fc1e00003ffffffffffff00000',
  '0000003cfe00003ffffffcfffff00000',
  '0000001fcfc0003ffffffc7f7f100000',
  '0000001fefc0003ffffff83e3f180000',
  '00000001e300003fffffe03c5f1c0000',
  '0000000077e0003fffffe01c5f3c0000',
  '000000003ff0001fffffe01c1e7c0000',
  '000000000ffe000fffffc00c3cec0000',
  '000000000ffe00001fffc0003dfe0000',
  '000000001fff80001fff00001dffe000',
  '000000001ffff0001fff00000ff7fa00',
  '000000001ffff8000ffe000007f07ec0',
  '000000000ffff80007fe000001f07ec0',
  '000000000ffff0000ffe60000003f000',
  '8000000007ffe0000ffee000000ff801',
  '8000000003ffe0000ffee000001ff801',
  '0000000001ffe00007fdc00000fffe18',
  '0000000001ffc00007fdc00000fffe00',
  '0000000001ff000007f8800000ffff00',
  '0000000001ff000003f80000007fff00',
  '0000000003fe000003f00000007ffe00',
  '0000000003fc00000180000000707e03',
  '0000000003f800000000000000003c03',
  '0000000003e000000000000000001c07',
  '0000000003c00000000000000000081e',
  '0000000003c00000000000000000001c',
  '00000000079000000000000000000000',
  '000000000390000000000000000000c0',
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
