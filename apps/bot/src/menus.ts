import { InlineKeyboard } from 'grammy';
import type { Channel } from '@tgpulse/db';
import { config } from './config';
import type { Dict, Lang } from './i18n';

/** Central callback-data map. Every callback the bot handles is built from here. */
export const CB = {
  goNewlink: 'go:newlink',
  goStats: 'go:stats',
  goFraud: 'go:fraud',
  goLanguage: 'go:lang',
  close: 'ui:close',
  langSet: (lang: Lang) => `lang:set:${lang}`,
  nlPick: (channelId: string) => `nl:pick:${channelId}`,
  nlCancel: 'nl:cancel',
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

  return keyboard
    .url(dict.buttons.openDashboard, config.dashboardUrl)
    .text(dict.buttons.language, CB.goLanguage);
}

export function helpMenu(dict: Dict): InlineKeyboard {
  return new InlineKeyboard()
    .text(dict.buttons.createLink, CB.goNewlink)
    .url(dict.buttons.openDashboard, config.dashboardUrl)
    .row()
    .text(dict.buttons.language, CB.goLanguage)
    .text(dict.buttons.close, CB.close);
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
  return new InlineKeyboard()
    .text(dict.buttons.createAnother, CB.goNewlink)
    .text(dict.buttons.viewStats, CB.goStats)
    .row()
    .url(dict.buttons.openDashboard, config.dashboardUrl);
}

export function cancelMenu(dict: Dict): InlineKeyboard {
  return new InlineKeyboard().text(dict.buttons.cancel, CB.nlCancel);
}

export function channelPickerMenu(dict: Dict, channels: Channel[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of channels) {
    keyboard.text(channel.title, CB.nlPick(channel.id)).row();
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
    .text(dict.buttons.fraudCheck, CB.frChannel(channelId));
  return navRow(keyboard, dict, CB.chList(0));
}

export function backToChannelMenu(dict: Dict, channelId: string): InlineKeyboard {
  return navRow(new InlineKeyboard(), dict, CB.chOpen(channelId));
}

/** /stats is a single-level screen: nothing to go back to, only a way out. */
export function statsMenu(dict: Dict): InlineKeyboard {
  return new InlineKeyboard()
    .text(dict.buttons.newLink, CB.goNewlink)
    .url(dict.buttons.openDashboard, config.dashboardUrl)
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
  return new InlineKeyboard()
    .text(dict.buttons.upgrade, CB.goUpgrade)
    .url(dict.buttons.openDashboard, config.dashboardUrl)
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
  return new InlineKeyboard().url(dict.buttons.openDashboard, config.dashboardUrl);
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
