import cron from 'node-cron';
import { getPrisma, Plan, SubscriptionStatus } from '@tgpulse/db';
import { getActiveSubscription } from './billing';

/**
 * Daily downgrade sweep. Telegram cancels recurring Stars subscriptions on its side,
 * so a missing renewal only shows up as a period that quietly ran out.
 */

const prisma = getPrisma();

const EXPIRY_CRON = '0 3 * * *'; // 03:00 UTC every day

/**
 * Expire subscriptions whose period has ended and drop those workspaces back to FREE.
 * Data is never deleted: over-quota channels only become read-only.
 * Returns how many rows were expired.
 */
export async function expireStaleSubscriptions(): Promise<number> {
  const stale = await prisma.subscription.findMany({
    where: { status: { not: SubscriptionStatus.EXPIRED }, currentPeriodEnd: { lte: new Date() } },
    select: { id: true, workspaceId: true },
  });
  if (stale.length === 0) return 0;

  await prisma.subscription.updateMany({
    where: { id: { in: stale.map((row) => row.id) } },
    data: { status: SubscriptionStatus.EXPIRED },
  });

  // A workspace may hold another row that is still valid, so downgrade only the ones left bare.
  for (const workspaceId of new Set(stale.map((row) => row.workspaceId))) {
    if (await getActiveSubscription(workspaceId)) continue;
    await prisma.workspace.update({ where: { id: workspaceId }, data: { plan: Plan.FREE } });
  }

  return stale.length;
}

export function startBillingCron(): void {
  cron.schedule(
    EXPIRY_CRON,
    () => {
      expireStaleSubscriptions().catch((error) => console.error('Subscription sweep failed', error));
    },
    { timezone: 'Etc/UTC' },
  );
}
