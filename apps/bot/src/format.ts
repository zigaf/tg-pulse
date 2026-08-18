/** HTML-escape user-provided text before embedding into parse_mode: 'HTML' messages. */
export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Format a net value with an explicit sign: 5 -> "+5", -3 -> "-3", 0 -> "+0". */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
