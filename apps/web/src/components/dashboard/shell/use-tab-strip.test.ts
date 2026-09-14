import { describe, expect, test } from 'vitest';
import { centeredScrollLeft } from './use-tab-strip';

describe('centeredScrollLeft', () => {
  const strip = { clientWidth: 300, scrollWidth: 900 };

  test('centres an item in the middle of the strip', () => {
    expect(centeredScrollLeft(strip, { offsetLeft: 400, offsetWidth: 100 })).toBe(300);
  });

  test('clamps to zero for items near the start', () => {
    expect(centeredScrollLeft(strip, { offsetLeft: 20, offsetWidth: 80 })).toBe(0);
  });

  test('clamps to the end for items near the end', () => {
    expect(centeredScrollLeft(strip, { offsetLeft: 820, offsetWidth: 80 })).toBe(600);
  });
});
