import { OverviewView } from '@/components/dashboard/overview/OverviewView';

export default async function ChannelOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OverviewView channelId={id} />;
}
