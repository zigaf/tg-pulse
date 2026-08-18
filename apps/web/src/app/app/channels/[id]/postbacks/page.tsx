import { PostbacksView } from '@/components/dashboard/postbacks/PostbacksView';

export default async function ChannelPostbacksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostbacksView channelId={id} />;
}
