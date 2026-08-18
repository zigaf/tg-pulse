import { createHash, randomBytes } from 'node:crypto';
import { getPrisma, type Channel, type ChannelApiKey } from '@tgpulse/db';
import { ApiError } from './http';

/**
 * Per-channel ingest keys for the sales webhook.
 *
 * Raw key format: `tgp_` + 32 lowercase hex chars (16 random bytes, 128 bits).
 * Only the sha256 of the raw key is stored; the raw value is shown once on creation.
 */

export const API_KEY_PREFIX = 'tgp_';
/** 16 bytes -> 32 hex chars. */
const KEY_RANDOM_BYTES = 16;
/** Stored identifier shown in the UI: `tgp_` + first 8 hex chars. */
const PREFIX_LENGTH = 12;
/** Guardrail against unbounded key creation; revoked keys do not count. */
const MAX_ACTIVE_KEYS_PER_CHANNEL = 5;

const RAW_KEY_PATTERN = new RegExp(`^${API_KEY_PREFIX}[0-9a-f]{${KEY_RANDOM_BYTES * 2}}$`);
const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export interface GeneratedApiKey {
  /** Full secret — returned to the caller exactly once, never stored. */
  raw: string;
  prefix: string;
  key: ChannelApiKey;
}

/** Create a new ingest key for a channel. Caller must have verified channel access. */
export async function generateChannelApiKey(channelId: string): Promise<GeneratedApiKey> {
  const prisma = getPrisma();

  const active = await prisma.channelApiKey.count({ where: { channelId, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS_PER_CHANNEL) {
    throw new ApiError(
      400,
      `Channel already has ${MAX_ACTIVE_KEYS_PER_CHANNEL} active API keys; revoke one first`,
    );
  }

  const raw = `${API_KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString('hex')}`;
  const prefix = raw.slice(0, PREFIX_LENGTH);

  const key = await prisma.channelApiKey.create({
    data: { channelId, keyHash: hashApiKey(raw), prefix },
  });

  return { raw, prefix, key };
}

/** Resolve a raw ingest key to its channel. Returns null for unknown, malformed or revoked keys. */
export async function verifyApiKey(rawKey: string): Promise<Channel | null> {
  if (!RAW_KEY_PATTERN.test(rawKey)) return null;

  const key = await getPrisma().channelApiKey.findFirst({
    where: { keyHash: hashApiKey(rawKey), revokedAt: null },
    include: { channel: true },
  });

  return key?.channel ?? null;
}

/** Idempotent: revoking an already revoked key returns it unchanged. */
export async function revokeApiKey(id: string): Promise<ChannelApiKey> {
  const prisma = getPrisma();

  const key = await prisma.channelApiKey.findUnique({ where: { id } });
  if (!key) throw new ApiError(404, 'API key not found');
  if (key.revokedAt) return key;

  return prisma.channelApiKey.update({ where: { id }, data: { revokedAt: new Date() } });
}

/**
 * Load an API key and ensure the user is a member of the workspace owning its channel.
 * Throws 404 for unknown keys, 403 for foreign ones.
 */
export async function assertApiKeyAccess(userId: string, keyId: string): Promise<ChannelApiKey> {
  const prisma = getPrisma();

  const key = await prisma.channelApiKey.findUnique({
    where: { id: keyId },
    include: { channel: { select: { workspaceId: true } } },
  });
  if (!key) {
    throw new ApiError(404, 'API key not found');
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: key.channel.workspaceId } },
  });
  if (!membership) {
    throw new ApiError(403, 'No access to this API key');
  }

  const { channel: _channel, ...rest } = key;
  return rest;
}

/** Extract the token from an `Authorization: Bearer <token>` header. */
export function bearerTokenFrom(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const match = header.trim().match(BEARER_PATTERN);
  return match ? match[1] : null;
}

/** API-safe key shape — never exposes the raw secret or its hash. */
export function toApiKeyDto(key: ChannelApiKey) {
  return {
    id: key.id,
    channelId: key.channelId,
    prefix: key.prefix,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
  };
}
