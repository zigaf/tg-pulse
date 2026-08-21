import * as Sentry from '@sentry/node';

/**
 * Error monitoring. Dormant unless SENTRY_DSN is set, so local dev and CI
 * need no account. Import this module before anything else in the entrypoint.
 */

const dsn = process.env.SENTRY_DSN ?? '';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? 'development',
    tracesSampleRate: 0,
  });
}

export const isSentryEnabled = dsn.length > 0;

/** Report an error with optional context; falls through silently when Sentry is off. */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  if (!isSentryEnabled) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
