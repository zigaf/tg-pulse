import { MiniAppBridge } from '@/components/dashboard/shell/MiniAppBridge';

/**
 * Shared wrapper for every dashboard route (/app, /app/team, /app/billing,
 * /app/channels/[id]/*). It only mounts the Telegram Mini App bridge, which is a
 * no-op outside Telegram, so the pages themselves stay unaware of the host.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MiniAppBridge />
      {children}
    </>
  );
}
