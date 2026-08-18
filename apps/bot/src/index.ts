import Fastify from 'fastify';
import { webhookCallback } from 'grammy';
import { createHash } from 'node:crypto';
import { getPrisma } from '@tgpulse/db';
import { bot } from './bot';
import { registerChannels } from './commands/channels';
import { registerHelp } from './commands/help';
import { registerNewlink } from './commands/newlink';
import { registerNotifications } from './commands/notifications';
import { registerStart } from './commands/start';
import { registerStats } from './commands/stats';
import { config } from './config';
import { registerFallback } from './fallback';
import { registerReports, startReportCron } from './reports';
import { startMemberCountSync } from './sync';
import { texts } from './texts';

registerStart(bot);
registerHelp(bot);
registerChannels(bot);
registerNotifications(bot);
registerStats(bot);
registerNewlink(bot);
registerReports(bot);
registerFallback(bot); // must be last: unknown-input hints + catch-all callback answer + bot.catch

const app = Fastify({ logger: true });
const prisma = getPrisma();

app.get('/health', async () => ({ ok: true }));

// ---------- Tracking redirect: go.<domain>/l/<slug> ----------
app.get<{ Params: { slug: string } }>('/l/:slug', async (req, reply) => {
  const link = await prisma.trackedLink.findUnique({ where: { slug: req.params.slug } });
  if (!link || link.isRevoked) {
    return reply.code(404).send({ error: 'link not found' });
  }

  const hash = (v: string | undefined) =>
    v ? createHash('sha256').update(v).digest('hex').slice(0, 32) : undefined;

  // Fire-and-forget: never slow the redirect down because of a stats write
  prisma.click
    .create({
      data: {
        linkId: link.id,
        ipHash: hash(req.ip),
        uaHash: hash(req.headers['user-agent'] as string | undefined),
        referer: (req.headers.referer as string | undefined)?.slice(0, 500),
      },
    })
    .catch((e: unknown) => app.log.error(e, 'click write failed'));

  const target = link.targetPostUrl ?? link.inviteLink;
  if (!target) {
    return reply.code(404).send({ error: 'link has no destination' });
  }
  return reply.redirect(target, 302);
});

// ---------- Telegram webhook (production) ----------
if (config.webhookSecret) {
  app.post(`/webhook/${config.webhookSecret}`, webhookCallback(bot, 'fastify'));
}

async function main() {
  // chat_member updates are NOT delivered by default — must be requested explicitly
  const allowedUpdates = ['message', 'chat_member', 'my_chat_member', 'callback_query'] as const;

  await app.listen({ port: config.port, host: '0.0.0.0' });

  startReportCron();
  startMemberCountSync(bot);

  await bot.api.setMyCommands([
    { command: 'start', description: texts.commands.start },
    { command: 'newlink', description: texts.commands.newlink },
    { command: 'stats', description: texts.commands.stats },
    { command: 'channels', description: texts.commands.channels },
    { command: 'help', description: texts.commands.help },
  ]);

  if (config.webhookSecret && config.publicUrl) {
    await bot.api.setWebhook(`${config.publicUrl}/webhook/${config.webhookSecret}`, {
      allowed_updates: [...allowedUpdates],
    });
    app.log.info('Bot running in webhook mode');
  } else {
    void bot.start({ allowed_updates: [...allowedUpdates] });
    app.log.info('Bot running in long-polling mode (dev)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
