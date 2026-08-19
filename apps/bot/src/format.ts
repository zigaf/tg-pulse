/** HTML-escape user-provided text before embedding into parse_mode: 'HTML' messages. */
export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Format a net value with an explicit sign: 5 -> "+5", -3 -> "-3", 0 -> "+0". */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Format a 0..1 share as a percentage: 0.634 -> "63%". Rounds to "<1%" instead of "0%". */
export function percent(share: number): string {
  const value = share * 100;
  if (value > 0 && value < 1) return '<1%';
  return `${Math.round(value)}%`;
}

/** Cut a label down so it still fits a Telegram inline button. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
