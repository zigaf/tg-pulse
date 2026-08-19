import type { Bot } from 'grammy';
import type { BotContext } from '../context';
import { startMenu } from '../menus';
import { getOnboardingProgress } from '../queries';
import { startCard } from '../views/home-view';
import { showPlans, upgradeDeepLinkWorkspaceId } from './upgrade';

export function registerStart(bot: Bot<BotContext>): void {
  // ctx.match may carry a deep-link payload (t.me/<bot>?start=<payload>). Only the
  // upgrade link means something today; any other payload falls through to the card.
  bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const workspaceId = upgradeDeepLinkWorkspaceId(ctx.match);
    if (workspaceId) {
      await showPlans(ctx, workspaceId, 'reply');
      return;
    }

    // The checklist is only useful if it reflects reality, so it comes from the DB.
    const progress = await getOnboardingProgress(ctx.from.id);
    await ctx.reply(startCard(ctx.dict, progress), {
      parse_mode: 'HTML',
      reply_markup: startMenu(ctx.dict, ctx.me.username, progress),
      link_preview_options: { is_disabled: true },
    });
  });
}
