import { getPrisma, EventType } from '@tgpulse/db';

const prisma = getPrisma();

// ---------- Calibration ----------
//
// Every signal is a share in 0..1. `clean` is the highest value still considered
// normal, `fraud` is the value that earns the full weight; anything in between
// ramps linearly. Nudging a pair here re-tunes the detector without touching logic.
// Weights add up to 100, so a link that trips every signal scores 100.

/** Below this many joins through the link the numbers are noise, not evidence. */
export const MIN_JOINS_FOR_VERDICT = 20;

/** Bot pours arrive in packs: joins are bucketed into windows of this size. */
const BURST_WINDOW_MS = 5 * 60 * 1000;
/** How many densest non-overlapping windows are summed into the burst share. */
const BURST_WINDOW_COUNT = 3;

/** A churn share needs at least this many subscribers whose window already closed. */
const CHURN_MIN_SAMPLE = 10;
/** Premium penetration is only meaningful on a reasonably sized cohort. */
const PREMIUM_MIN_SAMPLE = 50;
/** Click to join conversion is only meaningful once the link got real traffic. */
const CONVERSION_MIN_CLICKS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

const SIGNALS = {
  // Legit seeding also spikes right after the post goes live, so this weighs less
  // than churn even though it is the loudest symptom of a pour.
  burst: { weight: 25, clean: 0.45, fraud: 0.85 },
  churn24h: { weight: 22, clean: 0.1, fraud: 0.45 },
  churn7d: { weight: 13, clean: 0.2, fraud: 0.65 },
  noUsername: { weight: 10, clean: 0.5, fraud: 0.9 },
  // firstName is mandatory in Telegram, so a missing one is close to impossible.
  noFirstName: { weight: 5, clean: 0.02, fraud: 0.2 },
  // Inverted: the lower the Premium share, the worse. Real audiences sit around 4%.
  lowPremium: { weight: 10, clean: 0.04, fraud: 0 },
  // Bots never click the tracking URL, so a pour makes joins outrun clicks.
  conversion: { weight: 15, clean: 0.5, fraud: 0.9 },
} as const;

const SUSPICIOUS_SCORE = 35;
const LIKELY_FRAUD_SCORE = 60;

// ---------- Types ----------

export type SignalKey = keyof typeof SIGNALS;

export type FraudVerdict = 'not_enough_data' | 'clean' | 'suspicious' | 'likely_fraud';

export interface BurstWindow {
  startedAt: Date;
  joins: number;
}

export interface FraudSignal {
  key: SignalKey;
  /** Observed share, 0..1. */
  value: number;
  /** How deep into the fraud zone the value sits, 0..1. */
  severity: number;
  weight: number;
  /** Points this signal added to the final 0..100 score. */
  contribution: number;
}

export interface FraudReport {
  linkId: string;
  label: string;
  verdict: FraudVerdict;
  score: number;
  joins: number;
  clicks: number;
  /** Densest non-overlapping join windows, biggest first. */
  bursts: BurstWindow[];
  /** Measured signals, strongest contribution first. */
  signals: FraudSignal[];
  /** Signals skipped because the sample was too small to judge. */
  unmeasured: SignalKey[];
}

interface SubscriberFacts {
  joinedAt: Date;
  leftAt: Date | null;
  username: string | null;
  firstName: string | null;
  isPremium: boolean;
}

// ---------- Signal maths ----------

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function severityOf(key: SignalKey, value: number): number {
  const { clean, fraud } = SIGNALS[key];
  if (clean === fraud) return 0;
  return clamp01((value - clean) / (fraud - clean));
}

function shareOf(matching: number, total: number): number {
  return total === 0 ? 0 : matching / total;
}

/**
 * Greedily pick the windows holding the most joins, removing the joins already
 * consumed so two windows never claim the same subscriber.
 */
function densestWindows(sortedMs: number[], limit: number): BurstWindow[] {
  const remaining = [...sortedMs];
  const windows: BurstWindow[] = [];

  while (windows.length < limit && remaining.length > 0) {
    let bestFrom = 0;
    let bestTo = 0;
    for (let from = 0; from < remaining.length; from++) {
      let to = from;
      while (to < remaining.length && remaining[to] - remaining[from] < BURST_WINDOW_MS) to++;
      if (to - from > bestTo - bestFrom) {
        bestFrom = from;
        bestTo = to;
      }
    }
    windows.push({ startedAt: new Date(remaining[bestFrom]), joins: bestTo - bestFrom });
    remaining.splice(bestFrom, bestTo - bestFrom);
  }

  return windows;
}

/**
 * Share of subscribers that left inside `windowMs` of joining. Only subscribers
 * whose window has already elapsed count, otherwise fresh joins would dilute it.
 * Returns null when the eligible cohort is too small to judge.
 */
function churnShare(subscribers: SubscriberFacts[], windowMs: number, now: number): number | null {
  const eligible = subscribers.filter((sub) => now - sub.joinedAt.getTime() >= windowMs);
  if (eligible.length < CHURN_MIN_SAMPLE) return null;

  const left = eligible.filter(
    (sub) => sub.leftAt !== null && sub.leftAt.getTime() - sub.joinedAt.getTime() <= windowMs,
  );
  return shareOf(left.length, eligible.length);
}

function verdictOf(score: number): FraudVerdict {
  if (score >= LIKELY_FRAUD_SCORE) return 'likely_fraud';
  if (score >= SUSPICIOUS_SCORE) return 'suspicious';
  return 'clean';
}

// ---------- Analysis ----------

/**
 * Score is the weighted severity of the measurable signals, rescaled to 0..100
 * over the weight that was actually available, so a link with an unmeasurable
 * signal is not silently graded as cleaner than it is.
 */
function scoreSignals(measured: Map<SignalKey, number>): {
  score: number;
  signals: FraudSignal[];
} {
  const availableWeight = [...measured.keys()].reduce((sum, key) => sum + SIGNALS[key].weight, 0);
  if (availableWeight === 0) return { score: 0, signals: [] };

  const signals: FraudSignal[] = [...measured].map(([key, value]) => {
    const { weight } = SIGNALS[key];
    const severity = severityOf(key, value);
    return {
      key,
      value,
      severity,
      weight,
      contribution: Math.round(((severity * weight) / availableWeight) * 100),
    };
  });

  const rawPoints = signals.reduce((sum, signal) => sum + signal.severity * signal.weight, 0);
  signals.sort((a, b) => b.contribution - a.contribution || a.key.localeCompare(b.key));

  return { score: Math.round((rawPoints / availableWeight) * 100), signals };
}

async function buildReport(link: { id: string; label: string }): Promise<FraudReport> {
  const [joinEvents, subscribers, clicks] = await Promise.all([
    prisma.memberEvent.findMany({
      where: { linkId: link.id, type: EventType.JOIN },
      select: { ts: true },
      orderBy: { ts: 'asc' },
    }),
    prisma.subscriber.findMany({
      where: { linkId: link.id },
      select: { joinedAt: true, leftAt: true, username: true, firstName: true, isPremium: true },
    }),
    prisma.click.count({ where: { linkId: link.id } }),
  ]);

  const joins = joinEvents.length;
  const base = { linkId: link.id, label: link.label, joins, clicks };

  if (joins < MIN_JOINS_FOR_VERDICT) {
    return { ...base, verdict: 'not_enough_data', score: 0, bursts: [], signals: [], unmeasured: [] };
  }

  const now = Date.now();
  const bursts = densestWindows(
    joinEvents.map((event) => event.ts.getTime()),
    BURST_WINDOW_COUNT,
  );
  const burstJoins = bursts.reduce((sum, window) => sum + window.joins, 0);

  const profiled = subscribers.length;
  const profileShare = (matches: (sub: SubscriberFacts) => boolean, minSample: number) =>
    profiled >= minSample ? shareOf(subscribers.filter(matches).length, profiled) : null;

  const candidates: Array<[SignalKey, number | null]> = [
    ['burst', shareOf(burstJoins, joins)],
    ['churn24h', churnShare(subscribers, DAY_MS, now)],
    ['churn7d', churnShare(subscribers, 7 * DAY_MS, now)],
    ['noUsername', profileShare((sub) => !sub.username, 1)],
    ['noFirstName', profileShare((sub) => !sub.firstName, 1)],
    ['lowPremium', profileShare((sub) => sub.isPremium, PREMIUM_MIN_SAMPLE)],
    ['conversion', clicks >= CONVERSION_MIN_CLICKS ? shareOf(joins, clicks) : null],
  ];

  const measured = new Map<SignalKey, number>();
  const unmeasured: SignalKey[] = [];
  for (const [key, value] of candidates) {
    if (value === null) unmeasured.push(key);
    else measured.set(key, value);
  }

  const { score, signals } = scoreSignals(measured);
  return { ...base, verdict: verdictOf(score), score, bursts, signals, unmeasured };
}

/** Full antifraud report for one tracked link. Read only. Null when the link is gone. */
export async function analyzeLink(linkId: string): Promise<FraudReport | null> {
  const link = await prisma.trackedLink.findUnique({
    where: { id: linkId },
    select: { id: true, label: true },
  });
  return link ? buildReport(link) : null;
}

/** Reports for the newest links of a channel, newest first. */
export async function analyzeChannelLinks(channelId: string, limit: number): Promise<FraudReport[]> {
  const links = await prisma.trackedLink.findMany({
    where: { channelId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, label: true },
  });
  return Promise.all(links.map((link) => buildReport(link)));
}
