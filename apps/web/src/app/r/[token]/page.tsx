import { PublicReport } from '@/components/report/PublicReport';

// Deliberately brand-neutral: white-label reports must not carry TGPulse in the tab title.
export const metadata = {
  title: 'Channel report',
  description: 'Read-only Telegram channel report.',
  robots: { index: false, follow: false },
};

/** Public page: no session, no sidebar, no workspace data. */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicReport token={token} />;
}
