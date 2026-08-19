import { escapeHtml, percent, truncate } from '../format';
import { MIN_JOINS_FOR_VERDICT, type FraudReport, type FraudVerdict } from '../fraud';
import type { Dict } from '../i18n';
import { bar, card, kv } from '../ui';

const ICON_FRAUD = '🛡';
const BAR_WIDTH = 8;
const BUTTON_LABEL_MAX = 24;
const EVIDENCE_LIMIT = 2;
const MAX_SCORE = 100;

/** Verdict badges are symbols, identical in every locale. */
const VERDICT_BADGE: Record<FraudVerdict, string> = {
  not_enough_data: '⚪',
  clean: '🟢',
  suspicious: '🟡',
  likely_fraud: '🔴',
};

/** Marks a landing-post link in the list; the card footer explains what it means. */
const LANDING_POST_MARK = '↗';

export function fraudPickChannelCard(dict: Dict): string {
  return card({ icon: ICON_FRAUD, title: dict.fraud.title, footer: dict.fraud.pickChannel });
}

/**
 * The list is where the reader compares links, so the legend replaces the generic
 * footer as soon as one of them attributes by time window instead of by invite.
 */
export function fraudLinksCard(dict: Dict, channelTitle: string, reports: FraudReport[]): string {
  const hasLinks = reports.length > 0;
  const footer = !hasLinks
    ? dict.fraud.noLinksFooter
    : reports.some((report) => report.isLandingPost)
      ? dict.links.landingPostLegend(LANDING_POST_MARK)
      : dict.fraud.linksFooter;

  return card({
    icon: ICON_FRAUD,
    title: dict.fraud.title,
    crumbs: [escapeHtml(channelTitle)],
    body: hasLinks ? undefined : [dict.fraud.noLinks],
    footer,
  });
}

export function fraudLinkButton(dict: Dict, report: FraudReport): string {
  const score = report.verdict === 'not_enough_data' ? '?' : String(report.score);
  const mark = report.isLandingPost ? ` ${LANDING_POST_MARK}` : '';
  return `${VERDICT_BADGE[report.verdict]} ${truncate(report.label, BUTTON_LABEL_MAX)}${mark} · ${score}`;
}

/** The recommendation sentence, backed by the two loudest signals. */
function advice(dict: Dict, report: FraudReport): string {
  const why = report.signals
    .filter((signal) => signal.contribution > 0)
    .slice(0, EVIDENCE_LIMIT)
    .map((signal) => dict.fraud.evidence[signal.key](signal, report))
    .join(dict.fraud.evidenceJoiner);

  switch (report.verdict) {
    case 'not_enough_data':
      return dict.fraud.adviceNotEnough(report.joins, MIN_JOINS_FOR_VERDICT);
    case 'clean':
      return dict.fraud.adviceClean;
    case 'suspicious':
      return dict.fraud.adviceSuspicious(why);
    case 'likely_fraud':
      return dict.fraud.adviceFraud(why);
  }
}

function signalLines(dict: Dict, report: FraudReport): string[] {
  if (report.signals.length === 0) return [];
  const top = Math.max(...report.signals.map((signal) => signal.contribution));

  return report.signals.map((signal) => {
    const weight = `<code>${bar(signal.contribution, top, BAR_WIDTH)}</code>`;
    return `${weight} ${dict.fraud.signal[signal.key]}: ${percent(signal.value)} (+${signal.contribution})`;
  });
}

/** Fraud check › <channel> › <link>: verdict as the headline, evidence below it. */
export function fraudReportCard(dict: Dict, report: FraudReport, channelTitle: string): string {
  const body = signalLines(dict, report);
  if (report.unmeasured.length > 0) {
    const names = report.unmeasured.map((key) => dict.fraud.signal[key]).join(', ');
    body.push('', dict.fraud.notMeasured(names));
  }
  // Said out loud here: every number above rests on weaker attribution.
  if (report.isLandingPost) {
    body.push('', `${dict.links.mode}: ${dict.links.modeLandingPost}`, dict.links.landingPostWarning);
  }

  return card({
    icon: VERDICT_BADGE[report.verdict],
    title: dict.fraud.verdict[report.verdict],
    crumbs: [dict.nav.fraud, escapeHtml(channelTitle), escapeHtml(report.label)],
    rows: [
      kv(dict.fraud.score, `${report.score}/${MAX_SCORE}`),
      kv(dict.fraud.joins, report.joins),
      kv(dict.fraud.clicks, report.clicks),
    ],
    body,
    footer: advice(dict, report),
  });
}
