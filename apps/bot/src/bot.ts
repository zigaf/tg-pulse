import { Bot } from 'grammy';
import { getPrisma, BotStatus, EventType, Attribution } from '@tgpulse/db';
import { config } from './config';
import { hasSubscribers, notifyMemberEvent } from './notifications';
import { firePostbacks } from './postbacks';
import { texts } from './texts';

export const bot = new Bot(config.botToken);
const prisma = getPrisma();

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

  await prisma.channel.create({
    data: {
      tgChatId: BigInt(chat.id),
      title: chat.title ?? 'Channel',
      username: 'username' in chat ? chat.username : undefined,
      workspaceId: membership.workspaceId,
      botStatus: BotStatus.ACTIVE,
      ...(memberCount !== null ? { memberCount, memberCountAt: new Date() } : {}),
    },
  });

  await bot.api.sendMessage(
    from.id,
    texts.onboarding.channelConnected(chat.title ?? 'Channel'),
  ).catch(() => {
    // user may not have started the bot in DM — fine, they'll see the channel in the dashboard
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

    if (existing) {
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          leftAt: null,
          rejoinCount: { increment: 1 },
          // keep original attribution unless we now have a better (exact) one
          ...(link ? { linkId: link.id, attribution: Attribution.EXACT } : {}),
        },
      });
    } else {
      await prisma.subscriber.create({
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
    }

    await prisma.memberEvent.create({
      data: { channelId: channel.id, tgUserId, type: EventType.JOIN, linkId: link?.id, ts: now },
    });

    // Server-to-server conversion postbacks; never blocks attribution handling
    void firePostbacks(channel, 'join', link, tgUserId);

    // Instant alerts for opted-in users; never blocks attribution handling
    void notifyMemberEvent(bot.api, channel, EventType.JOIN, link?.label ?? texts.sources.organic);
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
    if (hasSubscribers(channel.id)) {
      void notifyMemberEvent(bot.api, channel, EventType.LEAVE, sourceLink?.label ?? texts.sources.organic);
    }
  }
});
