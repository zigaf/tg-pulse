'use client';

import { CheckCircle, Table, UploadSimple } from '@phosphor-icons/react';
import { useState, type ChangeEvent } from 'react';
import { importSales, type SalesImportResult } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import ui from '../shared/ui.module.css';
import styles from './revenue.module.css';

/** Mirrors the server limit so oversized files fail before the upload. */
const MAX_CSV_BYTES = 1024 * 1024;
/** The API returns at most this many row errors, so the list can be truncated. */
const MAX_REPORTED_ERRORS = 20;
const SAMPLE = `tg_user_id,username,amount,currency,kind,external_id,occurred_at
641223510,,49.90,USD,PURCHASE,order_10241,2026-08-18T09:41:00Z
,alexpetrov,19.00,USD,LEAD,,2026-08-18T11:02:00Z`;

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** CSV upload for historical or manual sales; file is read locally, then posted as text. */
export function CsvImportPanel({ channelId, onImported }: { channelId: string; onImported: () => void }) {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SalesImportResult | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-picking the same file after a failed attempt.
    event.target.value = '';
    if (!file) return;

    setError('');
    setResult(null);
    if (file.size > MAX_CSV_BYTES) {
      setError('File is larger than 1 MB. Split it into smaller batches.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCsv(typeof reader.result === 'string' ? reader.result : '');
      setFileName(file.name);
    };
    reader.onerror = () => setError('Could not read that file. Try pasting the rows instead.');
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const payload = csv.trim();
    if (isPending || payload.length === 0) return;
    if (byteLength(payload) > MAX_CSV_BYTES) {
      setError('CSV is larger than 1 MB. Split it into smaller batches.');
      return;
    }

    setIsPending(true);
    setError('');
    setResult(null);
    const response = await importSales(channelId, payload);
    setIsPending(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setResult(response.data);
    if (response.data.accepted > 0) onImported();
  };

  return (
    <section className={`${ui.card} ${styles.panel}`} aria-labelledby="csv-import-title">
      <header className={styles.panelHead}>
        <span className={styles.panelHeading}>
          <span className={styles.panelIcon} aria-hidden="true">
            <Table size={16} weight="duotone" />
          </span>
          <h2 id="csv-import-title" className={styles.panelTitle}>
            Import CSV
          </h2>
        </span>
      </header>

      <p className={styles.panelHint}>
        For history or one-off exports. Needs an <code>amount</code> column plus <code>tg_user_id</code> or{' '}
        <code>username</code>; <code>currency</code>, <code>kind</code>, <code>external_id</code> and{' '}
        <code>occurred_at</code> are optional. Invalid rows are reported instead of failing the whole file.
      </p>

      <div className={styles.importControls}>
        <label className={styles.fileLabel}>
          <UploadSimple size={15} />
          Choose file
          <input
            type="file"
            accept=".csv,text/csv"
            className={styles.fileInput}
            onChange={handleFile}
            disabled={isPending}
          />
        </label>
        {fileName ? (
          <span className={styles.fileName} title={fileName}>
            {fileName}
          </span>
        ) : (
          <span className={styles.fileName}>or paste rows below</span>
        )}
      </div>

      <label htmlFor="csv-input" className={ui.label}>
        CSV rows
      </label>
      <textarea
        id="csv-input"
        className={styles.csvArea}
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        placeholder={SAMPLE}
        spellCheck={false}
        disabled={isPending}
      />

      {error ? (
        <p className={styles.actionError} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.importFoot}>
        {result ? (
          <p className={styles.importSummary}>
            <CheckCircle size={15} weight="fill" />
            {formatNumber(result.accepted)} rows imported, {formatNumber(result.matched)} matched to subscribers
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          className={ui.btnPrimary}
          onClick={() => void handleImport()}
          disabled={isPending || csv.trim().length === 0}
        >
          {isPending ? 'Importing' : 'Import'}
        </button>
      </div>

      {result && result.errors.length > 0 ? (
        <div className={styles.importErrors}>
          <p className={styles.importErrorsTitle}>
            Rejected rows{result.errors.length === MAX_REPORTED_ERRORS ? ' (first 20)' : ''}
          </p>
          <div className={styles.importErrorList}>
            {result.errors.map((rowError) => (
              <p key={rowError.row} className={styles.importErrorRow}>
                <span className={styles.importErrorLine}>line {rowError.row}</span>
                <span>{rowError.message}</span>
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
