import type { AdProvider } from '@tgpulse/db';

/**
 * Contract every ad-platform adapter implements.
 *
 * Adapters are pure transport: they know their platform's HTTP shape and nothing
 * about Prisma, the outbox or scheduling. Everything they need arrives as
 * arguments, everything they report comes back as plain data.
 */

/** Non-secret context captured at join time; the adapter picks what it needs. */
export interface ConversionPayload {
  fbclid?: string;
  yclid?: string;
  gclid?: string;
  ttclid?: string;
  /** Epoch ms of the click that carried the ad click id (Meta `fbc` needs it). */
  clickTsMs?: number;
  linkSlug?: string;
  linkLabel?: string;
}

/** One owed conversion, mapped from a `ConversionUpload` row by the caller. */
export interface ConversionRow {
  /** Stable dedup key shared with the platform (`<subscriberId>:<integrationId>`). */
  eventKey: string;
  clickId: string | null;
  occurredAt: Date;
  payload: ConversionPayload;
}

export interface FailedConversion {
  eventKey: string;
  /** Human-readable reason, persisted verbatim on the row. */
  error: string;
  /** Retrying cannot help (e.g. the click id was never captured). */
  permanent?: boolean;
}

export interface SendResult {
  /** eventKeys the platform accepted. */
  sent: string[];
  failed: FailedConversion[];
}

export interface TestResult {
  ok: boolean;
  /** What the platform actually said, shown to the user as-is. */
  detail: string;
}

export interface AdAdapter {
  readonly provider: AdProvider;
  /** Largest batch the platform accepts in one call. */
  readonly batchSize: number;
  /** Throws with a user-facing message when the stored config is unusable. */
  validateConfig(config: unknown): void;
  /** Real dry-run call: verifies credentials and settings without sending data. */
  test(creds: unknown, config: unknown): Promise<TestResult>;
  send(batch: ConversionRow[], creds: unknown, config: unknown): Promise<SendResult>;
}
