import { randomBytes } from 'node:crypto';
import { getPrisma, type ShareLink } from '@tgpulse/db';
import { getEntitlements } from './entitlements';
import { ApiError } from './http';

/**
 * Public read-only report links (docs/PHASE7-BUILD.md §2).
 *
 * A share token is a bearer credential for one channel's aggregate numbers, so:
 *  - the public endpoint returns totals only — never subscribers, revenue, keys or members;
 *  - an expired or revoked token answers 404, exactly like an unknown one, so the token
 *    space cannot be probed for hits.
 */

/** 16 bytes -> 32 hex chars. */
const TOKEN_RANDOM_BYTES = 16;
/** Guardrail against unbounded link creation; revoked links do not count. */
const MAX_ACTIVE_LINKS_PER_CHANNEL = 20;

/** Windows a share link may expose; mirrors the analytics report periods. */
export const SHARE_WINDOW_DAYS = [7, 30, 90] as const;
export type ShareWindowDays = (typeof SHARE_WINDOW_DAYS)[number];

export const MAX_SHARE_EXPIRY_DAYS = 365;
const DAY_MS = 86_400_000;

export function createShareToken(): string {
  return randomBytes(TOKEN_RANDOM_BYTES).toString('hex');
}

/** Public report URL; `/r/<token>` is the read-only page. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/r/${token}`;
}

export function shareExpiry(expiresInDays: number | undefined, now = new Date()): Date | null {
  if (expiresInDays === undefined) return null;
  return new Date(now.getTime() + expiresInDays * DAY_MS);
}

/** Throws 400 once a channel is holding too many live share links. */
export async function assertShareLinkCapacity(channelId: string): Promise<void> {
  const active = await getPrisma().shareLink.count({ where: { channelId, revokedAt: null } });
  if (active >= MAX_ACTIVE_LINKS_PER_CHANNEL) {
    throw new ApiError(
      400,
      `Channel already has ${MAX_ACTIVE_LINKS_PER_CHANNEL} active share links; revoke one first`,
    );
  }
}

export interface PublicShareLink {
  id: string;
  token: string;
  label: string | null;
  windowDays: number;
  channel: { id: string; title: string; username: string | null };
  /** Owning workspace, so the route can resolve white-label branding. */
  workspaceId: string;
}

/**
 * Resolve a public token to its channel. Unknown, revoked and expired tokens all
 * throw the same 404 so the endpoint never confirms that a token exists.
 */
export async function resolvePublicShareLink(
  token: string,
  now = new Date(),
): Promise<PublicShareLink> {
  const link = await getPrisma().shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      label: true,
      windowDays: true,
      revokedAt: true,
      expiresAt: true,
      channel: { select: { id: true, title: true, username: true, workspaceId: true } },
    },
  });

  if (!link || link.revokedAt !== null || (link.expiresAt !== null && link.expiresAt <= now)) {
    throw new ApiError(404, 'Report not found');
  }

  return {
    id: link.id,
    token: link.token,
    label: link.label,
    windowDays: link.windowDays,
    channel: { id: link.channel.id, title: link.channel.title, username: link.channel.username },
    workspaceId: link.channel.workspaceId,
  };
}

export interface ReportBrand {
  name: string;
  /** http(s) target behind the brand name; null renders plain text. */
  url: string | null;
}

/**
 * White-label identity for a public report, or null for default TGPulse branding.
 * Resolved per open on purpose: a lapsed Agency subscription drops the branding
 * on the very next view without any sweep.
 */
export async function resolveReportBrand(workspaceId: string): Promise<ReportBrand | null> {
  const workspace = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { brandName: true, brandUrl: true },
  });
  if (!workspace?.brandName) return null;

  const { features } = await getEntitlements(workspaceId);
  if (!features.whiteLabel) return null;

  return { name: workspace.brandName, url: workspace.brandUrl };
}

/** Fire-and-forget view counter: a failed increment must never break the report. */
export function recordShareView(id: string): void {
  void getPrisma()
    .shareLink.update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch((error: unknown) => {
      console.error('[share] viewCount increment failed:', error);
    });
}

/** Owner-facing shape; includes the token because the owner may re-copy the link. */
export function toShareLinkDto(link: ShareLink, origin: string) {
  return {
    id: link.id,
    channelId: link.channelId,
    label: link.label,
    token: link.token,
    url: shareUrl(origin, link.token),
    windowDays: link.windowDays,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    viewCount: link.viewCount,
    createdAt: link.createdAt,
  };
}

/**
 * Load a share link and ensure the caller may manage it; role enforcement is left to
 * the route via `assertCanMutateChannel` on the returned channel id.
 */
export async function findShareLinkOrThrow(id: string): Promise<ShareLink> {
  const link = await getPrisma().shareLink.findUnique({ where: { id } });
  if (!link) {
    throw new ApiError(404, 'Share link not found');
  }
  return link;
}
