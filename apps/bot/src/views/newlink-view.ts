import { escapeHtml } from '../format';
import type { Dict } from '../i18n';
import { card } from '../ui';

const ICON_LINK = '🔗';

export interface CreatedLink {
  channelTitle: string;
  label: string;
  goUrl: string;
  inviteLink: string;
  sourceCount: number;
}

export function pickChannelCard(dict: Dict): string {
  return card({ icon: ICON_LINK, title: dict.newlink.title, footer: dict.newlink.pickChannel });
}

export function askLabelCard(dict: Dict, channelTitle: string): string {
  return card({
    icon: ICON_LINK,
    title: dict.newlink.title,
    crumbs: [dict.nav.channels, escapeHtml(channelTitle)],
    body: [dict.newlink.askLabel],
    footer: dict.newlink.labelFooter,
  });
}

export function createdCard(dict: Dict, link: CreatedLink): string {
  return card({
    icon: ICON_LINK,
    title: dict.newlink.createdTitle,
    crumbs: [dict.nav.channels, escapeHtml(link.channelTitle)],
    body: [
      `${dict.newlink.label}: <b>${escapeHtml(link.label)}</b>`,
      `${dict.newlink.trackingUrl}: <code>${escapeHtml(link.goUrl)}</code>`,
      `${dict.newlink.inviteLink}: <code>${escapeHtml(link.inviteLink)}</code>`,
    ],
    footer: dict.newlink.createdFooter(link.sourceCount),
  });
}
