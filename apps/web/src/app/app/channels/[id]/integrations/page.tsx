import { IntegrationsView } from '@/components/dashboard/integrations/IntegrationsView';

export default async function ChannelIntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IntegrationsView channelId={id} />;
}
