import { escapeHtml, percent, signed } from '../format';
import type { Dict } from '../i18n';
import { buyerTag, sourceName } from '../sources';
import { STATS_WINDOW_DAYS, type ChannelStats } from '../stats';
import { bar, card, kv, sparkline, trend } from '../ui';

const ICON_STATS = '📊';
const BAR_WIDTH = 10;

function isEmpty(stats: ChannelStats): boolean {
  return stats.joins === 0 && stats.leaves === 0;
}

function numberRows(dict: Dict, stats: ChannelStats): string[] {
  return [
    kv(dict.stats.joins, stats.joins),
    kv(dict.stats.leaves, stats.leaves),
    kv(dict.stats.net, signed(stats.joins - stats.leaves)),
  ];
}

/** Sparkline of the daily curve, the week-over-week badge and the ranked sources. */
function detailLines(dict: Dict, stats: ChannelStats): string[] {
  const lines = [
    `<code>${sparkline(stats.dailyJoins)}</code> ${dict.stats.perDay} ${trend(stats.joins, stats.previousJoins)}`,
  ];
  if (stats.topSources.length === 0) return lines;

  const top = stats.topSources[0].joins;
  lines.push('', `<b>${dict.stats.topSources}</b>`);
  for (const source of stats.topSources) {
    const share = stats.sourceJoins > 0 ? percent(source.joins / stats.sourceJoins) : percent(0);
    const name = `${sourceName(dict, source)}${buyerTag(dict, source.buyer)}`;
    lines.push(`<code>${bar(source.joins, top, BAR_WIDTH)}</code> ${share} · ${name} (${source.joins})`);
  }
  return lines;
}

/** One channel inside the multi-channel /stats card. */
function channelSection(dict: Dict, stats: ChannelStats): string {
  const title = `<b>${escapeHtml(stats.title)}</b>`;
  if (isEmpty(stats)) return [title, dict.stats.empty].join('\n');
  return [title, `<pre>${numberRows(dict, stats).join('\n')}</pre>`, ...detailLines(dict, stats)].join('\n');
}

/** /stats: every channel of the user in a single message. */
export function allStatsCard(dict: Dict, channels: ChannelStats[]): string {
  return card({
    icon: ICON_STATS,
    title: dict.stats.title(STATS_WINDOW_DAYS),
    body: channels.flatMap((stats, index) =>
      index === 0 ? [channelSection(dict, stats)] : ['', channelSection(dict, stats)],
    ),
    footer: channels.some((stats) => !isEmpty(stats)) ? undefined : dict.stats.hint,
  });
}

/** Channels › <channel> › Stats, reached from the channel menu. */
export function channelStatsCard(dict: Dict, stats: ChannelStats): string {
  const empty = isEmpty(stats);
  return card({
    icon: ICON_STATS,
    title: dict.stats.title(STATS_WINDOW_DAYS),
    crumbs: [dict.nav.channels, escapeHtml(stats.title)],
    rows: empty ? undefined : numberRows(dict, stats),
    body: empty ? [dict.stats.empty] : detailLines(dict, stats),
    footer: empty ? dict.stats.hint : undefined,
  });
}
