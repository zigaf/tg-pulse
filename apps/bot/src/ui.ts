import { GrammyError, type Context, type InlineKeyboard } from 'grammy';

/**
 * Visual language of every bot message.
 *
 *   {icon} <b>Title</b>
 *   <i>Breadcrumbs › go › here</i>
 *   ─────────────
 *   <pre>numbers, aligned</pre>
 *   free-form body lines
 *
 *   <i>footer hint</i>
 *
 * Titles, crumbs and body lines carrying user data must be escaped by the caller.
 */

/** Non-breaking space: the only padding character Telegram keeps outside <pre>. */
const NBSP = ' ';
const CRUMB_SEPARATOR = ' › ';
const RULE = '─────────────';
/** Column the value of a kv() row is right-aligned to. */
const KV_WIDTH = 22;

const SPARK_LEVELS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const BAR_FULL = '█';
const BAR_EMPTY = '░';

const TREND_UP = '▲';
const TREND_DOWN = '▼';
const TREND_FLAT = '▬';

const NOT_MODIFIED = 'message is not modified';

export interface CardOptions {
  /** Single leading emoji. One per card, never per line. */
  icon?: string;
  title: string;
  crumbs?: string[];
  /** Monospace block: use for anything numeric, built with kv(). */
  rows?: string[];
  /** Free-form HTML lines rendered below the numbers. */
  body?: string[];
  /** Italic hint closing the card: what to do next. */
  footer?: string;
}

/** Render one message in the shared card layout. */
export function card(options: CardOptions): string {
  const { icon, title, crumbs, rows, body, footer } = options;
  const parts: string[] = [icon ? `${icon} <b>${title}</b>` : `<b>${title}</b>`];

  if (crumbs && crumbs.length > 0) parts.push(`<i>${crumbs.join(CRUMB_SEPARATOR)}</i>`);
  if ((rows && rows.length > 0) || (body && body.length > 0)) parts.push(RULE);
  if (rows && rows.length > 0) parts.push(`<pre>${rows.join('\n')}</pre>`);
  if (body && body.length > 0) parts.push(body.join('\n'));
  if (footer) parts.push('', `<i>${footer}</i>`);

  return parts.join('\n');
}

/** Label on the left, value right-aligned to a fixed column. */
export function kv(label: string, value: string | number): string {
  const text = String(value);
  const gap = Math.max(1, KV_WIDTH - label.length - text.length);
  return `${label}${NBSP.repeat(gap)}${text}`;
}

/** Horizontal mini-histogram: bar(74, 120, 10) -> "██████░░░░". */
export function bar(value: number, max: number, width: number): string {
  if (width <= 0) return '';
  if (max <= 0 || value <= 0) return BAR_EMPTY.repeat(width);
  const filled = Math.min(width, Math.max(1, Math.round((value / max) * width)));
  return BAR_FULL.repeat(filled) + BAR_EMPTY.repeat(width - filled);
}

/** Compact time series: sparkline([2, 9, 4]) -> "▁█▃". Scaled to its own maximum. */
export function sparkline(values: number[]): string {
  if (values.length === 0) return '';
  const max = Math.max(...values);
  const top = SPARK_LEVELS.length - 1;
  if (max <= 0) return SPARK_LEVELS[0].repeat(values.length);
  return values.map((value) => SPARK_LEVELS[Math.round((value / max) * top)]).join('');
}

/**
 * Period-over-period badge, language independent: "▲ +34%", "▼ -12%", "▬ 0%".
 * With no previous data the absolute change is shown instead of a meaningless ratio.
 */
export function trend(current: number, previous: number): string {
  if (previous === 0) {
    if (current === 0) return `${TREND_FLAT} 0`;
    return `${TREND_UP} +${current}`;
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return `${TREND_UP} +${change}%`;
  if (change < 0) return `${TREND_DOWN} ${change}%`;
  return `${TREND_FLAT} 0%`;
}

/** Edit in place, tolerating "message is not modified" (e.g. re-opening the same view). */
export async function safeEdit(
  ctx: Context,
  text: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    if (error instanceof GrammyError && error.description.includes(NOT_MODIFIED)) return;
    throw error;
  }
}
