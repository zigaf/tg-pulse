import type { Api } from 'grammy';
import { config } from './config';
import type { Dict } from './i18n';
import { appLinkFor, appPaths } from './menus';
import { reportError } from './sentry';

/**
 * Chat menu button next to the message field, opening the dashboard as a Mini App.
 * Without a chat id the global default is set; with one, that chat's override.
 * A no-op when the dashboard is not https, because Telegram rejects such web_app URLs.
 * Failures are logged, never thrown: the menu button is a convenience, not a dependency.
 */
export async function setMenuButton(api: Api, dict: Dict, chatId?: number): Promise<void> {
  const link = appLinkFor(config.dashboardUrl, appPaths.home);
  if (link.kind !== 'web_app') return;

  try {
    await api.setChatMenuButton({
      ...(chatId === undefined ? {} : { chat_id: chatId }),
      menu_button: { type: 'web_app', text: dict.menuButton, web_app: { url: link.url } },
    });
  } catch (error) {
    console.error(`Menu button: setChatMenuButton failed${chatId === undefined ? '' : ` for chat ${chatId}`}`, error);
    reportError(error, { chatId });
  }
}
