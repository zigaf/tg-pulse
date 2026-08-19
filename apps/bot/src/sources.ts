import { escapeHtml } from './format';
import type { Dict } from './i18n';

/** A grouped-by-source row: no linkId means the join was organic. */
export interface SourceRef {
  linkId: string | null;
  label: string | null;
}

/** Display name of a traffic source, HTML-safe and localised. */
export function sourceName(dict: Dict, source: SourceRef): string {
  if (source.linkId === null) return dict.sources.organic;
  return source.label === null ? dict.sources.deletedLink : escapeHtml(source.label);
}
