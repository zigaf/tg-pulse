import { RevenueView } from '@/components/dashboard/revenue/RevenueView';

export default async function ChannelRevenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RevenueView channelId={id} />;
}
