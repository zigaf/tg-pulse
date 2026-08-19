import type { Channel } from '@tgpulse/db';
import { escapeHtml } from '../format';
import type { Dict } from '../i18n';
import { bar, card } from '../ui';

const ICON_CHANNELS = '📣';
const ICON_LINKS = '🔗';
const BAR_WIDTH = 8;

export interface LinkRow {
  label: string;
  clicks: number;
  joins: number;
  goUrl: string;
  isRevoked: boolean;
}

export function channelsListCard(dict: Dict, page: number, totalPages: number): string {
  return card({
    icon: ICON_CHANNELS,
    title: dict.channels.title,
    crumbs: totalPages > 1 ? [dict.channels.page(page + 1, totalPages)] : undefined,
    footer: dict.channels.pickHint,
  });
}

export function channelCard(dict: Dict, channel: Channel): string {
  const handle = channel.username ? ` (@${escapeHtml(channel.username)})` : '';
  return card({
    icon: ICON_CHANNELS,
    title: `${escapeHtml(channel.title)}${handle}`,
    crumbs: [dict.nav.channels],
    footer: dict.channels.menuFooter,
  });
}

/** Channels › <channel> › Links. Bars rank the links against the strongest one. */
export function linksCard(dict: Dict, channel: Channel, links: LinkRow[]): string {
  const crumbs = [dict.nav.channels, escapeHtml(channel.title)];

  if (links.length === 0) {
    return card({
      icon: ICON_LINKS,
      title: dict.channels.linksTitle,
      crumbs,
      body: [dict.channels.linksEmpty],
      footer: dict.channels.linksEmptyFooter,
    });
  }

  const topJoins = Math.max(...links.map((link) => link.joins));
  const body = links.flatMap((link, index) => {
    const revoked = link.isRevoked ? ` (${dict.channels.revoked})` : '';
    const counts = `${dict.channels.joins(link.joins)} · ${dict.channels.clicks(link.clicks)}`;
    return [
      ...(index === 0 ? [] : ['']),
      `${index + 1}. <b>${escapeHtml(link.label)}</b>${revoked}`,
      `<code>${bar(link.joins, topJoins, BAR_WIDTH)}</code> ${counts}`,
      `<code>${escapeHtml(link.goUrl)}</code>`,
    ];
  });

  return card({ icon: ICON_LINKS, title: dict.channels.linksTitle, crumbs, body, footer: dict.channels.linksFooter });
}
