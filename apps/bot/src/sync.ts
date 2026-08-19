import cron from 'node-cron';
import type { Bot, Context } from 'grammy';
import { getPrisma, BotStatus } from '@tgpulse/db';

const prisma = getPrisma();

/**
 * Reconcile stored channel sizes with Telegram. Events give us the live delta;
 * this sweep corrects drift (updates missed while the bot was down, hidden joins).
 */
export async function syncMemberCounts<C extends Context>(bot: Bot<C>): Promise<void> {
  const channels = await prisma.channel.findMany({ where: { botStatus: BotStatus.ACTIVE } });

  for (const channel of channels) {
    try {
      const count = await bot.api.getChatMemberCount(Number(channel.tgChatId));
      await prisma.channel.update({
        where: { id: channel.id },
        data: { memberCount: count, memberCountAt: new Date() },
      });
    } catch (error: unknown) {
      // Bot kicked or channel gone: mark it so the dashboard shows the real state
      const message = error instanceof Error ? error.message : String(error);
      if (/kicked|not found|CHAT_/i.test(message)) {
        await prisma.channel.update({
          where: { id: channel.id },
          data: { botStatus: BotStatus.REMOVED },
        });
      }
      console.error(`member count sync failed for ${channel.id}: ${message}`);
    }
  }
}

export function startMemberCountSync<C extends Context>(bot: Bot<C>): void {
  cron.schedule('15 */6 * * *', () => void syncMemberCounts(bot), { timezone: 'Etc/UTC' });
}
