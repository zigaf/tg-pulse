import { z } from 'zod';
import { getPrisma, type AdIntegration } from '@tgpulse/db';
import { providerLabel, type AdProvider } from '@/lib/ad-providers';
import { decryptJson, DecryptionError, encryptJson } from './crypto';
import { ApiError, parseOrThrow } from './http';

/**
 * Server-side contract for native ad-platform connections (docs/AD-INTEGRATIONS.md).
 *
 * Two rules hold everywhere in this module:
 *   1. Credentials only ever travel inbound. `toIntegrationDto` returns a masked hint, never a value.
 *   2. Field names come from `@/lib/ad-providers`, so the connect form and these schemas cannot drift.
 */

/** Values are always strings, so a parsed payload drops straight into a Prisma Json column. */
export type StringMap = Record<string, string>;

export interface ProviderSpec {
  readonly provider: AdProvider;
  /** No connection possible yet; create and update refuse with 400. */
  readonly comingSoon: boolean;
  /** Credential key whose tail becomes the masked hint shown in the UI. */
  readonly secretField: string;
  parseCredentials(input: unknown): StringMap;
  parseConfig(input: unknown): StringMap;
}

// ---------- schemas ----------

const numericId = (label: string, max: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{1,${max}}$`), `${label} must be digits only`);

const secretToken = (label: string) =>
  z
    .string()
    .trim()
    .min(8, `${label} looks too short`)
    .max(4096, `${label} is too long`);

const metaCredentialsSchema = z.object({
  accessToken: secretToken('Access token'),
});

const metaConfigSchema = z.object({
  pixelId: numericId('Pixel id', 25),
  eventName: z.string().trim().min(1).max(64).default('Subscribe'),
  /** Empty means "not set": with a code the Test action posts a real event to Test Events. */
  testEventCode: z.string().trim().max(64).default(''),
});

const yandexCredentialsSchema = z.object({
  oauthToken: secretToken('OAuth token'),
});

const tiktokCredentialsSchema = z.object({
  accessToken: secretToken('Access token'),
});

/** Field names must match apps/bot/src/integrations/tiktok.ts: the validators are separate. */
const tiktokConfigSchema = z.object({
  pixelCode: z.string().trim().min(6, 'Pixel code looks too short').max(64),
  eventName: z.string().trim().min(1).max(64).default('CompleteRegistration'),
  testEventCode: z.string().trim().max(64).default(''),
});

const yandexConfigSchema = z.object({
  counterId: numericId('Counter id', 15),
  goalName: z.string().trim().min(1).max(128),
});

export type MetaConfig = z.infer<typeof metaConfigSchema>;
export type TikTokConfig = z.infer<typeof tiktokConfigSchema>;
export type YandexConfig = z.infer<typeof yandexConfigSchema>;

/** Typed reads of a stored `config` column, used by the platform test calls. */
export function parseMetaConfig(input: unknown): MetaConfig {
  return parseOrThrow(metaConfigSchema, input);
}

export function parseTikTokConfig(input: unknown): TikTokConfig {
  return parseOrThrow(tiktokConfigSchema, input);
}

export function parseYandexConfig(input: unknown): YandexConfig {
  return parseOrThrow(yandexConfigSchema, input);
}

function comingSoonSpec(provider: AdProvider): ProviderSpec {
  const refuse = (): never => {
    throw new ApiError(400, `${providerLabel(provider)} is not available yet`);
  };
  return {
    provider,
    comingSoon: true,
    secretField: '',
    parseCredentials: refuse,
    parseConfig: refuse,
  };
}

export const PROVIDER_SPECS: Record<AdProvider, ProviderSpec> = {
  META_CAPI: {
    provider: 'META_CAPI',
    comingSoon: false,
    secretField: 'accessToken',
    parseCredentials: (input) => parseOrThrow(metaCredentialsSchema, input),
    parseConfig: (input) => parseOrThrow(metaConfigSchema, input),
  },
  YANDEX_METRIKA: {
    provider: 'YANDEX_METRIKA',
    comingSoon: false,
    secretField: 'oauthToken',
    parseCredentials: (input) => parseOrThrow(yandexCredentialsSchema, input),
    parseConfig: (input) => parseOrThrow(yandexConfigSchema, input),
  },
  GOOGLE_ADS: comingSoonSpec('GOOGLE_ADS'),
  TIKTOK_EVENTS: {
    provider: 'TIKTOK_EVENTS',
    comingSoon: false,
    secretField: 'accessToken',
    parseCredentials: (input) => parseOrThrow(tiktokCredentialsSchema, input),
    parseConfig: (input) => parseOrThrow(tiktokConfigSchema, input),
  },
};

export function providerSpec(provider: AdProvider): ProviderSpec {
  const spec = PROVIDER_SPECS[provider];
  if (!spec) throw new ApiError(400, 'Unknown ad platform');
  return spec;
}

/** Refuse anything the build order has not reached yet, before touching the database. */
export function assertProviderAvailable(provider: AdProvider): void {
  if (providerSpec(provider).comingSoon) {
    throw new ApiError(400, `${providerLabel(provider)} is not available yet`);
  }
}

// ---------- credentials ----------

export function encryptCredentials(credentials: StringMap): string {
  return encryptJson(credentials);
}

/**
 * Decrypt the stored blob. Throws 409 after a key rotation so the UI can say
 * "reconnect" instead of showing a generic failure.
 */
export function decryptCredentials(integration: Pick<AdIntegration, 'credentials'>): StringMap {
  try {
    return decryptJson<StringMap>(integration.credentials);
  } catch (error) {
    if (error instanceof DecryptionError) {
      throw new ApiError(409, 'Stored credentials could not be read. Reconnect this integration.');
    }
    throw error;
  }
}

const MASK = '••••';
const HINT_TAIL = 4;

/** `•••• 4f2a`: enough to recognise which token is stored, useless to anyone else. */
export function maskSecret(value: string): string {
  const tail = value.trim().slice(-HINT_TAIL);
  return tail.length > 0 ? `${MASK} ${tail}` : MASK;
}

function credentialHint(integration: AdIntegration): string | null {
  const spec = PROVIDER_SPECS[integration.provider as AdProvider];
  if (!spec) return null;
  try {
    const credentials = decryptJson<StringMap>(integration.credentials);
    const secret = credentials[spec.secretField];
    return typeof secret === 'string' ? maskSecret(secret) : null;
  } catch {
    // A rotated ENCRYPTION_KEY makes every blob unreadable by design; the DTO says so.
    return null;
  }
}

// ---------- dto ----------

export interface IntegrationDto {
  id: string;
  channelId: string;
  provider: AdProvider;
  isActive: boolean;
  sendJoins: boolean;
  /** Non-secret settings only: pixel id, counter id, goal name. */
  config: StringMap;
  /** Masked tail of the stored secret, or null when it cannot be read. */
  credentialHint: string | null;
  /** True when the stored blob no longer decrypts, so the user must reconnect. */
  needsReconnect: boolean;
  lastSyncAt: Date | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toStringMap(value: unknown): StringMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item ?? '')]),
  );
}

/** The only shape any integration endpoint may return. Credentials are never part of it. */
export function toIntegrationDto(integration: AdIntegration): IntegrationDto {
  const hint = credentialHint(integration);
  return {
    id: integration.id,
    channelId: integration.channelId,
    provider: integration.provider as AdProvider,
    isActive: integration.isActive,
    sendJoins: integration.sendJoins,
    config: toStringMap(integration.config),
    credentialHint: hint,
    needsReconnect: hint === null,
    lastSyncAt: integration.lastSyncAt,
    lastStatus: integration.lastStatus,
    lastError: integration.lastError,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

// ---------- access ----------

/**
 * Load an integration and ensure the caller is a member of the workspace owning its channel.
 * Throws 404 for unknown ids, 403 for foreign ones. Mutation still needs `assertCanMutateChannel`.
 */
export async function assertIntegrationAccess(
  userId: string,
  integrationId: string,
): Promise<AdIntegration> {
  const prisma = getPrisma();

  const integration = await prisma.adIntegration.findUnique({
    where: { id: integrationId },
    include: { channel: { select: { workspaceId: true } } },
  });
  if (!integration) {
    throw new ApiError(404, 'Integration not found');
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: integration.channel.workspaceId } },
  });
  if (!membership) {
    throw new ApiError(403, 'No access to this integration');
  }

  const { channel: _channel, ...rest } = integration;
  return rest;
}

// ---------- health ----------

export const HEALTH_WINDOW_DAYS = 7;

export interface UploadCounters {
  pending: number;
  sent: number;
  failed: number;
}

export interface IntegrationHealth {
  integrationId: string;
  provider: AdProvider;
  isActive: boolean;
  lastSyncAt: Date | null;
  lastStatus: string | null;
  lastError: string | null;
  uploads: UploadCounters;
}

const EMPTY_COUNTERS: UploadCounters = { pending: 0, sent: 0, failed: 0 };

/**
 * Delivery counters per integration over the health window, plus the last outcome
 * the worker recorded. One grouped query covers every integration of the channel.
 */
export async function getChannelIntegrationHealth(channelId: string): Promise<IntegrationHealth[]> {
  const prisma = getPrisma();

  const integrations = await prisma.adIntegration.findMany({
    where: { channelId },
    orderBy: { createdAt: 'asc' },
  });
  if (integrations.length === 0) return [];

  const since = new Date(Date.now() - HEALTH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const groups = await prisma.conversionUpload.groupBy({
    by: ['integrationId', 'status'],
    where: { integrationId: { in: integrations.map((item) => item.id) }, createdAt: { gte: since } },
    _count: { _all: true },
  });

  const counters = new Map<string, UploadCounters>();
  for (const group of groups) {
    const current = counters.get(group.integrationId) ?? { ...EMPTY_COUNTERS };
    if (group.status === 'PENDING') current.pending = group._count._all;
    if (group.status === 'SENT') current.sent = group._count._all;
    if (group.status === 'FAILED') current.failed = group._count._all;
    counters.set(group.integrationId, current);
  }

  return integrations.map((integration) => ({
    integrationId: integration.id,
    provider: integration.provider as AdProvider,
    isActive: integration.isActive,
    lastSyncAt: integration.lastSyncAt,
    lastStatus: integration.lastStatus,
    lastError: integration.lastError,
    uploads: counters.get(integration.id) ?? { ...EMPTY_COUNTERS },
  }));
}
