import { randomBytes } from 'node:crypto';
import { getPrisma, type TrackedLink } from '@tgpulse/db';
import { config } from './config';

/**
 * Creation of tracked links, shared by the single-link (/newlink) and the
 * batch (/bulklinks) flows so both write exactly the same row shape.
 */

const prisma = getPrisma();

const SLUG_LENGTH = 8;
const SLUG_MAX_ATTEMPTS = 5;

/** Telegram limit for the name of an invite link. */
export const INVITE_LINK_NAME_MAX = 32;

export interface NewLinkInput {
  channelId: string;
  label: string;
  /** Unique t.me/+... invite. Null in landing-post mode, where nobody joins through it. */
  inviteLink?: string | null;
  /** Landing-post mode target; validated against the channel before it gets here. */
  targetPostUrl?: string | null;
  buyer?: string | null;
}

/** Random url-safe slug: 6 random bytes -> exactly 8 base64url characters. */
export function generateSlug(): string {
  return randomBytes(6).toString('base64url').slice(0, SLUG_LENGTH);
}

/** Public tracking URL of a slug, the value users paste into an ad manager. */
export function goUrl(slug: string): string {
  return `${config.goBaseUrl}/l/${slug}`;
}

/** Invite link names are cut to what Telegram accepts, never rejected. */
export function inviteLinkName(label: string): string {
  return label.slice(0, INVITE_LINK_NAME_MAX);
}

/** Insert one tracked link, retrying on a slug collision. Null when every attempt collided. */
export async function createTrackedLink(input: NewLinkInput): Promise<TrackedLink | null> {
  for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.trackedLink.create({
        data: {
          slug: generateSlug(),
          channelId: input.channelId,
          label: input.label,
          inviteLink: input.inviteLink ?? null,
          targetPostUrl: input.targetPostUrl ?? null,
          buyer: input.buyer ?? null,
        },
      });
    } catch (error) {
      // P2002 = unique constraint violation (slug collision) -> retry with a new slug
      const isSlugCollision =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
      if (!isSlugCollision) throw error;
    }
  }
  return null;
}
