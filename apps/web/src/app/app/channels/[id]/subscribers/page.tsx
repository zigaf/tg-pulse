import { SubscribersView } from '@/components/dashboard/subscribers/SubscribersView';

export default async function ChannelSubscribersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubscribersView channelId={id} />;
}
