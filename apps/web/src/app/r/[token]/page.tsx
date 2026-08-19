import { PublicReport } from '@/components/report/PublicReport';

export const metadata = {
  title: 'Channel report · TGPulse',
  description: 'Read-only Telegram channel report shared via TGPulse.',
  robots: { index: false, follow: false },
};

/** Public page: no session, no sidebar, no workspace data. */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicReport token={token} />;
}
