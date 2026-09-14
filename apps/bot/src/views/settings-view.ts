import type { Dict } from '../i18n';
import { card } from '../ui';

const ICON_SETTINGS = '⚙️';

/** /settings: a short pitch for the Mini App plus a pointer at the per-channel buttons. */
export function settingsCard(dict: Dict, hasChannels: boolean): string {
  return card({
    icon: ICON_SETTINGS,
    title: dict.settings.title,
    body: [
      dict.settings.intro,
      '',
      `<b>${dict.settings.channelsTitle}</b>`,
      hasChannels ? dict.settings.channelsHint : dict.settings.noChannels,
    ],
    footer: dict.settings.footer,
  });
}
