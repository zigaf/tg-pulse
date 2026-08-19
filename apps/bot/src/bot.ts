import { Bot } from 'grammy';
import { getPrisma, BotStatus, EventType, Attribution } from '@tgpulse/db';
import { getEntitlements } from './billing';
import { config } from './config';
import { enqueueJoinConversions } from './conversions';
import type { BotContext } from './context';
import { getDict } from './i18n';
import { withDict } from './i18n/middleware';
import { getUserLang } from './i18n/user-lang';
import { upsellMenu } from './menus';
import { hasSubscribers, notifyMemberEvent } from './notifications';
import { firePostbacks } from './postbacks';
import { isChannelOverQuota } from './quota';
import { channelOverQuotaCard } from './views/billing-view';
import { channelConnectedCard } from './views/home-view';

export const bot = new Bot<BotContext>(config.botToken);
const prisma = getPrisma();

// First in the chain: every handler below and in commands/ reads ctx.dict.
bot.use(withDict());

// ---------- Onboarding ----------

// Bot's own status in a channel changed (added/removed as admin)
bot.on('my_chat_member', async (ctx) => {
  const chat = ctx.myChatMember.chat;
  if (chat.type !== 'channel') return;

  const newStatus = ctx.myChatMember.new_chat_member.status;
  const isAdmin = newStatus === 'administrator';

  // Baseline of real channel size: dynamics are tracked as events on top of it
  const memberCount = isAdmin ? await ctx.api.getChatMemberCount(chat.id).catch(() => null) : null;

  const existing = await prisma.channel.findUnique({ where: { tgChatId: BigInt(chat.id) } });
  if (existing) {
    await prisma.channel.update({
      where: { id: existing.id },
      data: {
        botStatus: isAdmin ? BotStatus.ACTIVE : BotStatus.REMOVED,
        title: chat.title ?? existing.title,
        ...(memberCount !== null ? { memberCount, memberCountAt: new Date() } : {}),
      },
    });
    return;
  }

  if (!isAdmin) return;

  // New channel: create a personal workspace for the user who added the bot
  const from = ctx.myChatMember.from;
  const user = await prisma.user.upsert({
    where: { tgId: BigInt(from.id) },
    update: { username: from.username, firstName: from.first_name },
    create: {
      tgId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      languageCode: from.language_code,
    },
  });

  let membership = await prisma.membership.findFirst({ where: { userId: user.id }, include: { workspace: true } });
  if (!membership) {
    const workspace = await prisma.workspace.create({
      data: {
        name: from.first_name ?? 'My workspace',
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
    membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id, workspaceId: workspace.id },
      include: { workspace: true },
    });
  }

  const channel = await prisma.channel.create({
    data: {
      tgChatId: BigInt(chat.id),
      title: chat.title ?? 'Channel',
      username: 'username' in chat ? chat.username : undefined,
      workspaceId: membership.workspaceId,
      botStatus: BotStatus.ACTIVE,
      ...(memberCount !== null ? { memberCount, memberCountAt: new Date() } : {}),
    },
  });

  // Over-quota channels are never refused: they keep tracking and get an upsell instead.
  const entitlements = await getEntitlements(channel.workspaceId);
  const isOverQuota = await isChannelOverQuota(channel, entitlements);

  const dict = getDict(await getUserLang(from.id, from.language_code));
  const text = isOverQuota
    ? channelOverQuotaCard(dict, channel.title, entitlements.plan)
    : channelConnectedCard(dict, channel.title);

  await bot.api
    .sendMessage(from.id, text, {
      parse_mode: 'HTML',
      ...(isOverQuota ? { reply_markup: upsellMenu(dict) } : {}),
    })
    .catch(() => {
      // user may not have started the bot in DM, they'll see the channel in the dashboard
    });
});

// ---------- Attribution core: joins & leaves ----------

bot.on('chat_member', async (ctx) => {
  const upd = ctx.chatMember;
  if (upd.chat.type !== 'channel') return;

  const channel = await prisma.channel.findUnique({ where: { tgChatId: BigInt(upd.chat.id) } });
  if (!channel) return;

  const oldIn = ['member', 'administrator', 'creator'].includes(upd.old_chat_member.status);
  const newIn = ['member', 'administrator', 'creator'].includes(upd.new_chat_member.status);
  if (oldIn === newIn) return; // no join/leave transition

  const member = upd.new_chat_member.user;
  const tgUserId = BigInt(member.id);
  const now = new Date();

  if (newIn) {
    // JOIN. If they came via one of our unique invite links, attribution is exact.
    const inviteUrl = upd.invite_link?.invite_link;
    const link = inviteUrl
      ? await prisma.trackedLink.findFirst({ where: { inviteLink: inviteUrl, channelId: channel.id } })
      : null;

    const existing = await prisma.subscriber.findUnique({
      where: { channelId_tgUserId: { channelId: channel.id, tgUserId } },
    });

    const subscriber = existing
      ? await prisma.subscriber.update({
          where: { id: existing.id },
          data: {
            leftAt: null,
            rejoinCount: { increment: 1 },
            // keep original attribution unless we now have a better (exact) one
            ...(link ? { linkId: link.id, attribution: Attribution.EXACT } : {}),
          },
        })
      : await prisma.subscriber.create({
          data: {
            channelId: channel.id,
            tgUserId,
            username: member.username,
            firstName: member.first_name,
            isPremium: member.is_premium ?? false,
            joinedAt: now,
            linkId: link?.id,
            attribution: link ? Attribution.EXACT : inviteUrl ? Attribution.ORGANIC : Attribution.UNKNOWN,
          },
        });

    await prisma.memberEvent.create({
      data: { channelId: channel.id, tgUserId, type: EventType.JOIN, linkId: link?.id, ts: now },
    });

    // Server-to-server conversion postbacks; never blocks attribution handling
    void firePostbacks(channel, 'join', link, tgUserId);

    // Native ad-platform conversions go through the outbox; delivery is a worker's job
    void enqueueJoinConversions(channel.id, subscriber.id, link).catch((e: unknown) =>
      console.error('[conversions] enqueue dispatch failed', e),
    );

    // Instant alerts for opted-in users; never blocks attribution handling
    void notifyMemberEvent(bot.api, channel, EventType.JOIN, link?.label ?? null);
  } else {
    // LEAVE
    const sub = await prisma.subscriber.findUnique({
      where: { channelId_tgUserId: { channelId: channel.id, tgUserId } },
    });
    if (sub) {
      await prisma.subscriber.update({ where: { id: sub.id }, data: { leftAt: now } });
    }
    await prisma.memberEvent.create({
      data: { channelId: channel.id, tgUserId, type: EventType.LEAVE, linkId: sub?.linkId, ts: now },
    });

    const sourceLink = sub?.linkId
      ? await prisma.trackedLink.findUnique({
          where: { id: sub.linkId },
          select: { id: true, slug: true, label: true },
        })
      : null;

    // Server-to-server conversion postbacks; never blocks attribution handling
    void firePostbacks(channel, 'leave', sourceLink, tgUserId);

    // Instant alerts for opted-in users; never blocks attribution handling
    if (await hasSubscribers(channel.id)) {
      void notifyMemberEvent(bot.api, channel, EventType.LEAVE, sourceLink?.label ?? null);
    }
  }
});
