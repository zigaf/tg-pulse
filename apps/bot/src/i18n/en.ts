import { percent } from '../format';
import type { FraudReport, FraudSignal, FraudVerdict, SignalKey } from '../fraud';

/**
 * Default locale and the source of truth for the dictionary shape:
 * `type Dict = typeof en`, so every other locale is checked against this file.
 *
 * Tone: short product English, HTML parse mode, minimal emoji, no em-dash.
 * Template functions escape the user data they interpolate; callers pass raw values.
 */

const verdict: Record<FraudVerdict, string> = {
  not_enough_data: 'Not enough data',
  clean: 'Clean',
  suspicious: 'Suspicious',
  likely_fraud: 'Likely fraud',
};

const signal: Record<SignalKey, string> = {
  burst: 'Arrived in bursts',
  churn24h: 'Left within 24 hours',
  churn7d: 'Left within 7 days',
  noUsername: 'Accounts with no username',
  noFirstName: 'Accounts with no first name',
  lowPremium: 'Telegram Premium accounts',
  conversion: 'Clicks that became joins',
};

/** Plain-English evidence used inside the recommendation sentence. */
const evidence: Record<SignalKey, (s: FraudSignal, r: FraudReport) => string> = {
  burst: (s, r) => `${percent(s.value)} of joins arrived in ${r.bursts.length} five-minute bursts`,
  churn24h: (s) => `${percent(s.value)} left within 24 hours`,
  churn7d: (s) => `${percent(s.value)} left within 7 days`,
  noUsername: (s) => `${percent(s.value)} of the accounts have no username`,
  noFirstName: (s) => `${percent(s.value)} of the accounts have no first name`,
  lowPremium: (s) => `only ${percent(s.value)} of them are Telegram Premium`,
  conversion: (s) => `${percent(s.value)} of clicks turned into joins, far above a normal seeding rate`,
};

export const en = {
  /** Breadcrumb segments. Kept separate from buttons: no emoji, title case. */
  nav: {
    channels: 'Channels',
    links: 'Links',
    stats: 'Stats',
    fraud: 'Fraud check',
    alerts: 'Alerts',
    language: 'Language',
  },

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
    fraudCheck: 'Fraud check',
    language: '🌐 Language',
    back: '⟵ Back',
    close: '✕ Close',
    prevPage: '‹ Prev',
    nextPage: 'Next ›',
    english: 'English',
    russian: 'Русский',
  },

  commands: {
    start: 'What TGPulse does and quick actions',
    newlink: 'Create a tracking link',
    stats: 'Joins, leaves and sources, last 7 days',
    channels: 'Your channels and links',
    fraud: 'Check a seeding link for bot traffic',
    notifications: 'Instant join and leave alerts',
    language: 'Switch the bot language',
    help: 'How it works and FAQ',
  },

  common: {
    unknownInput: 'I did not catch that. See /help for what I can do.',
    somethingWrong: 'Something went wrong. Please try again or check /help.',
    channelUnavailable: 'This channel is not available anymore.',
  },

  /** Empty states: an instruction plus a button, never a bare "nothing here". */
  empty: {
    channelsTitle: 'No channels yet',
    channelsBody: 'Add the bot as an admin to your channel. The "invite users via link" permission is enough, nothing else.',
    channelsFooter: 'Once the channel is connected, /newlink creates your first tracking link.',
  },

  start: {
    title: 'TGPulse',
    intro: 'TGPulse shows exactly where your subscribers come from. One unique link per ad or post, and every join is attributed to its source.',
    setup: 'Setup',
    stepStart: 'Bot started',
    stepChannel: 'Channel connected',
    stepLink: 'First tracking link created',
    nextChannel: 'Next step: add the bot to your channel as an admin.',
    nextLink: 'Next step: create a tracking link and put it in your ad.',
    ready: 'All set. Open /stats after the next seeding run.',
  },

  help: {
    title: 'Help',
    intro: 'TGPulse creates a unique invite link for each ad or post. When someone joins through it, the join is attributed to that link, so you always know which placement brought the subscriber.',
    commandsTitle: 'Commands',
    commands: [
      '/newlink creates a tracking link',
      '/stats shows the last 7 days per channel',
      '/channels lists channels, their links and stats',
      '/fraud scores a link for bot traffic: bursts, instant leaves, empty profiles',
      '/notifications toggles instant join and leave alerts',
      '/language switches between English and Russian',
    ],
    faqTitle: 'FAQ',
    faq: [
      'Which rights does the bot need? Admin in your channel with the "invite users via link" permission. Nothing else.',
      'How do I disconnect a channel? Remove the bot from the channel admins. Tracking stops right away.',
    ],
    dashboard: (url: string) => `Dashboard: ${url}`,
  },

  language: {
    title: 'Language',
    intro: 'Pick the language for bot replies, daily reports and instant alerts.',
    current: (name: string) => `Current: ${name}`,
    changed: 'Language set to English. Everything the bot sends now uses it.',
  },

  onboarding: {
    channelConnected: (title: string) => `Channel "${title}" is connected.`,
    createFirstLink: 'Create your first tracking link with /newlink.',
  },

  newlink: {
    title: 'New tracking link',
    pickChannel: 'Pick the channel this link points to.',
    askLabel: 'Send a label for this link, for example "seeding @channel, June 20".',
    labelFooter: 'The label is what you will see in stats and reports.',
    emptyLabel: 'The label cannot be empty. Send a short name for this link.',
    channelGone: 'That channel is no longer available. Start over with /newlink.',
    cancelled: 'Cancelled. Nothing was created.',
    createFailed: (description: string, title: string) =>
      `Failed to create the invite link: ${description}. Check that the bot is still an admin in "${title}".`,
    saveFailed: 'Failed to save the link. Please try /newlink again.',
    createdTitle: 'Link created',
    label: 'Label',
    trackingUrl: 'Tracking URL',
    inviteLink: 'Invite link',
    createdFooter: (sources: number) =>
      `This channel now has ${sources} tracking ${sources === 1 ? 'source' : 'sources'}. Share the tracking URL: every click and join through it is attributed to this label.`,
  },

  stats: {
    title: (days: number) => `Last ${days} days`,
    joins: 'Joins',
    leaves: 'Leaves',
    net: 'Net',
    perDay: 'Per day',
    topSources: 'Top sources',
    empty: 'No activity in this period.',
    hint: 'Create a tracking link with /newlink to start attributing subscribers.',
  },

  channels: {
    title: 'Your channels',
    page: (page: number, total: number) => `page ${page} of ${total}`,
    pickHint: 'Pick a channel to see its stats and links.',
    menuFooter: 'Stats, a new tracking link or the full link list.',
    linksTitle: 'Links',
    linksEmpty: 'No links in this channel yet.',
    linksEmptyFooter: 'Tap "New link" to create the first one.',
    clicks: (count: number) => `${count} ${count === 1 ? 'click' : 'clicks'}`,
    joins: (count: number) => `${count} ${count === 1 ? 'join' : 'joins'}`,
    revoked: 'revoked',
    linksFooter: 'Every click and join through these URLs is attributed automatically.',
  },

  alerts: {
    title: 'Instant alerts',
    intro: 'Get a message for every join and leave. Toggle per channel, default is off.',
    footer: 'Tap a channel to switch its alerts on or off.',
    toggled: (title: string, isOn: boolean) => `${title}: alerts ${isOn ? 'on' : 'off'}`,
    joined: (title: string, source: string) => `+1 subscriber to <b>${title}</b> via ${source}`,
    left: (title: string, source: string) => `-1 subscriber from <b>${title}</b> (came via ${source})`,
  },

  fraud: {
    verdict,
    signal,
    evidence,
    title: 'Fraud check',
    pickChannel: 'Pick a channel to review the traffic quality of its links.',
    linksFooter: 'Score runs from 0 to 100, higher means more bot-like. Pick a link for the full report.',
    noLinks: 'No links in this channel yet.',
    noLinksFooter: 'Create one with /newlink and check it after the seeding runs.',
    linkUnavailable: 'This link is not available anymore.',
    score: 'Score',
    joins: 'Joins',
    clicks: 'Clicks',
    notMeasured: (names: string) => `Not measured yet, sample too small: ${names}.`,
    evidenceJoiner: ' and ',
    adviceNotEnough: (joins: number, min: number) =>
      `Only ${joins} joins so far. A reliable verdict needs at least ${min} joins through this link.`,
    adviceClean: 'This traffic behaves like a real audience. Nothing to act on.',
    adviceSuspicious: (why: string) => `Hold the next payment and ask the channel admin to explain: ${why}.`,
    adviceFraud: (why: string) => `Ask the channel admin for a refund: ${why}.`,
  },

  report: {
    title: (date: string) => `Daily report, ${date} (UTC)`,
    joins: 'Joins',
    leaves: 'Leaves',
    net: 'Net',
    topSources: 'Top sources',
    leaversCame: 'Leavers came from',
    empty: 'No joins and no leaves yesterday.',
    noChannels: 'No active channels yet. Add the bot as an admin to your channel first.',
  },

  sources: {
    organic: 'organic',
    deletedLink: 'deleted link',
  },
};
