import { getPrisma, Prisma, UploadStatus } from '@tgpulse/db';
import type { ConversionPayload, ConversionRow, FailedConversion } from './integrations/types';

/**
 * Persistence for the conversion outbox: claiming due rows, recording outcomes.
 * Kept apart from the delivery flow so the retry/backoff rules live in one place.
 */

const prisma = getPrisma();

/** Stop retrying after this many attempts; the row stays FAILED for the dashboard. */
export const MAX_ATTEMPTS = 6;
const BACKOFF_UNIT_MS = 60_000;

/**
 * Backoff windows expressed as SQL: an attempt-`n` row becomes eligible again
 * `2^n` minutes after it was created. The schema is frozen, so `createdAt` is
 * the only timestamp usable as the retry anchor.
 */
function retryWindows(now: Date): Prisma.ConversionUploadWhereInput[] {
  const windows: Prisma.ConversionUploadWhereInput[] = [{ attempts: 0 }];
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
    windows.push({
      attempts: attempt,
      createdAt: { lte: new Date(now.getTime() - 2 ** attempt * BACKOFF_UNIT_MS) },
    });
  }
  return windows;
}

/** Oldest due rows of one integration, up to what the platform accepts at once. */
export async function claimBatch(integrationId: string, batchSize: number) {
  return prisma.conversionUpload.findMany({
    where: {
      integrationId,
      status: { in: [UploadStatus.PENDING, UploadStatus.FAILED] },
      OR: retryWindows(new Date()),
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
    select: { id: true, eventKey: true, clickId: true, occurredAt: true, payload: true },
  });
}

export type OutboxRow = Awaited<ReturnType<typeof claimBatch>>[number];

export function toConversionRow(row: OutboxRow): ConversionRow {
  const payload =
    typeof row.payload === 'object' && row.payload !== null && !Array.isArray(row.payload)
      ? (row.payload as ConversionPayload)
      : {};
  return { eventKey: row.eventKey, clickId: row.clickId, occurredAt: row.occurredAt, payload };
}

export async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.conversionUpload.updateMany({
    where: { id: { in: ids } },
    data: {
      status: UploadStatus.SENT,
      sentAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  });
}

/**
 * Permanent failures are parked at the attempt ceiling instead of burning five
 * more useless rounds: a click id that was never captured will not appear later.
 */
export async function markFailed(ids: string[], error: string, permanent: boolean): Promise<void> {
  if (ids.length === 0) return;
  await prisma.conversionUpload.updateMany({
    where: { id: { in: ids } },
    data: {
      status: UploadStatus.FAILED,
      lastError: error,
      ...(permanent ? { attempts: MAX_ATTEMPTS } : { attempts: { increment: 1 } }),
    },
  });
}

/** Group failures by message so N rows sharing one cause cost one UPDATE. */
export async function persistFailures(
  failures: FailedConversion[],
  idByEventKey: Map<string, string>,
): Promise<void> {
  const groups = new Map<string, { ids: string[]; error: string; permanent: boolean }>();

  for (const failure of failures) {
    const id = idByEventKey.get(failure.eventKey);
    if (!id) continue;
    const key = `${failure.permanent ? 'p' : 't'}|${failure.error}`;
    const group = groups.get(key) ?? {
      ids: [],
      error: failure.error,
      permanent: Boolean(failure.permanent),
    };
    group.ids.push(id);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    await markFailed(group.ids, group.error, group.permanent);
  }
}

/** Surface the last outcome on the integration so the dashboard can show it. */
export async function recordIntegrationRun(
  integrationId: string,
  status: string,
  error: string | null,
): Promise<void> {
  await prisma.adIntegration
    .update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), lastStatus: status, lastError: error },
    })
    .catch(() => {
      // integration may have been deleted mid-flight; nothing to record
    });
}
