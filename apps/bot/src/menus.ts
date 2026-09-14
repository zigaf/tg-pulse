import { InlineKeyboard } from 'grammy';
import type { Channel } from '@tgpulse/db';
import { config } from './config';
import type { Dict, Lang } from './i18n';

/** Destination of a tracking link: a unique invite, or a post inside the channel. */
export type LinkMode = 'invite' | 'post';

/** Central callback-data map. Every callback the bot handles is built from here. */
export const CB = {
  goNewlink: 'go:newlink',
  goStats: 'go:stats',
  goFraud: 'go:fraud',
  goLanguage: 'go:lang',
  goSettings: 'go:settings',
  close: 'ui:close',
  langSet: (lang: Lang) => `lang:set:${lang}`,
  nlPick: (channelId: string) => `nl:pick:${channelId}`,
  nlCancel: 'nl:cancel',
  nlMode: (mode: LinkMode) => `nl:mode:${mode}`,
  nlSkipBuyer: 'nl:buyer:skip',
  blPick: (channelId: string) => `bl:pick:${channelId}`,
  chList: (page: number) => `ch:list:${page}`,
  chOpen: (channelId: string) => `ch:open:${channelId}`,
  chStats: (channelId: string) => `ch:stats:${channelId}`,
  chLinks: (channelId: string) => `ch:links:${channelId}`,
  ntfToggle: (channelId: string) => `ntf:${channelId}`,
  frChannel: (channelId: string) => `fr:ch:${channelId}`,
  frLink: (linkId: string) => `fr:link:${linkId}`,
  goUpgrade: 'go:upgrade',
  goBilling: 'go:billing',
  billBuy: (plan: string, workspaceId: string) => `bill:buy:${plan}:${workspaceId}`,
} as const;

export const CHANNELS_PAGE_SIZE = 5;

/** Marks used by checklists and toggles. Shared so every screen reads the same. */
export const MARK_DONE = '✓';
export const MARK_TODO = '○';

function addToChannelUrl(botUsername: string): string {
  return `https://t.me/${botUsername}?startchannel&admin=invite_users`;
}

/** Path prefix of the dashboard inside the web app; DASHBOARD_URL normally ends with it. */
const APP_PREFIX = '/app';

export type AppLinkKind = 'web_app' | 'url';

export interface AppLink {
  url: string;
  /** web_app opens the Mini App inside Telegram; url is the fallback for non-https dev URLs. */
  kind: AppLinkKind;
}

/**
 * Absolute dashboard URL for a path relative to /app ('' is the channel list).
 * Telegram rejects non-https web_app URLs, so local http dashboards get a plain link button.
 */
export function appLinkFor(dashboardUrl: string, path: string): AppLink {
  const trimmed = dashboardUrl.endsWith('/') ? dashboardUrl.slice(0, -1) : dashboardUrl;
  const base = trimmed.endsWith(APP_PREFIX) ? trimmed : `${trimmed}${APP_PREFIX}`;
  const url = `${base}${path}`;
  const kind: AppLinkKind = /^https:\/\//i.test(url) ? 'web_app' : 'url';
  return { url, kind };
}

/** Button that opens a dashboard page: as a Mini App when possible, as a link otherwise. */
export function openAppButton(keyboard: InlineKeyboard, text: string, path: string): InlineKeyboard {
  const link = appLinkFor(config.dashboardUrl, path);
  return link.kind === 'web_app' ? keyboard.webApp(text, link.url) : keyboard.url(text, link.url);
}

/** Web routes of the dashboard, mirrored from apps/web so both sides agree on the URL shape. */
export const appPaths = {
  home: '',
  team: (workspaceId: string | null) =>
    workspaceId ? `/team?ws=${encodeURIComponent(workspaceId)}` : '/team',
  billing: (workspaceId: string | null) =>
    workspaceId ? `/billing?ws=${encodeURIComponent(workspaceId)}` : '/billing',
  integrations: (channelId: string) => `/channels/${encodeURIComponent(channelId)}/integrations`,
  postbacks: (channelId: string) => `/channels/${encodeURIComponent(channelId)}/postbacks`,
  share: (channelId: string) => `/channels/${encodeURIComponent(channelId)}/share`,
} as const;

/**
 * Trailing navigation row: one level back where there is one, plus a way out.
 * row() pushes unconditionally, so it is only called when the current row has
 * content; otherwise Telegram would receive an empty row.
 */
function navRow(keyboard: InlineKeyboard, dict: Dict, backTo?: string): InlineKeyboard {
  const lastRow = keyboard.inline_keyboard[keyboard.inline_keyboard.length - 1];
  if (lastRow && lastRow.length > 0) keyboard.row();
  if (backTo) keyboard.text(dict.buttons.back, backTo);
  return keyboard.text(dict.buttons.close, CB.close);
}

export interface OnboardingProgress {
  hasChannel: boolean;
  hasLink: boolean;
}

/** /start: the primary button is whatever setup step is still open. */
export function startMenu(dict: Dict, botUsername: string, progress: OnboardingProgress): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (!progress.hasChannel) {
    keyboard.url(dict.buttons.addToChannel, addToChannelUrl(botUsername)).row();
  } else if (!progress.hasLink) {
    keyboard.text(dict.buttons.createLink, CB.goNewlink).row();
  } else {
    keyboard.text(dict.buttons.myStats, CB.goStats).text(dict.buttons.createLink, CB.goNewlink).row();
  }

  return openAppButton(keyboard, dict.buttons.openDashboard, appPaths.home).text(
    dict.buttons.language,
    CB.goLanguage,
  );
}

export function helpMenu(dict: Dict): InlineKeyboard {
  const keyboard = new InlineKeyboard().text(dict.buttons.createLink, CB.goNewlink);
  return openAppButton(keyboard, dict.buttons.openDashboard, appPaths.home)
    .row()
    .text(dict.buttons.settings, CB.goSettings)
    .text(dict.buttons.language, CB.goLanguage)
    .row()
    .text(dict.buttons.close, CB.close);
}

/** /settings: everything that lives in the dashboard, opened without leaving Telegram. */
export function settingsMenu(dict: Dict, workspaceId: string | null, channels: Channel[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  openAppButton(keyboard, dict.buttons.openDashboard, appPaths.home).row();
  openAppButton(keyboard, dict.buttons.teamBranding, appPaths.team(workspaceId));
  openAppButton(keyboard, dict.buttons.billing, appPaths.billing(workspaceId)).row();
  for (const channel of channels) {
    const label = dict.buttons.channelSettings(channel.title);
    openAppButton(keyboard, label, appPaths.integrations(channel.id)).row();
  }
  return navRow(keyboard, dict);
}

/** Empty state for every screen that needs at least one connected channel. */
export function noChannelsMenu(dict: Dict, botUsername: string): InlineKeyboard {
  return new InlineKeyboard()
    .url(dict.buttons.addToChannel, addToChannelUrl(botUsername))
    .row()
    .text(dict.buttons.close, CB.close);
}

export function languageMenu(dict: Dict, current: Lang): InlineKeyboard {
  const mark = (lang: Lang) => (lang === current ? MARK_DONE : MARK_TODO);
  return new InlineKeyboard()
    .text(`${mark('en')} ${dict.buttons.english}`, CB.langSet('en'))
    .text(`${mark('ru')} ${dict.buttons.russian}`, CB.langSet('ru'))
    .row()
    .text(dict.buttons.close, CB.close);
}

export function postCreateMenu(dict: Dict): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(dict.buttons.createAnother, CB.goNewlink)
    .text(dict.buttons.viewStats, CB.goStats)
    .row();
  return openAppButton(keyboard, dict.buttons.openDashboard, appPaths.home);
}

export function cancelMenu(dict: Dict): InlineKeyboard {
  return new InlineKeyboard().text(dict.buttons.cancel, CB.nlCancel);
}

/** An optional dialog step: skipping is a first-class answer, not an abandoned flow. */
export function skipMenu(dict: Dict): InlineKeyboard {
  return new InlineKeyboard().text(dict.buttons.skip, CB.nlSkipBuyer).text(dict.buttons.cancel, CB.nlCancel);
}

/** Invite link stays the default: it is the only mode with exact attribution. */
export function linkModeMenu(dict: Dict): InlineKeyboard {
  return new InlineKeyboard()
    .text(dict.buttons.modeInvite, CB.nlMode('invite'))
    .row()
    .text(dict.buttons.modeLandingPost, CB.nlMode('post'))
    .row()
    .text(dict.buttons.cancel, CB.nlCancel);
}

/**
 * Shared by /newlink and /bulklinks: the callback prefix decides which flow the
 * picked channel continues into.
 */
export function channelPickerMenu(
  dict: Dict,
  channels: Channel[],
  toCallback: (channelId: string) => string = CB.nlPick,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of channels) {
    keyboard.text(channel.title, toCallback(channel.id)).row();
  }
  return keyboard.text(dict.buttons.cancel, CB.nlCancel);
}

export function channelsListMenu(
  dict: Dict,
  pageChannels: Channel[],
  page: number,
  totalPages: number,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of pageChannels) {
    keyboard.text(channel.title, CB.chOpen(channel.id)).row();
  }
  if (totalPages > 1) {
    if (page > 0) keyboard.text(dict.buttons.prevPage, CB.chList(page - 1));
    if (page < totalPages - 1) keyboard.text(dict.buttons.nextPage, CB.chList(page + 1));
  }
  return navRow(keyboard, dict);
}

export function channelMenu(dict: Dict, channelId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(dict.buttons.stats, CB.chStats(channelId))
    .text(dict.buttons.newLink, CB.nlPick(channelId))
    .text(dict.buttons.links, CB.chLinks(channelId))
    .row()
    .text(dict.buttons.fraudCheck, CB.frChannel(channelId))
    .row();
  // Dashboard-only features for this channel, opened as a Mini App.
  openAppButton(keyboard, dict.buttons.integrations, appPaths.integrations(channelId));
  openAppButton(keyboard, dict.buttons.postbacks, appPaths.postbacks(channelId));
  openAppButton(keyboard, dict.buttons.shareReport, appPaths.share(channelId));
  return navRow(keyboard, dict, CB.chList(0));
}

export function backToChannelMenu(dict: Dict, channelId: string): InlineKeyboard {
  return navRow(new InlineKeyboard(), dict, CB.chOpen(channelId));
}

/** /stats is a single-level screen: nothing to go back to, only a way out. */
export function statsMenu(dict: Dict): InlineKeyboard {
  const keyboard = new InlineKeyboard().text(dict.buttons.newLink, CB.goNewlink);
  return openAppButton(keyboard, dict.buttons.openDashboard, appPaths.home)
    .row()
    .text(dict.buttons.close, CB.close);
}

export function fraudChannelPickerMenu(dict: Dict, channels: Channel[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of channels) {
    keyboard.text(channel.title, CB.frChannel(channel.id)).row();
  }
  return navRow(keyboard, dict);
}

export function fraudLinksMenu(dict: Dict, links: { linkId: string; title: string }[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const link of links) {
    keyboard.text(link.title, CB.frLink(link.linkId)).row();
  }
  return navRow(keyboard, dict, CB.goFraud);
}

export function backToFraudLinksMenu(dict: Dict, channelId: string): InlineKeyboard {
  return navRow(new InlineKeyboard(), dict, CB.frChannel(channelId));
}

export interface PlanOption {
  plan: string;
  label: string;
}

/** Plans screen: one button per purchasable plan, then back to the billing overview. */
export function plansMenu(dict: Dict, options: PlanOption[], workspaceId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const option of options) {
    keyboard.text(option.label, CB.billBuy(option.plan, workspaceId)).row();
  }
  return navRow(keyboard, dict, CB.goBilling);
}

export function billingMenu(dict: Dict): InlineKeyboard {
  const keyboard = new InlineKeyboard().text(dict.buttons.upgrade, CB.goUpgrade);
  return openAppButton(keyboard, dict.buttons.openDashboard, appPaths.home)
    .row()
    .text(dict.buttons.close, CB.close);
}

/** Invoice link: Telegram opens the Stars payment sheet from a plain URL button. */
export function payMenu(dict: Dict, invoiceUrl: string): InlineKeyboard {
  return new InlineKeyboard().url(dict.buttons.pay, invoiceUrl);
}

/** Shown instead of a bare error whenever a plan limit blocks an action. */
export function upsellMenu(dict: Dict): InlineKeyboard {
  return new InlineKeyboard().text(dict.buttons.upgrade, CB.goUpgrade).text(dict.buttons.close, CB.close);
}

export function paidMenu(dict: Dict): InlineKeyboard {
  return openAppButton(new InlineKeyboard(), dict.buttons.openDashboard, appPaths.home);
}

export function notificationsMenu(
  dict: Dict,
  channels: Channel[],
  subscribedIds: Set<string>,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of channels) {
    const mark = subscribedIds.has(channel.id) ? MARK_DONE : MARK_TODO;
    keyboard.text(`${mark} ${channel.title}`, CB.ntfToggle(channel.id)).row();
  }
  return navRow(keyboard, dict);
}
