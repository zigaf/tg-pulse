/**
 * Ad-platform catalog shared by the connect form and the server validators.
 *
 * Field names here are the contract: `src/server/integrations.ts` builds its zod schemas
 * from the same keys, so a rename cannot drift between the form and the API.
 * Nothing in this module is secret and nothing imports node, so it is safe on the client.
 *
 * Requirements per platform: docs/AD-INTEGRATIONS.md.
 */

export type AdProvider = 'META_CAPI' | 'YANDEX_METRIKA' | 'GOOGLE_ADS' | 'TIKTOK_EVENTS';

export const AD_PROVIDER_IDS: readonly AdProvider[] = [
  'META_CAPI',
  'YANDEX_METRIKA',
  'GOOGLE_ADS',
  'TIKTOK_EVENTS',
];

export interface ProviderField {
  name: string;
  label: string;
  placeholder?: string;
  /** One short line under the input saying where the value comes from. */
  hint?: string;
  /** Rendered as a password input and never sent back to the browser. */
  secret?: boolean;
  optional?: boolean;
  /** Prefilled on a fresh connection. */
  defaultValue?: string;
}

export interface AdProviderDescriptor {
  provider: AdProvider;
  /** Brand, e.g. "Meta". */
  name: string;
  /** The specific product we talk to, e.g. "Conversions API". */
  product: string;
  /** Click id we match the conversion on. */
  clickId: string;
  summary: string;
  /** No connection possible yet; the card renders disabled. */
  comingSoon: boolean;
  credentialFields: readonly ProviderField[];
  configFields: readonly ProviderField[];
  /** Numbered setup checklist shown inside the connect modal. */
  setupSteps: readonly string[];
}

export const AD_PROVIDERS: Record<AdProvider, AdProviderDescriptor> = {
  META_CAPI: {
    provider: 'META_CAPI',
    name: 'Meta',
    product: 'Conversions API',
    clickId: 'fbclid',
    summary: 'Sends each attributed join to your pixel dataset so Meta can optimize toward subscribers.',
    comingSoon: false,
    credentialFields: [
      {
        name: 'accessToken',
        label: 'System user access token',
        placeholder: 'EAAG...',
        hint: 'Business settings, System users, generate a token with the ads_management permission.',
        secret: true,
      },
    ],
    configFields: [
      {
        name: 'pixelId',
        label: 'Pixel (dataset) id',
        placeholder: '1234567890123456',
        hint: 'Events Manager, your dataset, the numeric id next to its name.',
      },
      {
        name: 'eventName',
        label: 'Event name',
        placeholder: 'Subscribe',
        defaultValue: 'Subscribe',
        hint: 'Standard or custom event the campaign optimizes for.',
      },
      {
        name: 'testEventCode',
        label: 'Test event code',
        placeholder: 'TEST12345',
        optional: true,
        hint: 'Optional. With a code the Test action posts a real event visible in Test Events.',
      },
    ],
    setupSteps: [
      'Create a system user in Business settings and give it the ads_management permission.',
      'Generate a token for that system user and assign your pixel to it.',
      'Copy the pixel (dataset) id from Events Manager.',
    ],
  },
  YANDEX_METRIKA: {
    provider: 'YANDEX_METRIKA',
    name: 'Yandex',
    product: 'Metrica offline conversions',
    clickId: 'yclid',
    summary: 'Uploads joins as offline conversions on your counter so Direct can optimize on that goal.',
    comingSoon: false,
    credentialFields: [
      {
        name: 'oauthToken',
        label: 'Metrica OAuth token',
        placeholder: 'y0_Ag...',
        hint: 'OAuth token with access to Metrica, issued for your Yandex account.',
        secret: true,
      },
    ],
    configFields: [
      {
        name: 'counterId',
        label: 'Counter id',
        placeholder: '12345678',
        hint: 'The numeric counter id shown in the Metrica interface.',
      },
      {
        name: 'goalName',
        label: 'Goal name',
        placeholder: 'Telegram subscribe',
        hint: 'Must match the goal in Metrica exactly, character for character.',
      },
    ],
    setupSteps: [
      'In the counter settings open Data upload and enable offline conversions.',
      'Create the goal you want Direct to optimize on and copy its exact name.',
      'Issue an OAuth token for Metrica and paste it above.',
      'Metrica processes an upload for up to two hours before the goal reacts.',
    ],
  },
  GOOGLE_ADS: {
    provider: 'GOOGLE_ADS',
    name: 'Google Ads',
    product: 'Data Manager API',
    clickId: 'gclid',
    summary:
      'Uploads joins against the Google click id so your campaigns optimize toward subscribers. No developer token needed.',
    comingSoon: false,
    // Field names are parsed by apps/bot/src/integrations/google.ts; keep both sides in step.
    credentialFields: [
      {
        name: 'clientId',
        label: 'OAuth client id',
        placeholder: '1234567890-abc.apps.googleusercontent.com',
        // Not sensitive by itself, but stored in the encrypted credentials blob with the
        // secret pair — marking it secret gives it the same "empty keeps the stored value"
        // edit semantics. Changing credentials means filling all three fields together.
        secret: true,
        hint: 'Google Cloud console, an OAuth client in a project with the Data Manager API enabled. To change credentials, fill all three fields.',
      },
      {
        name: 'clientSecret',
        label: 'OAuth client secret',
        placeholder: 'GOCSPX-...',
        hint: 'The secret of the same OAuth client.',
        secret: true,
      },
      {
        name: 'refreshToken',
        label: 'Refresh token',
        placeholder: '1//0g...',
        hint: 'Issued for a Google user with access to the Ads account, scope https://www.googleapis.com/auth/datamanager.',
        secret: true,
      },
    ],
    configFields: [
      {
        name: 'operatingAccountId',
        label: 'Google Ads customer id',
        placeholder: '123-456-7890',
        hint: 'The account that owns the conversion action. Dashes are fine.',
      },
      {
        name: 'conversionActionId',
        label: 'Conversion action id',
        placeholder: '987654321',
        hint: 'An import conversion action of type "Upload clicks"; the ctId number in its URL.',
      },
      {
        name: 'loginAccountId',
        label: 'Manager (MCC) id',
        placeholder: '123-456-7890',
        optional: true,
        hint: 'Only if the OAuth user reaches the account through a manager account.',
      },
    ],
    setupSteps: [
      'In Google Cloud console enable the Data Manager API and create an OAuth client.',
      'Issue a refresh token for a Google user with access to the Ads account (datamanager scope).',
      'In Google Ads create an import conversion action of type "Upload clicks" and copy its id.',
      'Run Test: we send one validate-only upload that is checked but never recorded.',
    ],
  },
  TIKTOK_EVENTS: {
    provider: 'TIKTOK_EVENTS',
    name: 'TikTok',
    product: 'Events API 2.0',
    clickId: 'ttclid',
    summary: 'Uploads joins against the TikTok click id so the pixel optimizes for subscribers.',
    comingSoon: false,
    // Field names are parsed by apps/bot/src/integrations/tiktok.ts; keep both sides in step.
    credentialFields: [
      {
        name: 'accessToken',
        label: 'Access token',
        placeholder: 'from Events Manager',
        hint: 'Pixel-scoped token generated in TikTok Events Manager.',
        secret: true,
      },
    ],
    configFields: [
      {
        name: 'pixelCode',
        label: 'Pixel code',
        placeholder: 'CQ1A2B3C4D5E6F7G',
        hint: 'The pixel id shown next to your pixel in Events Manager.',
      },
      {
        name: 'eventName',
        label: 'Event name',
        placeholder: 'CompleteRegistration',
        hint: 'The standard event your campaigns optimize on. Defaults to CompleteRegistration.',
        optional: true,
      },
      {
        name: 'testEventCode',
        label: 'Test event code',
        placeholder: 'TEST12345',
        hint: 'Optional. With it set, test events land in the Test Events tab instead of live data.',
        optional: true,
      },
    ],
    setupSteps: [
      'Open TikTok Events Manager and pick the pixel your campaigns use.',
      'Generate an access token for that pixel and paste it above.',
      'Copy the pixel code from the same screen.',
      'Run Test: we send one probe event that is not your conversion event.',
    ],
  },
};

/** Ordered for display: connectable platforms first, "coming soon" after them. */
export const AD_PROVIDER_LIST: readonly AdProviderDescriptor[] = [
  AD_PROVIDERS.META_CAPI,
  AD_PROVIDERS.YANDEX_METRIKA,
  AD_PROVIDERS.GOOGLE_ADS,
  AD_PROVIDERS.TIKTOK_EVENTS,
];

export function isAdProvider(value: unknown): value is AdProvider {
  return typeof value === 'string' && (AD_PROVIDER_IDS as readonly string[]).includes(value);
}

/** Label used in tables and error messages, e.g. "Meta Conversions API". */
export function providerLabel(provider: AdProvider): string {
  const descriptor = AD_PROVIDERS[provider];
  return descriptor ? `${descriptor.name} ${descriptor.product}` : provider;
}

/** Every field of a provider, credentials first, in form order. */
export function providerFields(descriptor: AdProviderDescriptor): readonly ProviderField[] {
  return [...descriptor.credentialFields, ...descriptor.configFields];
}
