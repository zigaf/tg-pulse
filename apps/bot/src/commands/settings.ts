import type { Bot } from 'grammy';
import type { BotContext } from '../context';
import { CB, settingsMenu } from '../menus';
import { getUserActiveChannels, getUserWorkspaceId } from '../queries';
import { safeEdit } from '../ui';
import { settingsCard } from '../views/settings-view';

async function buildSettingsView(ctx: BotContext) {
  const tgUserId = ctx.from?.id;
  if (tgUserId === undefined) return null;

  const [workspaceId, channels] = await Promise.all([
    getUserWorkspaceId(tgUserId),
    getUserActiveChannels(tgUserId),
  ]);
  return {
    text: settingsCard(ctx.dict, channels.length > 0),
    keyboard: settingsMenu(ctx.dict, workspaceId, channels),
  };
}

/** /settings: dashboard entry points that open as a Mini App inside Telegram. */
export function registerSettings(bot: Bot<BotContext>): void {
  bot.command('settings', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const view = await buildSettingsView(ctx);
    if (!view) return;
    await ctx.reply(view.text, {
      parse_mode: 'HTML',
      reply_markup: view.keyboard,
      link_preview_options: { is_disabled: true },
    });
  });

  bot.callbackQuery(CB.goSettings, async (ctx) => {
    await ctx.answerCallbackQuery();
    const view = await buildSettingsView(ctx);
    if (!view) return;
    await safeEdit(ctx, view.text, view.keyboard);
  });
}
