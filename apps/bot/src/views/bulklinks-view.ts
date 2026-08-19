import { escapeHtml } from '../format';
import type { Dict } from '../i18n';
import { card } from '../ui';

const ICON_BULK = '🧾';

/** Telegram caps a message at 4096 characters; the margin absorbs HTML entities. */
const CHUNK_MAX_CHARS = 3500;
const ARROW = ' → ';

export interface BulkLine {
  label: string;
  url: string;
}

export interface BulkSummary {
  channelTitle: string;
  created: number;
  /** Names dropped because the plan has no room left for them. */
  skippedQuota: number;
  planName: string;
  /** Per-channel link limit that caused the skip. */
  limit: number;
  /** Names dropped because the batch was longer than one run allows. */
  skippedBatch: number;
  batchMax: number;
  /** Set when Telegram or the database interrupted the run. */
  stoppedReason: string | null;
}

export function bulkPickChannelCard(dict: Dict): string {
  return card({ icon: ICON_BULK, title: dict.bulk.title, footer: dict.bulk.pickChannel });
}

export function bulkAskNamesCard(dict: Dict, channelTitle: string, max: number): string {
  return card({
    icon: ICON_BULK,
    title: dict.bulk.title,
    crumbs: [dict.nav.channels, escapeHtml(channelTitle)],
    body: [dict.bulk.ask(max)],
    footer: dict.bulk.askFooter,
  });
}

/** What the run did, before the links themselves: created, skipped and why. */
export function bulkResultCard(dict: Dict, summary: BulkSummary): string {
  const body = [summary.created > 0 ? dict.bulk.created(summary.created) : dict.bulk.nothingCreated];

  if (summary.skippedQuota > 0) {
    body.push(dict.bulk.skippedQuota(summary.skippedQuota, summary.planName, summary.limit));
  }
  if (summary.skippedBatch > 0) {
    body.push(dict.bulk.skippedBatch(summary.skippedBatch, summary.batchMax));
  }
  if (summary.stoppedReason) {
    body.push(dict.bulk.stopped(escapeHtml(summary.stoppedReason)));
  }

  return card({
    icon: ICON_BULK,
    title: dict.bulk.resultTitle,
    crumbs: [dict.nav.channels, escapeHtml(summary.channelTitle)],
    body,
    footer: summary.created > 0 ? dict.bulk.resultFooter : undefined,
  });
}

/**
 * "label -> URL" as monospace blocks, split across messages when the batch is long.
 * Copying a whole block out of Telegram is one tap, which is the point of the format.
 */
export function bulkLinkBlocks(lines: BulkLine[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const line of lines) {
    const rendered = escapeHtml(`${line.label}${ARROW}${line.url}`);
    if (current.length > 0 && length + rendered.length > CHUNK_MAX_CHARS) {
      blocks.push(`<pre>${current.join('\n')}</pre>`);
      current = [];
      length = 0;
    }
    current.push(rendered);
    length += rendered.length + 1;
  }

  if (current.length > 0) blocks.push(`<pre>${current.join('\n')}</pre>`);
  return blocks;
}
