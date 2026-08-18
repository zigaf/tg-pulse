import { config } from './config';
import { escapeHtml, numberWord, percent, truncate } from './format';
import { MIN_JOINS_FOR_VERDICT, type FraudReport, type FraudSignal, type FraudVerdict, type SignalKey } from './fraud';

const FRAUD_BUTTON_LABEL_MAX = 28;

const VERDICT_BADGE: Record<FraudVerdict, string> = {
  not_enough_data: '⚪',
  clean: '🟢',
  suspicious: '🟡',
  likely_fraud: '🔴',
};

const VERDICT_TITLE: Record<FraudVerdict, string> = {
  not_enough_data: 'Not enough data',
  clean: 'Clean',
  suspicious: 'Suspicious',
  likely_fraud: 'Likely fraud',
};

const SIGNAL_LABEL: Record<SignalKey, string> = {
  burst: 'Arrived in bursts',
  churn24h: 'Left within 24 hours',
  churn7d: 'Left within 7 days',
  noUsername: 'Accounts with no username',
  noFirstName: 'Accounts with no first name',
  lowPremium: 'Telegram Premium accounts',
  conversion: 'Clicks that became joins',
};

/** Plain-English evidence for the recommendation sentence. */
const SIGNAL_EVIDENCE: Record<SignalKey, (signal: FraudSignal, report: FraudReport) => string> = {
  burst: (s, r) => `${percent(s.value)} of joins arrived in ${numberWord(r.bursts.length)} 5-minute bursts`,
  churn24h: (s) => `${percent(s.value)} left within 24 hours`,
  churn7d: (s) => `${percent(s.value)} left within 7 days`,
  noUsername: (s) => `${percent(s.value)} of the accounts have no username`,
  noFirstName: (s) => `${percent(s.value)} of the accounts have no first name`,
  lowPremium: (s) => `only ${percent(s.value)} of them are Telegram Premium`,
  conversion: (s) => `${percent(s.value)} of clicks turned into joins, far above a normal seeding rate`,
};

function signalLine(signal: FraudSignal, report: FraudReport): string {
  const windows = report.bursts.length;
  const detail =
    signal.key === 'burst' ? ` across ${windows} 5-minute ${windows === 1 ? 'window' : 'windows'}` : '';
  return `${SIGNAL_LABEL[signal.key]}: <code>${percent(signal.value)}</code>${detail} (+${signal.contribution})`;
}

function recommendation(report: FraudReport): string {
  const evidence = report.signals
    .filter((signal) => signal.contribution > 0)
    .slice(0, 2)
    .map((signal) => SIGNAL_EVIDENCE[signal.key](signal, report))
    .join(' and ');

  switch (report.verdict) {
    case 'not_enough_data':
      return `Only ${report.joins} joins so far. A reliable verdict needs at least ${MIN_JOINS_FOR_VERDICT} joins through this link.`;
    case 'clean':
      return 'This traffic behaves like a real audience. Nothing to act on.';
    case 'suspicious':
      return `Hold the next payment and ask the channel admin to explain: ${evidence}.`;
    case 'likely_fraud':
      return `Ask the channel admin for a refund: ${evidence}.`;
  }
}

/**
 * Single dictionary for every user-facing string.
 * Keep tone: short product English, HTML parse mode, minimal emoji, no em-dash.
 */
export const texts = {
  buttons: {
    addToChannel: '➕ Add to my channel',
    createLink: '🔗 Create tracking link',
    myStats: '📊 My stats',
    openDashboard: '🌐 Open dashboard',
    createAnother: 'Create another',
    viewStats: 'View stats',
    cancel: 'Cancel',
    stats: 'Stats',
    newLink: 'New link',
    links: 'Links',
    back: 'Back',
    prevPage: '< Prev',
    nextPage: 'Next >',
  },

  commands: {
    start: 'What TGPulse does and quick actions',
    newlink: 'Create a tracking link',
    stats: 'Joins, leaves and sources, last 7 days',
    channels: 'Your channels and links',
    fraud: 'Check a seeding link for bot traffic',
    help: 'How it works and FAQ',
  },

  start: {
    intro: [
      '<b>TGPulse</b> shows exactly where your subscribers come from.',
      'One unique link per ad or post, and every join is attributed to its source.',
    ].join('\n'),
  },

  help: () =>
    [
      '<b>Help</b>',
      '',
      'TGPulse creates a unique invite link for each ad or post. When someone joins through it, the join is attributed to that link, so you always know which placement brought the subscriber.',
      '',
      'Commands:',
      '/newlink creates a tracking link',
      '/stats shows the last 7 days per channel',
      '/channels lists channels, their links and stats',
      '/fraud scores a link for bot traffic: bursts, instant leaves, empty profiles',
      '/notifications toggles instant join and leave alerts',
      '',
      '<b>FAQ</b>',
      'Which rights does the bot need? Admin in your channel with the "invite users via link" permission. Nothing else.',
      'How do I disconnect a channel? Remove the bot from the channel admins. Tracking stops right away.',
      '',
      `Dashboard: ${config.dashboardUrl}`,
    ].join('\n'),

  common: {
    noChannels: [
      'No channels connected yet.',
      '',
      'Add me as an admin to your channel (the "invite users via link" permission is enough), then try again.',
    ].join('\n'),
    unknownInput: 'I did not catch that. See /help for what I can do.',
    somethingWrong: 'Something went wrong. Please try again or check /help.',
    channelUnavailable: 'This channel is not available anymore.',
  },

  onboarding: {
    channelConnected: (title: string) =>
      `Channel "${title}" is connected. Create your first tracking link: /newlink`,
  },

  newlink: {
    pickChannel: 'Pick a channel for the new tracking link:',
    askLabel: (title: string) =>
      [
        `Channel: <b>${escapeHtml(title)}</b>`,
        '',
        'Send a label for this link (e.g. "seeding @channel, June 20")',
      ].join('\n'),
    emptyLabel: 'Label cannot be empty. Send a short name for this link.',
    channelGone: 'That channel is no longer available. Start over with /newlink.',
    cancelled: 'Cancelled. Nothing was created.',
    createFailed: (description: string, title: string) =>
      `Failed to create invite link: ${description}. Check that the bot is still an admin in "${title}".`,
    saveFailed: 'Failed to save the link. Please try /newlink again.',
    created: (args: { title: string; label: string; goUrl: string; inviteLink: string; sourceCount: number }) =>
      [
        '<b>🔗 Link created</b>',
        '',
        `Channel: <b>${escapeHtml(args.title)}</b>`,
        `Label: ${escapeHtml(args.label)}`,
        `Tracking URL: <code>${escapeHtml(args.goUrl)}</code>`,
        `Invite link: <code>${escapeHtml(args.inviteLink)}</code>`,
        '',
        `This channel now has ${args.sourceCount} tracking ${args.sourceCount === 1 ? 'source' : 'sources'}. Share the tracking URL, every click and join through it is attributed to this label.`,
      ].join('\n'),
  },

  stats: {
    header: (days: number) => `<b>📊 Last ${days} days</b>`,
    channelEmpty: 'No activity in this period.',
    createLinkHint: 'Create a tracking link with /newlink to start attributing subscribers.',
  },

  channels: {
    header: (page: number, totalPages: number) =>
      totalPages > 1 ? `<b>Your channels</b> (page ${page + 1} of ${totalPages})` : '<b>Your channels</b>',
    pickHint: 'Pick a channel:',
    menu: (title: string, username: string | null) =>
      [
        `<b>${escapeHtml(title)}</b>${username ? ` (@${escapeHtml(username)})` : ''}`,
        '',
        'What do you want to do?',
      ].join('\n'),
    linksHeader: (title: string) => `<b>Links: ${escapeHtml(title)}</b>`,
    linksEmpty: 'No links yet. Tap "New link" to create one.',
    linkRow: (args: { index: number; label: string; clicks: number; joins: number; goUrl: string; isRevoked: boolean }) =>
      [
        `${args.index}. ${escapeHtml(args.label)}${args.isRevoked ? ' (revoked)' : ''}`,
        `clicks <code>${args.clicks}</code> · joins <code>${args.joins}</code>`,
        `<code>${escapeHtml(args.goUrl)}</code>`,
      ].join('\n'),
  },

  notifications: {
    header: [
      '<b>🔔 Instant notifications</b>',
      '',
      'Get a message for every join and leave. Toggle per channel, default is off.',
    ].join('\n'),
    toggled: (title: string, isOn: boolean) => `${title}: notifications ${isOn ? 'on' : 'off'}`,
    joined: (title: string, source: string) =>
      `+1 subscriber to <b>${escapeHtml(title)}</b> via ${escapeHtml(source)}`,
    left: (title: string, source: string) =>
      `-1 subscriber from <b>${escapeHtml(title)}</b> (came via ${escapeHtml(source)})`,
  },

  fraud: {
    pickChannel: [
      '<b>🛡 Fraud check</b>',
      '',
      'Pick a channel to review the traffic quality of its links.',
    ].join('\n'),
    noLinks: 'No links in this channel yet. Create one with /newlink and check it after the seeding runs.',
    linksHeader: (title: string) =>
      [
        `<b>🛡 Fraud check: ${escapeHtml(title)}</b>`,
        '',
        'Score runs from 0 to 100, higher means more bot-like. Pick a link for the full report.',
      ].join('\n'),
    linkButton: (report: FraudReport) => {
      const score = report.verdict === 'not_enough_data' ? 'n/a' : String(report.score);
      return `${VERDICT_BADGE[report.verdict]} ${truncate(report.label, FRAUD_BUTTON_LABEL_MAX)} · ${score}`;
    },
    linkUnavailable: 'This link is not available anymore.',
    report: (report: FraudReport) => {
      const lines = [
        `${VERDICT_BADGE[report.verdict]} <b>${VERDICT_TITLE[report.verdict]}</b>`,
        `Link: <b>${escapeHtml(report.label)}</b>`,
        `Score: <code>${report.score}</code> of 100`,
        '',
        `Joins <code>${report.joins}</code> · clicks <code>${report.clicks}</code>`,
      ];

      if (report.signals.length > 0) {
        lines.push('', ...report.signals.map((signal) => signalLine(signal, report)));
      }
      if (report.unmeasured.length > 0) {
        const names = report.unmeasured.map((key) => SIGNAL_LABEL[key]).join(', ');
        lines.push('', `Not measured yet, sample too small: ${names}.`);
      }

      lines.push('', recommendation(report));
      return lines.join('\n');
    },
  },

  sources: {
    organic: 'organic',
    deletedLink: 'deleted link',
  },
} as const;
