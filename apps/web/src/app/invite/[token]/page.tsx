import { InviteAcceptView } from '@/components/dashboard/invite/InviteAcceptView';

export const metadata = {
  title: 'Workspace invite · TGPulse',
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteAcceptView token={token} />;
}
