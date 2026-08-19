import type { Plan } from '@tgpulse/db';
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

/** Plan names are product names: identical in every locale. */
const planName: Record<Plan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  AGENCY: 'Agency',
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
    billing: 'Billing',
    plans: 'Plans',
  },

  buttons: {
    addToChannel: '➕ Add to my channel',
    createLink: '🔗 Create tracking link',
    myStats: '📊 My stats',
    openDashboard: '🌐 Open dashboard',
    createAnother: 'Create another',
    viewStats: 'View stats',
    cancel: 'Cancel',
    skip: 'Skip',
    modeInvite: 'Invite link (default)',
    modeLandingPost: 'Landing post',
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
    upgrade: '⭐ Upgrade',
    billing: '💳 Billing',
    pay: '⭐ Pay with Stars',
  },

  commands: {
    start: 'What TGPulse does and quick actions',
    newlink: 'Create a tracking link',
    bulklinks: 'Create many tracking links at once',
    stats: 'Joins, leaves and sources, last 7 days',
    channels: 'Your channels and links',
    fraud: 'Check a seeding link for bot traffic',
    notifications: 'Instant join and leave alerts',
    upgrade: 'Plans and Telegram Stars payment',
    billing: 'Your plan, renewal date and payments',
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
      '/bulklinks creates one link per line for a whole media plan, plus a CSV for your ad manager',
      '/stats shows the last 7 days per channel',
      '/channels lists channels, their links and stats',
      '/fraud scores a link for bot traffic: bursts, instant leaves, empty profiles',
      '/notifications toggles instant join and leave alerts',
      '/upgrade shows the plans and pays with Telegram Stars',
      '/billing shows your plan, renewal date and payments',
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
    expired: 'This dialog expired. Start again with /newlink.',

    askMode: 'Where should this link send people?',
    modeFooter:
      'Invite link attributes every join exactly. Landing post sends people to a post in the channel first.',
    askPostUrl:
      'Send the post URL, for example https://t.me/yourchannel/123 or https://t.me/c/1234567890/123.',
    postUrlFooter: 'The post has to belong to this channel, otherwise the link is refused.',
    postUrlNotTelegram:
      'That is not a t.me address. Send a post URL like https://t.me/yourchannel/123.',
    postUrlNotAPost:
      'That link does not point at a post. A post URL ends with the message number, for example https://t.me/yourchannel/123.',
    postUrlOtherChannel: (title: string) =>
      `That post belongs to another chat. Send a post from "${title}", otherwise the tracking link would send people somewhere else.`,
    postUrlNoUsername: (title: string) =>
      `"${title}" has no public username, so there is nothing to check a t.me/<name>/<id> URL against. Use the private form https://t.me/c/<id>/<message>.`,

    askBuyer: 'Who is the media buyer for this placement?',
    buyerFooter: 'Optional. Tap Skip if you do not compare buyers.',
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

  /** Wording shared by every screen that shows a link: mode, buyer, the honest caveat. */
  links: {
    mode: 'Mode',
    modeInvite: 'Invite link',
    modeLandingPost: 'Landing post',
    landingPost: 'Landing post URL',
    buyer: 'Buyer',
    landingPostWarning:
      'Attribution for landing-post links is time-window based, less precise than invite links.',
    landingPostLegend: (mark: string) =>
      `${mark} marks landing-post links: attribution there is time-window based, less precise than invite links.`,
  },

  bulk: {
    title: 'Bulk links',
    pickChannel: 'Pick the channel these links point to.',
    ask: (max: number) =>
      `Send up to ${max} placement names, one per line. Each line becomes its own tracking link.`,
    askFooter: 'The line is used as the label, exactly as you send it.',
    empty: 'No names found. Send at least one placement name, one per line.',
    working: (count: number) => `Creating ${count} ${count === 1 ? 'link' : 'links'}. This takes a moment.`,
    resultTitle: 'Bulk links',
    created: (count: number) => `Created ${count} ${count === 1 ? 'link' : 'links'}.`,
    skippedQuota: (count: number, plan: string, limit: number) =>
      `${count} skipped: the ${plan} plan allows ${limit} ${limit === 1 ? 'link' : 'links'} per channel.`,
    skippedBatch: (count: number, max: number) => `${count} skipped: at most ${max} names per batch.`,
    stopped: (reason: string) =>
      `Telegram stopped the batch: ${reason}. Everything listed here was created and is live.`,
    saveFailedReason: 'the link could not be saved',
    nothingCreated: 'No links were created.',
    resultFooter: 'The CSV below has one row per link, ready to paste into your ad manager.',
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

  /**
   * Prices, quotas and period lengths are always passed in from PLANS.
   * Nothing here may state a number the billing module does not own.
   */
  billing: {
    planName,
    unlimited: '∞',

    plansTitle: 'Plans',
    plansIntro: 'Billing is per workspace. Payment goes through Telegram Stars, right here in the chat.',
    currentPlan: 'Current plan',
    usageChannels: 'Channels',
    usageLinks: 'Links per channel',
    usageMembers: 'Team members',
    planOffer: (name: string, price: number) => `<b>${name}</b>, ${price} ⭐ / month`,
    planPerks: (channels: number, links: string, members: number) =>
      `${channels} channels, ${links} links per channel, ${members} team members, postbacks, revenue module, full fraud reports`,
    buyButton: (name: string, price: number) => `${name} ${price} ⭐ / month`,
    plansFooter: (days: number) =>
      `Each period lasts ${days} days and renews automatically. Cancel any time in Telegram.`,

    title: 'Billing',
    renewsOn: (date: string) => `Renews on ${date}`,
    activeUntil: (date: string) => `Active until ${date}`,
    cancelScheduled: 'Cancellation is scheduled, so the plan will not renew.',
    freeBody: 'You are on the Free plan. Nothing is charged.',
    paymentsTitle: 'Last payments',
    paymentRow: (date: string, plan: string, amount: number) => `${date} · ${plan} · ${amount} ⭐`,
    noPayments: 'No payments yet.',
    howToCancel: 'To cancel: Telegram, then Settings, My Stars, Subscriptions.',

    invoiceTitle: (name: string) => `TGPulse ${name}`,
    invoiceDescription: (name: string, days: number) =>
      `${name} plan for ${days} days: more channels, unlimited tracking links, postbacks, revenue module and full fraud reports.`,
    invoicePrompt: (name: string, price: number) =>
      `${name}, ${price} ⭐ for one period. Tap the button below to pay with Telegram Stars.`,
    invoiceFailed: 'Could not open the payment form. Please try again in a minute.',
    invalidPayload: 'This invoice is not valid anymore. Open /upgrade and pick the plan again.',

    paidTitle: 'Payment received',
    paidBody: (name: string, date: string) => `<b>${name}</b> is active until ${date}.`,
    paidFooter: 'Everything the plan unlocks is available right away.',

    noWorkspace: 'Billing works per workspace, and a workspace appears with your first channel.',

    upsell: {
      title: 'Plan limit reached',
      channels: (plan: string, limit: number) =>
        `The ${plan} plan covers ${limit} ${limit === 1 ? 'channel' : 'channels'}. This one keeps tracking, but new links in it are blocked.`,
      links: (plan: string, limit: number) =>
        `The ${plan} plan allows ${limit} tracking ${limit === 1 ? 'link' : 'links'} per channel, and this channel is full.`,
      fraud: (plan: string) =>
        `On the ${plan} plan the full fraud report is available for the newest link of a channel only.`,
      footer: (name: string, price: number) =>
        `Upgrade to ${name} for ${price} ⭐ per month to lift the limit.`,
      connectedTitle: 'Channel connected, above your plan',
      connectedBody: (title: string, plan: string, limit: number) =>
        `"${title}" is connected and tracking. Your ${plan} plan covers ${limit} ${limit === 1 ? 'channel' : 'channels'}, so new tracking links in this one are blocked until you upgrade.`,
    },
  },
};
