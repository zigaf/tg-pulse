import { ContentView } from '@/components/dashboard/content/ContentView';

export default async function ChannelContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContentView channelId={id} />;
}
