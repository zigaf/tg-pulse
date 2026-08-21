import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side error monitoring. Dormant unless NEXT_PUBLIC_SENTRY_DSN is set.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_RAILWAY_ENVIRONMENT ?? 'development',
    tracesSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
