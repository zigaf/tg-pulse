import { InlineKeyboard } from 'grammy';
import type { Channel } from '@tgpulse/db';
import { config } from './config';
import { texts } from './texts';

/** Central callback-data map. Every callback the bot handles is built from here. */
export const CB = {
  goNewlink: 'go:newlink',
  goStats: 'go:stats',
  nlPick: (channelId: string) => `nl:pick:${channelId}`,
  nlCancel: 'nl:cancel',
  chList: (page: number) => `ch:list:${page}`,
  chOpen: (channelId: string) => `ch:open:${channelId}`,
  chStats: (channelId: string) => `ch:stats:${channelId}`,
  chLinks: (channelId: string) => `ch:links:${channelId}`,
  ntfToggle: (channelId: string) => `ntf:${channelId}`,
  goFraud: 'go:fraud',
  frChannel: (channelId: string) => `fr:ch:${channelId}`,
  frLink: (linkId: string) => `fr:link:${linkId}`,
} as const;

export const CHANNELS_PAGE_SIZE = 5;

function addToChannelUrl(botUsername: string): string {
  return `https://t.me/${botUsername}?startchannel&admin=invite_users`;
}

export function startMenu(botUsername: string): InlineKeyboard {
  return new InlineKeyboard()
    .url(texts.buttons.addToChannel, addToChannelUrl(botUsername))
    .row()
    .text(texts.buttons.createLink, CB.goNewlink)
    .text(texts.buttons.myStats, CB.goStats)
    .row()
    .url(texts.buttons.openDashboard, config.dashboardUrl);
}

export function helpMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text(texts.buttons.createLink, CB.goNewlink)
    .url(texts.buttons.openDashboard, config.dashboardUrl);
}

export function postCreateMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text(texts.buttons.createAnother, CB.goNewlink)
    .text(texts.buttons.viewStats, CB.goStats)
    .row()
    .url(texts.buttons.openDashboard, config.dashboardUrl);
}

export function cancelMenu(): InlineKeyboard {
  return new InlineKeyboard().text(texts.buttons.cancel, CB.nlCancel);
}

export function channelPickerMenu(channels: Channel[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of channels) {
    keyboard.text(channel.title, CB.nlPick(channel.id)).row();
  }
  return keyboard.text(texts.buttons.cancel, CB.nlCancel);
}

export function channelsListMenu(pageChannels: Channel[], page: number, totalPages: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of pageChannels) {
    keyboard.text(channel.title, CB.chOpen(channel.id)).row();
  }
  if (totalPages > 1) {
    if (page > 0) keyboard.text(texts.buttons.prevPage, CB.chList(page - 1));
    if (page < totalPages - 1) keyboard.text(texts.buttons.nextPage, CB.chList(page + 1));
  }
  return keyboard;
}

export function channelMenu(channelId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(texts.buttons.stats, CB.chStats(channelId))
    .text(texts.buttons.newLink, CB.nlPick(channelId))
    .text(texts.buttons.links, CB.chLinks(channelId))
    .row()
    .text(texts.buttons.back, CB.chList(0));
}

export function backToChannelMenu(channelId: string): InlineKeyboard {
  return new InlineKeyboard().text(texts.buttons.back, CB.chOpen(channelId));
}

export function fraudChannelPickerMenu(channels: Channel[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of channels) {
    keyboard.text(channel.title, CB.frChannel(channel.id)).row();
  }
  return keyboard;
}

export function fraudLinksMenu(links: { linkId: string; title: string }[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const link of links) {
    keyboard.text(link.title, CB.frLink(link.linkId)).row();
  }
  return keyboard.text(texts.buttons.back, CB.goFraud);
}

export function backToFraudLinksMenu(channelId: string): InlineKeyboard {
  return new InlineKeyboard().text(texts.buttons.back, CB.frChannel(channelId));
}

export function notificationsMenu(channels: Channel[], subscribedIds: Set<string>): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of channels) {
    const state = subscribedIds.has(channel.id) ? 'on' : 'off';
    keyboard.text(`${channel.title}: ${state}`, CB.ntfToggle(channel.id)).row();
  }
  return keyboard;
}
