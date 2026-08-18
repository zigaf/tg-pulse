import { getPrisma, Prisma, SaleKind, type SaleEvent } from '@tgpulse/db';
import { ApiError } from './http';
import { parseCsv, recordToObject } from './csv';

/**
 * Revenue ingest: turns raw sale rows (webhook or CSV) into SaleEvent records,
 * attributing each one to the tracked link that brought the buyer.
 *
 * Attribution is resolved and frozen at ingest time: we copy the matched
 * Subscriber's `linkId` onto the SaleEvent so later re-attribution of the
 * subscriber cannot silently rewrite historical revenue reports.
 *
 * Sign convention: amounts are always stored non-negative. A refund is
 * `kind: REFUND` with a positive amount; the analytics layer subtracts it.
 */

export const MAX_SALE_EVENTS_PER_REQUEST = 500;
export const MAX_CSV_ROWS = 5_000;

/** Fits `Decimal(12, 2)`: 10 integer digits + 2 decimals. */
const MAX_AMOUNT = '9999999999.99';
const AMOUNT_SCALE = 2;
const MAX_EXTERNAL_ID_LENGTH = 128;
const MAX_USERNAME_LENGTH = 64;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export const DEFAULT_CURRENCY = 'USD';
export const SALE_KINDS = ['LEAD', 'PURCHASE', 'REFUND'] as const;
export type SaleKindName = (typeof SALE_KINDS)[number];

/** A validated, ready-to-persist sale row. */
export interface SaleEventInput {
  tgUserId: bigint | null;
  username: string | null;
  amount: Prisma.Decimal;
  currency: string;
  kind: SaleKind;
  externalId: string | null;
  occurredAt: Date;
}

export interface IngestResult {
  /** Rows that passed validation and were written (created or deduplicated). */
  accepted: number;
  /** Rows whose buyer was found among the channel's subscribers. */
  matched: number;
  /** Rows that hit an existing (channelId, externalId) pair. */
  duplicates: number;
}

// ---------- field parsing ----------

/** Postgres BIGINT upper bound — the column type behind `tg_user_id`. */
const MAX_TG_USER_ID = 9223372036854775807n;

/** Telegram ids arrive as number or string; both must be positive integers. */
export function parseTgUserId(value: string | number): bigint {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!/^\d{1,19}$/.test(raw)) {
    throw new ApiError(400, 'tgUserId must be a positive integer');
  }
  const parsed = BigInt(raw);
  if (parsed <= 0n || parsed > MAX_TG_USER_ID) {
    throw new ApiError(400, 'tgUserId must be a positive integer');
  }
  return parsed;
}

export function parseUsername(value: string): string {
  const username = value.trim().replace(/^@/, '');
  if (username.length === 0 || username.length > MAX_USERNAME_LENGTH) {
    throw new ApiError(400, `username must be 1-${MAX_USERNAME_LENGTH} characters`);
  }
  return username;
}

/** Money is normalized to 2 decimals; refunds use kind=REFUND, not a negative amount. */
export function parseAmount(value: string | number): Prisma.Decimal {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new ApiError(400, 'amount must be a finite number');
  }

  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new ApiError(400, 'amount must be a number');
  }

  if (!amount.isFinite() || amount.isNaN()) {
    throw new ApiError(400, 'amount must be a finite number');
  }
  if (amount.isNegative()) {
    throw new ApiError(400, 'amount must not be negative (use kind=REFUND for refunds)');
  }
  if (amount.greaterThan(MAX_AMOUNT)) {
    throw new ApiError(400, `amount must not exceed ${MAX_AMOUNT}`);
  }

  return amount.toDecimalPlaces(AMOUNT_SCALE);
}

export function parseCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new ApiError(400, 'currency must be a 3-letter code (e.g. USD)');
  }
  return currency;
}

export function parseKind(value: string): SaleKind {
  const kind = value.trim().toUpperCase();
  if (!(SALE_KINDS as readonly string[]).includes(kind)) {
    throw new ApiError(400, `kind must be one of ${SALE_KINDS.join(', ')}`);
  }
  return kind as SaleKind;
}

export function parseOccurredAt(value: string): Date {
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'occurredAt must be an ISO 8601 date');
  }
  return date;
}

export function parseExternalId(value: string): string {
  const externalId = value.trim();
  if (externalId.length === 0 || externalId.length > MAX_EXTERNAL_ID_LENGTH) {
    throw new ApiError(400, `externalId must be 1-${MAX_EXTERNAL_ID_LENGTH} characters`);
  }
  return externalId;
}

// ---------- attribution ----------

/** linkId of every subscriber referenced by the batch; `has` distinguishes "unknown" from "organic". */
interface SubscriberIndex {
  byTgUserId: Map<string, string | null>;
  byUsername: Map<string, string | null>;
}

async function indexSubscribers(
  channelId: string,
  inputs: readonly SaleEventInput[],
): Promise<SubscriberIndex> {
  const prisma = getPrisma();

  const tgUserIds = [
    ...new Set(inputs.flatMap((input) => (input.tgUserId === null ? [] : [input.tgUserId]))),
  ];
  const usernames = [
    ...new Set(inputs.flatMap((input) => (input.username ? [input.username.toLowerCase()] : []))),
  ];

  const [byId, byName] = await Promise.all([
    tgUserIds.length > 0
      ? prisma.subscriber.findMany({
          where: { channelId, tgUserId: { in: tgUserIds } },
          select: { tgUserId: true, linkId: true },
        })
      : Promise.resolve([]),
    usernames.length > 0
      ? prisma.subscriber.findMany({
          // `in` has no case-insensitive mode, so OR a bounded list of ILIKE equals.
          where: {
            channelId,
            OR: usernames.map((username) => ({
              username: { equals: username, mode: Prisma.QueryMode.insensitive },
            })),
          },
          select: { username: true, linkId: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    byTgUserId: new Map(byId.map((sub) => [sub.tgUserId.toString(), sub.linkId])),
    byUsername: new Map(
      byName.flatMap((sub) => (sub.username ? [[sub.username.toLowerCase(), sub.linkId]] : [])),
    ),
  };
}

/** Telegram id wins over username; `found` is true even when the subscriber is organic. */
function resolveAttribution(
  input: SaleEventInput,
  index: SubscriberIndex,
): { found: boolean; linkId: string | null } {
  if (input.tgUserId !== null) {
    const key = input.tgUserId.toString();
    if (index.byTgUserId.has(key)) {
      return { found: true, linkId: index.byTgUserId.get(key) ?? null };
    }
  }
  if (input.username) {
    const key = input.username.toLowerCase();
    if (index.byUsername.has(key)) {
      return { found: true, linkId: index.byUsername.get(key) ?? null };
    }
  }
  return { found: false, linkId: null };
}

// ---------- persistence ----------

/**
 * Persist a batch of sale rows for one channel in a single transaction.
 * Rows carrying an `externalId` are upserted on (channelId, externalId) so
 * webhook retries and re-uploaded CSVs stay idempotent.
 */
export async function recordSaleEvents(
  channelId: string,
  inputs: readonly SaleEventInput[],
): Promise<IngestResult> {
  if (inputs.length === 0) {
    return { accepted: 0, matched: 0, duplicates: 0 };
  }

  const prisma = getPrisma();
  const index = await indexSubscribers(channelId, inputs);

  const externalIds = [
    ...new Set(inputs.flatMap((input) => (input.externalId ? [input.externalId] : []))),
  ];
  const existing =
    externalIds.length > 0
      ? await prisma.saleEvent.findMany({
          where: { channelId, externalId: { in: externalIds } },
          select: { externalId: true },
        })
      : [];
  const knownExternalIds = new Set(existing.flatMap((row) => (row.externalId ? [row.externalId] : [])));

  const creates: Prisma.SaleEventCreateManyInput[] = [];
  const upserts: (Prisma.SaleEventCreateManyInput & { externalId: string })[] = [];
  const seenInBatch = new Set<string>();
  let matched = 0;
  let duplicates = 0;

  for (const input of inputs) {
    const attribution = resolveAttribution(input, index);
    if (attribution.found) matched += 1;

    const data: Prisma.SaleEventCreateManyInput = {
      channelId,
      tgUserId: input.tgUserId,
      username: input.username,
      amount: input.amount,
      currency: input.currency,
      kind: input.kind,
      externalId: input.externalId,
      occurredAt: input.occurredAt,
      linkId: attribution.linkId,
    };

    if (input.externalId === null) {
      creates.push(data);
      continue;
    }

    if (knownExternalIds.has(input.externalId) || seenInBatch.has(input.externalId)) {
      duplicates += 1;
    }
    seenInBatch.add(input.externalId);
    upserts.push({ ...data, externalId: input.externalId });
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  if (creates.length > 0) {
    operations.push(prisma.saleEvent.createMany({ data: creates }));
  }
  for (const row of upserts) {
    operations.push(
      prisma.saleEvent.upsert({
        where: { channelId_externalId: { channelId, externalId: row.externalId } },
        create: row,
        // A restated event overwrites the previous values, including attribution.
        update: {
          tgUserId: row.tgUserId,
          username: row.username,
          amount: row.amount,
          currency: row.currency,
          kind: row.kind,
          occurredAt: row.occurredAt,
          linkId: row.linkId,
        },
      }),
    );
  }
  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  return { accepted: inputs.length, matched, duplicates };
}

// ---------- CSV mapping ----------

export interface CsvRowError {
  /** Physical line number in the uploaded file (header is line 1). */
  row: number;
  message: string;
}

export interface ParsedSalesCsv {
  inputs: SaleEventInput[];
  errors: CsvRowError[];
}

/** Header aliases, already normalized by `normalizeHeader` (lowercase, separators stripped). */
const HEADER = {
  tgUserId: 'tguserid',
  username: 'username',
  amount: 'amount',
  currency: 'currency',
  kind: 'kind',
  externalId: 'externalid',
  occurredAt: 'occurredat',
} as const;

/**
 * Map a CSV upload onto sale rows. Invalid rows are collected instead of
 * aborting the import, so one bad line does not reject the whole file.
 */
export function parseSalesCsv(csv: string): ParsedSalesCsv {
  const table = parseCsv(csv);
  if (!table || table.headers.length === 0) {
    throw new ApiError(400, 'CSV is empty or has no header row');
  }

  const headers = new Set(table.headers);
  if (!headers.has(HEADER.amount)) {
    throw new ApiError(400, 'CSV must have an "amount" column');
  }
  if (!headers.has(HEADER.tgUserId) && !headers.has(HEADER.username)) {
    throw new ApiError(400, 'CSV must have a "tg_user_id" or "username" column');
  }
  if (table.rows.length > MAX_CSV_ROWS) {
    throw new ApiError(400, `CSV must not exceed ${MAX_CSV_ROWS} data rows`);
  }

  const inputs: SaleEventInput[] = [];
  const errors: CsvRowError[] = [];

  for (const record of table.rows) {
    const row = recordToObject(table.headers, record);
    try {
      inputs.push(toSaleEventInput(row));
    } catch (error) {
      errors.push({
        row: record.line,
        message: error instanceof ApiError ? error.message : 'Invalid row',
      });
    }
  }

  return { inputs, errors };
}

function toSaleEventInput(row: Record<string, string>): SaleEventInput {
  const rawTgUserId = row[HEADER.tgUserId] ?? '';
  const rawUsername = row[HEADER.username] ?? '';
  if (rawTgUserId === '' && rawUsername === '') {
    throw new ApiError(400, 'Either tg_user_id or username is required');
  }

  const rawAmount = row[HEADER.amount] ?? '';
  if (rawAmount === '') {
    throw new ApiError(400, 'amount is required');
  }

  const rawCurrency = row[HEADER.currency] ?? '';
  const rawKind = row[HEADER.kind] ?? '';
  const rawExternalId = row[HEADER.externalId] ?? '';
  const rawOccurredAt = row[HEADER.occurredAt] ?? '';

  return {
    tgUserId: rawTgUserId === '' ? null : parseTgUserId(rawTgUserId),
    username: rawUsername === '' ? null : parseUsername(rawUsername),
    amount: parseAmount(rawAmount.replace(',', '.')),
    currency: rawCurrency === '' ? DEFAULT_CURRENCY : parseCurrency(rawCurrency),
    kind: rawKind === '' ? SaleKind.PURCHASE : parseKind(rawKind),
    externalId: rawExternalId === '' ? null : parseExternalId(rawExternalId),
    occurredAt: rawOccurredAt === '' ? new Date() : parseOccurredAt(rawOccurredAt),
  };
}

// ---------- DTO ----------

/**
 * API-safe sale row. Money keeps full precision as a string; BigInt ids are
 * serialized as strings. Aggregates (see server/revenue.ts) use numbers instead.
 */
export function toSaleEventDto(sale: SaleEvent) {
  return {
    id: sale.id,
    channelId: sale.channelId,
    tgUserId: sale.tgUserId === null ? null : sale.tgUserId.toString(),
    username: sale.username,
    amount: sale.amount.toFixed(AMOUNT_SCALE),
    currency: sale.currency,
    kind: sale.kind,
    externalId: sale.externalId,
    linkId: sale.linkId,
    occurredAt: sale.occurredAt,
    createdAt: sale.createdAt,
  };
}
