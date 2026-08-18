import { LinksView } from '@/components/dashboard/links/LinksView';

export default async function ChannelLinksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LinksView channelId={id} />;
}
