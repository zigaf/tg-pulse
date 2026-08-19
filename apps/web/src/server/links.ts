import type { TrackedLink } from '@tgpulse/db';
import { requireEnv } from './env';

export interface LinkStats {
  clicks: number;
  joins: number;
  leaves: number;
}

/** Public tracking URL served by the bot's go-redirect. */
export function trackedLinkUrl(slug: string): string {
  return `${requireEnv('GO_BASE_URL').replace(/\/+$/, '')}/l/${slug}`;
}

/** API-safe tracked link shape shared by GET and POST /channels/:id/links. */
export function toLinkDto(link: TrackedLink, stats: LinkStats) {
  return {
    id: link.id,
    slug: link.slug,
    url: trackedLinkUrl(link.slug),
    label: link.label,
    creative: link.creative,
    buyer: link.buyer,
    utmSource: link.utmSource,
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    inviteLink: link.inviteLink,
    isRevoked: link.isRevoked,
    clicks: stats.clicks,
    joins: stats.joins,
    leaves: stats.leaves,
    createdAt: link.createdAt,
  };
}
