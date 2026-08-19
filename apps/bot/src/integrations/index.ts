import { AdProvider } from '@tgpulse/db';
import { metaAdapter } from './meta';
import { tiktokAdapter } from './tiktok';
import type { AdAdapter } from './types';
import { yandexAdapter } from './yandex';

/**
 * Adapter registry. Providers without an entry (Google Ads) are stored in the
 * schema already but not deliverable yet; the worker skips them.
 */
const ADAPTERS: Partial<Record<AdProvider, AdAdapter>> = {
  [AdProvider.META_CAPI]: metaAdapter,
  [AdProvider.YANDEX_METRIKA]: yandexAdapter,
  [AdProvider.TIKTOK_EVENTS]: tiktokAdapter,
};

export function getAdapter(provider: AdProvider): AdAdapter | undefined {
  return ADAPTERS[provider];
}

/** Providers that can actually deliver today. */
export function supportedProviders(): AdProvider[] {
  return Object.keys(ADAPTERS) as AdProvider[];
}

export * from './types';
