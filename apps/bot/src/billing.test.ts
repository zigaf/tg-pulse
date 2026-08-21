import { describe, expect, test } from 'vitest';
import { Plan } from '@tgpulse/db';
import {
  buildInvoicePayload,
  isPaidPlan,
  isWithinQuota,
  nextPaidPlan,
  PAID_PLANS,
  parseInvoicePayload,
  PLANS,
  STARS_CURRENCY,
  SUBSCRIPTION_PERIOD_SECONDS,
  UNLIMITED,
} from './billing';

describe('plan catalog invariants', () => {
  test('FREE costs nothing and never expires', () => {
    expect(PLANS[Plan.FREE].priceXtr).toBe(0);
    expect(PLANS[Plan.FREE].periodDays).toBe(0);
  });

  test('paid plans have a positive Stars price and a 30-day period', () => {
    for (const plan of PAID_PLANS) {
      expect(PLANS[plan].priceXtr).toBeGreaterThan(0);
      expect(PLANS[plan].periodDays).toBe(30);
    }
  });

  test('PRO costs 10 Stars', () => {
    expect(PLANS[Plan.PRO].priceXtr).toBe(10);
  });

  test('upgrades never shrink limits or drop features', () => {
    const order = [Plan.FREE, Plan.PRO, Plan.AGENCY];
    for (let i = 1; i < order.length; i += 1) {
      const lower = PLANS[order[i - 1]];
      const higher = PLANS[order[i]];
      expect(higher.limits.channels).toBeGreaterThanOrEqual(lower.limits.channels);
      expect(higher.limits.members).toBeGreaterThanOrEqual(lower.limits.members);
      for (const key of ['postbacks', 'revenue', 'fraudFull'] as const) {
        if (lower.features[key]) expect(higher.features[key]).toBe(true);
      }
    }
  });

  test('recurring invoice period matches Telegram requirement of 30 days', () => {
    expect(SUBSCRIPTION_PERIOD_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(STARS_CURRENCY).toBe('XTR');
  });
});

describe('isPaidPlan / nextPaidPlan', () => {
  test('recognizes exactly the purchasable plans', () => {
    expect(isPaidPlan('PRO')).toBe(true);
    expect(isPaidPlan('AGENCY')).toBe(true);
    expect(isPaidPlan('FREE')).toBe(false);
    expect(isPaidPlan('')).toBe(false);
    expect(isPaidPlan('pro')).toBe(false);
  });

  test('offers the next tier, and the top tier offers itself', () => {
    expect(nextPaidPlan(Plan.FREE)).toBe(Plan.PRO);
    expect(nextPaidPlan(Plan.PRO)).toBe(Plan.AGENCY);
    expect(nextPaidPlan(Plan.AGENCY)).toBe(Plan.AGENCY);
  });
});

describe('isWithinQuota', () => {
  test('unlimited always passes', () => {
    expect(isWithinQuota(0, UNLIMITED)).toBe(true);
    expect(isWithinQuota(1_000_000, UNLIMITED)).toBe(true);
  });

  test('finite quotas are exclusive at the cap', () => {
    expect(isWithinQuota(0, 1)).toBe(true);
    expect(isWithinQuota(1, 1)).toBe(false);
    expect(isWithinQuota(2, 1)).toBe(false);
  });
});

describe('invoice payload', () => {
  test('round-trips plan and workspace id', () => {
    const raw = buildInvoicePayload(Plan.PRO, 'ws_123');
    expect(parseInvoicePayload(raw)).toEqual({ plan: Plan.PRO, workspaceId: 'ws_123' });
  });

  test('rejects malformed payloads', () => {
    expect(parseInvoicePayload('')).toBeNull();
    expect(parseInvoicePayload('plan:PRO')).toBeNull();
    expect(parseInvoicePayload('plan:FREE:ws:ws_123')).toBeNull();
    expect(parseInvoicePayload('plan:PRO:ws:')).toBeNull();
    expect(parseInvoicePayload('nope:PRO:ws:ws_123')).toBeNull();
    expect(parseInvoicePayload('plan:PRO:ws:ws_123:extra')).toBeNull();
  });
});
