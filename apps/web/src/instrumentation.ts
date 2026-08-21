import * as Sentry from '@sentry/nextjs';

/**
 * Server-side error monitoring. Dormant unless SENTRY_DSN is set,
 * so local dev and CI need no Sentry account.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? '';
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? 'development',
    tracesSampleRate: 0,
  });
}

export const onRequestError = Sentry.captureRequestError;
