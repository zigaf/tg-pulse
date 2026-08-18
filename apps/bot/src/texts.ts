import { config } from './config';
import { escapeHtml } from './format';

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

  sources: {
    organic: 'organic',
    deletedLink: 'deleted link',
  },
} as const;
