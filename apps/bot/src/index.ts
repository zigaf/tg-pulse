import { reportError } from './sentry'; // must be first: Sentry.init before any other import runs
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { webhookCallback } from 'grammy';
import { createHash } from 'node:crypto';
import { getPrisma } from '@tgpulse/db';
import { startBillingCron } from './billing-sweep';
import { bot } from './bot';
import { registerAdmin } from './commands/admin';
import { registerBilling } from './commands/billing';
import { registerBulklinks } from './commands/bulklinks';
import { registerChannels } from './commands/channels';
import { registerFraud } from './commands/fraud';
import { registerHelp } from './commands/help';
import { registerLanguage } from './commands/language';
import { registerNavigation } from './commands/navigation';
import { registerNewlink } from './commands/newlink';
import { registerNotifications } from './commands/notifications';
import { registerStart } from './commands/start';
import { registerStats } from './commands/stats';
import { registerUpgrade } from './commands/upgrade';
import { config } from './config';
import { startConversionCrons } from './conversions';
import { isEncryptionConfigured } from './crypto';
import { registerFallback } from './fallback';
import { getDict, type Dict, type Lang } from './i18n';
import { registerPixel } from './pixel';
import { registerReports, startReportCron } from './reports';
import { startMemberCountSync } from './sync';

registerNavigation(bot);
registerStart(bot);
registerHelp(bot);
registerLanguage(bot);
registerChannels(bot);
registerFraud(bot);
registerNotifications(bot);
registerStats(bot);
registerNewlink(bot);
registerBulklinks(bot);
registerUpgrade(bot);
registerBilling(bot);
registerAdmin(bot);
registerReports(bot);
registerFallback(bot); // must be last: unknown-input hints + catch-all callback answer + bot.catch

const app = Fastify({
  logger: {
    // The webhook path carries a secret; never write it to logs verbatim.
    serializers: {
      req(req) {
        const url = req.url?.startsWith('/webhook/') ? '/webhook/[redacted]' : req.url;
        return { method: req.method, url, remoteAddress: req.socket?.remoteAddress };
      },
    },
  },
});
const prisma = getPrisma();

app.get('/health', async () => ({ ok: true }));

// Server-side errors on public endpoints (/l/:slug, /px, webhook) reach Sentry too.
app.addHook('onError', async (req, _reply, error) => {
  reportError(error, { method: req.method, url: req.url });
});

// Landing-page pixel: GET /pixel.js + POST /px beacon ingest
registerPixel(app);

const AD_CLICK_ID_KEYS = ['yclid', 'gclid', 'fbclid', 'ttclid'] as const;

// ---------- Tracking redirect: go.<domain>/l/<slug> ----------
app.get<{ Params: { slug: string }; Querystring: Record<string, unknown> }>(
  '/l/:slug',
  { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
  async (req, reply) => {
  const link = await prisma.trackedLink.findUnique({ where: { slug: req.params.slug } });
  if (!link || link.isRevoked) {
    return reply.code(404).send({ error: 'link not found' });
  }

  const hash = (v: string | undefined) =>
    v ? createHash('sha256').update(v).digest('hex').slice(0, 32) : undefined;

  const qs = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v.slice(0, 500) : undefined);

  // Pixel visitor id stitched onto the link by pixel.js (?cid=...)
  const clientId = qs(req.query.cid);
  // Ad-platform click ids passed directly on the go-link (no pixel on the landing)
  const adClickIds: Record<string, string> = {};
  for (const key of AD_CLICK_ID_KEYS) {
    const value = qs(req.query[key]);
    if (value) adClickIds[key] = value;
  }
  const referer = (req.headers.referer as string | undefined)?.slice(0, 500);

  // Fire-and-forget: never slow the redirect down because of a stats write
  prisma.click
    .create({
      data: {
        linkId: link.id,
        ipHash: hash(req.ip),
        uaHash: hash(req.headers['user-agent'] as string | undefined),
        referer,
        clientId,
        landingUrl: referer,
        ...(Object.keys(adClickIds).length > 0 ? { adClickIds } : {}),
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
  // Path secret plus Telegram's secret_token header: a leaked URL alone is not enough.
  app.post(
    `/webhook/${config.webhookSecret}`,
    { preHandler: (req, reply, done) => {
        const token = req.headers['x-telegram-bot-api-secret-token'];
        if (token !== config.webhookSecret) {
          reply.code(401).send({ error: 'unauthorized' });
          return;
        }
        done();
      } },
    webhookCallback(bot, 'fastify'),
  );
}

const RUSSIAN_CODE: Lang = 'ru';

/** The command menu Telegram shows, rendered from a dictionary. */
function commandList(dict: Dict): { command: string; description: string }[] {
  return [
    { command: 'start', description: dict.commands.start },
    { command: 'newlink', description: dict.commands.newlink },
    { command: 'bulklinks', description: dict.commands.bulklinks },
    { command: 'stats', description: dict.commands.stats },
    { command: 'channels', description: dict.commands.channels },
    { command: 'fraud', description: dict.commands.fraud },
    { command: 'notifications', description: dict.commands.notifications },
    { command: 'upgrade', description: dict.commands.upgrade },
    { command: 'billing', description: dict.commands.billing },
    { command: 'language', description: dict.commands.language },
    { command: 'help', description: dict.commands.help },
  ];
}

async function main() {
  // chat_member updates are NOT delivered by default, they must be requested explicitly;
  // pre_checkout_query is the same, and without it Stars payments never complete.
  const allowedUpdates = [
    'message',
    'chat_member',
    'my_chat_member',
    'callback_query',
    'pre_checkout_query',
  ] as const;

  // Abuse throttling for the public endpoints (/px, /l/:slug); per-route limits opt in
  await app.register(rateLimit, {
    global: false,
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: (req) => (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });

  startReportCron();
  startMemberCountSync(bot);
  startBillingCron();
  startConversionCrons();

  // Integrations are unusable without the credential key; fail visibly, not silently.
  if (!isEncryptionConfigured()) {
    app.log.warn('ENCRYPTION_KEY is not set: ad-platform integrations are disabled');
  }

  // Telegram keeps one command list per language_code, so both locales are published.
  await bot.api.setMyCommands(commandList(getDict('en')));
  await bot.api.setMyCommands(commandList(getDict('ru')), { language_code: RUSSIAN_CODE });

  if (config.webhookSecret && config.publicUrl) {
    await bot.api.setWebhook(`${config.publicUrl}/webhook/${config.webhookSecret}`, {
      secret_token: config.webhookSecret,
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
  reportError(e);
  process.exit(1);
});
