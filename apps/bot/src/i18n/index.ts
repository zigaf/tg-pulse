import { en } from './en';
import { ru } from './ru';

/** Shape of every locale file. `en` is the reference, so a gap in `ru` fails the build. */
export type Dict = typeof en;

export type Lang = 'en' | 'ru';

export const DEFAULT_LANG: Lang = 'en';

const DICTS: Record<Lang, Dict> = { en, ru };

/** Telegram language codes that mean a CIS audience, which reads Russian. */
const RUSSIAN_PREFIXES = ['ru', 'be', 'uk'];

export function getDict(lang: Lang): Dict {
  return DICTS[lang];
}

/**
 * Map a Telegram / stored language code onto a supported locale.
 * Returns null for a missing code so callers can fall through to the next source.
 */
export function langFromCode(code: string | null | undefined): Lang | null {
  if (!code) return null;
  const lower = code.toLowerCase();
  return RUSSIAN_PREFIXES.some((prefix) => lower.startsWith(prefix)) ? 'ru' : 'en';
}

/** Human name of a locale, always written in that locale. */
export function langName(dict: Dict, lang: Lang): string {
  return lang === 'ru' ? dict.buttons.russian : dict.buttons.english;
}

export { en, ru };
