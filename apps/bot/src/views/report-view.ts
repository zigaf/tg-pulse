import { escapeHtml, signed } from '../format';
import type { Dict } from '../i18n';
import { sourceName, type SourceRef } from '../sources';
import { card, kv } from '../ui';

const ICON_REPORT = '🗓';

export interface ReportSource extends SourceRef {
  count: number;
}

export interface ChannelReport {
  title: string;
  joins: number;
  leaves: number;
  topSources: ReportSource[];
  leaverSources: ReportSource[];
}

function sourceList(dict: Dict, sources: ReportSource[]): string {
  return sources.map((source) => `${sourceName(dict, source)} (<code>${source.count}</code>)`).join(', ');
}

function channelSection(dict: Dict, report: ChannelReport): string {
  const lines = [
    `<b>${escapeHtml(report.title)}</b>`,
    `<pre>${[
      kv(dict.report.joins, report.joins),
      kv(dict.report.leaves, report.leaves),
      kv(dict.report.net, signed(report.joins - report.leaves)),
    ].join('\n')}</pre>`,
  ];

  if (report.topSources.length > 0) {
    lines.push(`${dict.report.topSources}: ${sourceList(dict, report.topSources)}`);
  }
  if (report.leaves > 0) {
    lines.push(`${dict.report.leaversCame}: ${sourceList(dict, report.leaverSources)}`);
  }
  return lines.join('\n');
}

/** Daily digest sent by cron, rendered in the recipient's own language. */
export function dailyReportCard(dict: Dict, date: string, reports: ChannelReport[]): string {
  const quiet = reports.every((report) => report.joins === 0 && report.leaves === 0);
  return card({
    icon: ICON_REPORT,
    title: dict.report.title(date),
    body: reports.flatMap((report, index) =>
      index === 0 ? [channelSection(dict, report)] : ['', channelSection(dict, report)],
    ),
    footer: quiet ? dict.report.empty : undefined,
  });
}
