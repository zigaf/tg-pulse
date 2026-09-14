import '../globals.css';
import { RootDocument, rootMetadata } from '../root-document';

export const metadata = rootMetadata;

/** Landing, invite acceptance and public client reports: no Telegram SDK here. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument>{children}</RootDocument>;
}
