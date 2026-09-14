import { ChannelShell } from '@/components/dashboard/shell/ChannelShell';

export default async function ChannelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChannelShell channelId={id}>{children}</ChannelShell>;
}
