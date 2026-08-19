'use client';

import { ApiKeysPanel } from './ApiKeysPanel';
import { CsvImportPanel } from './CsvImportPanel';
import { IngestPanel } from './IngestPanel';
import styles from './revenue.module.css';

/** The three ways sales get into TGPulse, in the order a new channel needs them. */
export function ConnectPanels({ channelId, onImported }: { channelId: string; onImported: () => void }) {
  return (
    <div className={styles.panels}>
      <ApiKeysPanel channelId={channelId} />
      <IngestPanel />
      <CsvImportPanel channelId={channelId} onImported={onImported} />
    </div>
  );
}
