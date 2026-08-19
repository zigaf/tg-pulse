import { escapeHtml } from '../format';
import type { Dict } from '../i18n';
import { card } from '../ui';

const ICON_LINK = '🔗';

export interface CreatedLink {
  channelTitle: string;
  label: string;
  goUrl: string;
  /** Null in landing-post mode, where no invite link is issued. */
  inviteLink: string | null;
  targetPostUrl: string | null;
  buyer: string | null;
  sourceCount: number;
}

export function pickChannelCard(dict: Dict): string {
  return card({ icon: ICON_LINK, title: dict.newlink.title, footer: dict.newlink.pickChannel });
}

/** Every question of the flow looks the same: one instruction, one hint, same crumbs. */
function stepCard(dict: Dict, channelTitle: string, body: string, footer: string): string {
  return card({
    icon: ICON_LINK,
    title: dict.newlink.title,
    crumbs: [dict.nav.channels, escapeHtml(channelTitle)],
    body: [body],
    footer,
  });
}

export function askLabelCard(dict: Dict, channelTitle: string): string {
  return stepCard(dict, channelTitle, dict.newlink.askLabel, dict.newlink.labelFooter);
}

export function askModeCard(dict: Dict, channelTitle: string): string {
  return stepCard(dict, channelTitle, dict.newlink.askMode, dict.newlink.modeFooter);
}

export function askPostUrlCard(dict: Dict, channelTitle: string): string {
  return stepCard(dict, channelTitle, dict.newlink.askPostUrl, dict.newlink.postUrlFooter);
}

export function askBuyerCard(dict: Dict, channelTitle: string): string {
  return stepCard(dict, channelTitle, dict.newlink.askBuyer, dict.newlink.buyerFooter);
}

/** The result card doubles as the record of what was created: mode and caveat included. */
export function createdCard(dict: Dict, link: CreatedLink): string {
  const isLandingPost = link.targetPostUrl !== null;
  const body = [`${dict.newlink.label}: <b>${escapeHtml(link.label)}</b>`];

  if (link.buyer) body.push(`${dict.links.buyer}: <b>${escapeHtml(link.buyer)}</b>`);
  body.push(
    `${dict.links.mode}: ${isLandingPost ? dict.links.modeLandingPost : dict.links.modeInvite}`,
    `${dict.newlink.trackingUrl}: <code>${escapeHtml(link.goUrl)}</code>`,
  );
  if (link.inviteLink) {
    body.push(`${dict.newlink.inviteLink}: <code>${escapeHtml(link.inviteLink)}</code>`);
  }
  if (link.targetPostUrl) {
    body.push(
      `${dict.links.landingPost}: <code>${escapeHtml(link.targetPostUrl)}</code>`,
      '',
      dict.links.landingPostWarning,
    );
  }

  return card({
    icon: ICON_LINK,
    title: dict.newlink.createdTitle,
    crumbs: [dict.nav.channels, escapeHtml(link.channelTitle)],
    body,
    footer: dict.newlink.createdFooter(link.sourceCount),
  });
}
