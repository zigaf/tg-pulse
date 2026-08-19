import { escapeHtml } from './format';
import type { Dict } from './i18n';

/** A grouped-by-source row: no linkId means the join was organic. */
export interface SourceRef {
  linkId: string | null;
  label: string | null;
  /** Media buyer of the link, when one was recorded. */
  buyer?: string | null;
}

/** Display name of a traffic source, HTML-safe and localised. */
export function sourceName(dict: Dict, source: SourceRef): string {
  if (source.linkId === null) return dict.sources.organic;
  return source.label === null ? dict.sources.deletedLink : escapeHtml(source.label);
}

/** Trailing " · Buyer: name" for a source, empty when nobody owns the placement. */
export function buyerTag(dict: Dict, buyer: string | null | undefined): string {
  return buyer ? ` · ${dict.links.buyer}: ${escapeHtml(buyer)}` : '';
}
