import { AdProvider } from '@tgpulse/db';
import { googleAdapter } from './google';
import { metaAdapter } from './meta';
import { tiktokAdapter } from './tiktok';
import type { AdAdapter } from './types';
import { yandexAdapter } from './yandex';

/**
 * Adapter registry. A provider stored in the schema without an entry here is
 * simply skipped by the worker.
 */
const ADAPTERS: Partial<Record<AdProvider, AdAdapter>> = {
  [AdProvider.META_CAPI]: metaAdapter,
  [AdProvider.YANDEX_METRIKA]: yandexAdapter,
  [AdProvider.GOOGLE_ADS]: googleAdapter,
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
