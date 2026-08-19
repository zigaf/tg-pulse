import cron from 'node-cron';
import { getPrisma, AdProvider, Prisma } from '@tgpulse/db';
import { decryptSecret } from './crypto';
import { getAdapter } from './integrations';
import { MAX_ERROR_LENGTH } from './integrations/parse';
import type { AdAdapter, ConversionPayload } from './integrations/types';
import {
  claimBatch,
  markFailed,
  markSent,
  persistFailures,
  recordIntegrationRun,
  toConversionRow,
} from './outbox-store';

/**
 * Conversion outbox: the bridge between an attributed join and the ad platform
 * that paid for it. Rows are written synchronously with the join, so a platform
 * outage delays a conversion but never loses it.
 */

const prisma = getPrisma();

const CLICK_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const META_CRON = '* * * * *'; // Meta batches are cheap, keep latency low
const YANDEX_CRON = '*/15 * * * *'; // Metrica needs up to 2h to process anyway

interface LinkRef {
  id: string;
  slug: string;
  label: string;
}

interface ClickRow {
  ts: Date;
  adClickIds: unknown;
}

type AdClickIds = Pick<ConversionPayload, 'fbclid' | 'yclid' | 'gclid' | 'ttclid'>;

/** The click id each platform matches on; a row without it can never convert. */
const PROVIDER_CLICK_ID: Record<AdProvider, keyof AdClickIds> = {
  [AdProvider.META_CAPI]: 'fbclid',
  [AdProvider.YANDEX_METRIKA]: 'yclid',
  [AdProvider.GOOGLE_ADS]: 'gclid',
  [AdProvider.TIKTOK_EVENTS]: 'ttclid',
};

function errorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH - 1)}…` : text;
}

// ---------- Enqueue ----------

function readAdClickIds(click: ClickRow | null): AdClickIds {
  const raw = click?.adClickIds;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return raw as AdClickIds;
}

/** Non-secret context the adapters need, snapshotted at join time. */
function buildPayload(click: ClickRow | null, link: LinkRef | null): ConversionPayload {
  const ids = readAdClickIds(click);
  return {
    ...(ids.fbclid ? { fbclid: ids.fbclid } : {}),
    ...(ids.yclid ? { yclid: ids.yclid } : {}),
    ...(ids.gclid ? { gclid: ids.gclid } : {}),
    ...(ids.ttclid ? { ttclid: ids.ttclid } : {}),
    ...(click ? { clickTsMs: click.ts.getTime() } : {}),
    ...(link ? { linkSlug: link.slug, linkLabel: link.label } : {}),
  };
}

/**
 * Create one outbox row per active integration of the channel.
 * `eventKey` is the platform dedup key, so a rejoin never double-counts.
 * Never throws: conversion delivery must not break attribution handling.
 */
export async function enqueueConversions(
  channelId: string,
  subscriberId: string,
  link: LinkRef | null,
  clickRow: ClickRow | null,
): Promise<void> {
  try {
    const integrations = await prisma.adIntegration.findMany({
      where: { channelId, isActive: true, sendJoins: true },
      select: { id: true, provider: true },
    });
    if (integrations.length === 0) return;

    const payload = buildPayload(clickRow, link);
    const occurredAt = new Date();

    for (const integration of integrations) {
      const eventKey = `${subscriberId}:${integration.id}`;
      await prisma.conversionUpload.upsert({
        where: { integrationId_eventKey: { integrationId: integration.id, eventKey } },
        // Already owed: keep the original attempt history, the platform dedups.
        update: {},
        create: {
          integrationId: integration.id,
          eventKey,
          clickId: payload[PROVIDER_CLICK_ID[integration.provider]] ?? null,
          occurredAt,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    }
  } catch (e) {
    console.error(`[conversions] enqueue failed: ${errorMessage(e)}`);
  }
}

/** Latest click of the link carrying ad click ids, within the attribution window. */
async function findAttributionClick(linkId: string): Promise<ClickRow | null> {
  return prisma.click.findFirst({
    where: {
      linkId,
      ts: { gte: new Date(Date.now() - CLICK_LOOKBACK_MS) },
      adClickIds: { not: Prisma.AnyNull },
    },
    orderBy: { ts: 'desc' },
    select: { ts: true, adClickIds: true },
  });
}

/**
 * Join-time entry point used by the bot: resolves the click that carried the ad
 * click ids, then queues the conversion. Costs one COUNT when the channel has
 * no integrations, which is the common case.
 */
export async function enqueueJoinConversions(
  channelId: string,
  subscriberId: string,
  link: LinkRef | null,
): Promise<void> {
  try {
    const active = await prisma.adIntegration.count({
      where: { channelId, isActive: true, sendJoins: true },
    });
    if (active === 0) return;

    const click = link ? await findAttributionClick(link.id) : null;
    await enqueueConversions(channelId, subscriberId, link, click);
  } catch (e) {
    console.error(`[conversions] join enqueue failed: ${errorMessage(e)}`);
  }
}

// ---------- Outbox drain ----------

async function drainIntegration(
  integration: { id: string; credentials: string; config: Prisma.JsonValue },
  adapter: AdAdapter,
): Promise<void> {
  const rows = await claimBatch(integration.id, adapter.batchSize);
  if (rows.length === 0) return;

  const idByEventKey = new Map(rows.map((row) => [row.eventKey, row.id]));

  try {
    adapter.validateConfig(integration.config);
    const creds = decryptSecret(integration.credentials);
    const result = await adapter.send(rows.map(toConversionRow), creds, integration.config);

    const sentIds = result.sent
      .map((eventKey) => idByEventKey.get(eventKey))
      .filter((id): id is string => Boolean(id));

    // Anything the adapter did not account for is retried rather than lost.
    const accounted = new Set([...result.sent, ...result.failed.map((f) => f.eventKey)]);
    const unaccounted = rows
      .filter((row) => !accounted.has(row.eventKey))
      .map((row) => ({ eventKey: row.eventKey, error: 'platform did not acknowledge the event' }));

    await markSent(sentIds);
    await persistFailures([...result.failed, ...unaccounted], idByEventKey);

    const failures = [...result.failed, ...unaccounted];
    await recordIntegrationRun(
      integration.id,
      failures.length === 0 ? 'ok' : sentIds.length > 0 ? 'partial' : 'error',
      failures[0]?.error ?? null,
    );
  } catch (e) {
    // Bad config, undecryptable credentials or a transport failure: the whole
    // batch is retried, with the reason visible on the integration.
    const message = errorMessage(e);
    await markFailed([...idByEventKey.values()], message, false);
    await recordIntegrationRun(integration.id, 'error', message);
    console.error(`[conversions] ${adapter.provider} ${integration.id}: ${message}`);
  }
}

/** Deliver everything owed for one provider. Never throws. */
export async function drainOutbox(provider: AdProvider): Promise<void> {
  const adapter = getAdapter(provider);
  if (!adapter) return;

  try {
    const integrations = await prisma.adIntegration.findMany({
      where: { provider, isActive: true },
      select: { id: true, credentials: true, config: true },
    });

    for (const integration of integrations) {
      await drainIntegration(integration, adapter);
    }
  } catch (e) {
    console.error(`[conversions] drain ${provider} failed: ${errorMessage(e)}`);
  }
}

// ---------- Scheduling ----------

/** A slow run must not stack on top of the next tick. */
const draining = new Set<AdProvider>();

function scheduleDrain(provider: AdProvider, expression: string): void {
  cron.schedule(
    expression,
    () => {
      if (draining.has(provider)) return;
      draining.add(provider);
      void drainOutbox(provider).finally(() => draining.delete(provider));
    },
    { timezone: 'Etc/UTC' },
  );
}

export function startConversionCrons(): void {
  scheduleDrain(AdProvider.META_CAPI, META_CRON);
  scheduleDrain(AdProvider.YANDEX_METRIKA, YANDEX_CRON);
}
