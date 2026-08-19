import { randomBytes } from 'node:crypto';
import { getPrisma, type WorkspaceInvite } from '@tgpulse/db';
import { ApiError } from './http';

/**
 * One-time workspace invites (docs/PHASE7-BUILD.md §1).
 *
 * Token: 16 random bytes rendered as 32 lowercase hex chars, unique in the table.
 * An invite is *pending* while it has not been accepted and has not expired; pending
 * invites hold a seat, so they count against the `members` quota.
 */

/** 16 bytes -> 32 hex chars. */
const TOKEN_RANDOM_BYTES = 16;
export const INVITE_TTL_DAYS = 7;
const DAY_MS = 86_400_000;

export function createInviteToken(): string {
  return randomBytes(TOKEN_RANDOM_BYTES).toString('hex');
}

export function inviteExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
}

/** Public accept URL; `/invite/<token>` is the page that calls the accept endpoint. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/invite/${token}`;
}

/** Seats already promised to someone who has not joined yet. */
export async function countPendingInvites(workspaceId: string, now = new Date()): Promise<number> {
  return getPrisma().workspaceInvite.count({
    where: { workspaceId, acceptedAt: null, expiresAt: { gt: now } },
  });
}

export async function findPendingInvites(
  workspaceId: string,
  now = new Date(),
): Promise<WorkspaceInvite[]> {
  return getPrisma().workspaceInvite.findMany({
    where: { workspaceId, acceptedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findInviteOrThrow(id: string): Promise<WorkspaceInvite> {
  const invite = await getPrisma().workspaceInvite.findUnique({ where: { id } });
  if (!invite) {
    throw new ApiError(404, 'Invite not found');
  }
  return invite;
}

/** Spent or expired invites are gone for good: 410, not 404, so the UI can explain why. */
export async function findAcceptableInviteOrThrow(
  token: string,
  now = new Date(),
): Promise<WorkspaceInvite> {
  const invite = await getPrisma().workspaceInvite.findUnique({ where: { token } });
  if (!invite) {
    throw new ApiError(404, 'Invite not found');
  }
  if (invite.acceptedAt !== null || invite.expiresAt <= now) {
    throw new ApiError(410, 'This invite link is no longer valid');
  }
  return invite;
}

/** API-safe invite shape; the token is only useful to whoever may re-share the link. */
export function toInviteDto(invite: WorkspaceInvite, origin: string) {
  return {
    id: invite.id,
    role: invite.role,
    token: invite.token,
    url: inviteUrl(origin, invite.token),
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}
