import { describe, expect, test } from 'vitest';
import {
  isQuotaFull,
  normalizePlan,
  PLAN_CATALOG,
  PLAN_ORDER,
  planRank,
  quotaRatio,
  toQuota,
} from './billing';

describe('plan catalog', () => {
  test('mirrors the bot prices: Pro is 10 Stars', () => {
    expect(PLAN_CATALOG.FREE.priceStars).toBe(0);
    expect(PLAN_CATALOG.PRO.priceStars).toBe(10);
  });

  test('catalog covers every plan in order', () => {
    expect(PLAN_ORDER).toEqual(['FREE', 'PRO', 'AGENCY']);
    for (const plan of PLAN_ORDER) expect(PLAN_CATALOG[plan].plan).toBe(plan);
  });
});

describe('normalizePlan', () => {
  test('accepts known plans case-insensitively', () => {
    expect(normalizePlan('PRO')).toBe('PRO');
    expect(normalizePlan('pro')).toBe('PRO');
    expect(normalizePlan('agency')).toBe('AGENCY');
  });

  test('anything unknown reads as FREE', () => {
    expect(normalizePlan('')).toBe('FREE');
    expect(normalizePlan(null)).toBe('FREE');
    expect(normalizePlan(undefined)).toBe('FREE');
    expect(normalizePlan('ENTERPRISE')).toBe('FREE');
  });
});

describe('planRank', () => {
  test('ranks plans in upgrade order', () => {
    expect(planRank('FREE')).toBeLessThan(planRank('PRO'));
    expect(planRank('PRO')).toBeLessThan(planRank('AGENCY'));
  });
});

describe('quota helpers', () => {
  test('toQuota treats null, undefined and broken numbers as unlimited', () => {
    expect(toQuota(null)).toBeNull();
    expect(toQuota(undefined)).toBeNull();
    expect(toQuota(-1)).toBeNull();
    expect(toQuota(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toQuota(5)).toBe(5);
    expect(toQuota(0)).toBe(0);
  });

  test('quotaRatio clamps to [0, 1] and never fills for unlimited', () => {
    expect(quotaRatio(5, 10)).toBe(0.5);
    expect(quotaRatio(20, 10)).toBe(1);
    expect(quotaRatio(5, null)).toBe(0);
    expect(quotaRatio(5, 0)).toBe(0);
  });

  test('isQuotaFull is inclusive at the cap and false for unlimited', () => {
    expect(isQuotaFull(9, 10)).toBe(false);
    expect(isQuotaFull(10, 10)).toBe(true);
    expect(isQuotaFull(10, null)).toBe(false);
  });
});
