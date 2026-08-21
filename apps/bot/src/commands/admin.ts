import type { Bot } from 'grammy';
import { getPrisma, Plan } from '@tgpulse/db';
import { grantPlanManually, isPaidPlan, PLANS } from '../billing';
import { config } from '../config';
import type { BotContext } from '../context';
import { escapeHtml } from '../format';

/**
 * Support tooling, English-only and hidden from the command menu.
 * Only ids from ADMIN_TG_IDS may use it; for everyone else the commands
 * fall through to the unknown-input fallback as if they did not exist.
 */

const prisma = getPrisma();

const DEFAULT_GRANT_DAYS = 30;
const MAX_GRANT_DAYS = 3650;

const USAGE = [
  '<b>Admin commands</b>',
  '/admin — this help plus the workspace list',
  '/admin grant &lt;@username|tg_id&gt; &lt;PRO|AGENCY&gt; [days] — set a plan (default 30 days)',
  '/admin revoke &lt;@username|tg_id&gt; — back to FREE immediately',
].join('\n');

function isAdmin(ctx: BotContext): boolean {
  return ctx.chat?.type === 'private' && config.adminTgIds.has(ctx.from?.id ?? 0);
}

/** Resolve `@username` or a numeric tg id to the user plus their workspaces. */
async function findTarget(raw: string) {
  const byId = /^\d+$/.test(raw) ? BigInt(raw) : null;
  const username = raw.replace(/^@/, '');
  return prisma.user.findFirst({
    where: byId !== null ? { tgId: byId } : { username: { equals: username, mode: 'insensitive' } },
    include: { memberships: { include: { workspace: true } } },
  });
}

async function workspaceList(): Promise<string> {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { members: { include: { user: true } }, subscriptions: { orderBy: { currentPeriodEnd: 'desc' }, take: 1 } },
  });
  if (workspaces.length === 0) return 'No workspaces yet.';
  const lines = workspaces.map((ws) => {
    const owner = ws.members[0]?.user;
    const ownerLabel = owner?.username ? `@${escapeHtml(owner.username)}` : String(owner?.tgId ?? '?');
    const sub = ws.subscriptions[0];
    const until = sub && ws.plan !== Plan.FREE ? ` until ${sub.currentPeriodEnd.toISOString().slice(0, 10)}` : '';
    return `• <b>${escapeHtml(ws.name)}</b> — ${ws.plan}${until} — ${ownerLabel}`;
  });
  return `<b>Workspaces (${workspaces.length} newest)</b>\n${lines.join('\n')}`;
}

export function registerAdmin(bot: Bot<BotContext>): void {
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx)) return;

    const args = (ctx.match ?? '').trim().split(/\s+/).filter(Boolean);
    const [action, targetRaw, planRaw, daysRaw] = args;

    if (!action) {
      await ctx.reply(`${USAGE}\n\n${await workspaceList()}`, { parse_mode: 'HTML' });
      return;
    }

    if (action !== 'grant' && action !== 'revoke') {
      await ctx.reply(USAGE, { parse_mode: 'HTML' });
      return;
    }
    if (!targetRaw) {
      await ctx.reply(USAGE, { parse_mode: 'HTML' });
      return;
    }

    const user = await findTarget(targetRaw);
    if (!user) {
      await ctx.reply(`User <code>${escapeHtml(targetRaw)}</code> not found.`, { parse_mode: 'HTML' });
      return;
    }
    const workspace = user.memberships[0]?.workspace;
    if (!workspace) {
      await ctx.reply(`User <code>${escapeHtml(targetRaw)}</code> has no workspace.`, { parse_mode: 'HTML' });
      return;
    }

    if (action === 'revoke') {
      await grantPlanManually(workspace.id, Plan.FREE, 0);
      await ctx.reply(`Workspace <b>${escapeHtml(workspace.name)}</b> is now FREE.`, { parse_mode: 'HTML' });
      return;
    }

    const plan = (planRaw ?? '').toUpperCase();
    if (!isPaidPlan(plan)) {
      await ctx.reply('Plan must be PRO or AGENCY.', { parse_mode: 'HTML' });
      return;
    }
    const days = daysRaw === undefined ? DEFAULT_GRANT_DAYS : Number(daysRaw);
    if (!Number.isInteger(days) || days < 1 || days > MAX_GRANT_DAYS) {
      await ctx.reply(`Days must be an integer between 1 and ${MAX_GRANT_DAYS}.`, { parse_mode: 'HTML' });
      return;
    }

    const subscription = await grantPlanManually(workspace.id, PLANS[plan].plan, days);
    const until = subscription?.currentPeriodEnd.toISOString().slice(0, 10) ?? '?';
    await ctx.reply(
      `Workspace <b>${escapeHtml(workspace.name)}</b> is now <b>${plan}</b> until ${until}.`,
      { parse_mode: 'HTML' },
    );
  });
}
