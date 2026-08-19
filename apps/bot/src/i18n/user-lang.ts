import { getPrisma } from '@tgpulse/db';
import { DEFAULT_LANG, langFromCode, type Lang } from './index';

const prisma = getPrisma();

/** The stored locale changes rarely, so a short cache keeps dialogs off the DB. */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  lang: Lang;
  expiresAt: number;
}

const cache = new Map<number, CacheEntry>();

function remember(tgUserId: number, lang: Lang): Lang {
  cache.set(tgUserId, { lang, expiresAt: Date.now() + CACHE_TTL_MS });
  return lang;
}

/**
 * Locale for a Telegram user: stored preference first, then the code their client
 * reports, then the default. Never throws: a DB hiccup must not break a reply.
 */
export async function getUserLang(tgUserId: number, clientCode?: string): Promise<Lang> {
  const cached = cache.get(tgUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.lang;

  const user = await prisma.user
    .findUnique({ where: { tgId: BigInt(tgUserId) }, select: { languageCode: true } })
    .catch(() => null);

  return remember(tgUserId, langFromCode(user?.languageCode) ?? langFromCode(clientCode) ?? DEFAULT_LANG);
}

/**
 * Persist the chosen locale. Users who never connected a channel have no row yet,
 * so the preference creates a minimal one.
 */
export async function setUserLang(tgUserId: number, lang: Lang): Promise<void> {
  await prisma.user.upsert({
    where: { tgId: BigInt(tgUserId) },
    update: { languageCode: lang },
    create: { tgId: BigInt(tgUserId), languageCode: lang },
  });
  remember(tgUserId, lang);
}

/** Locale of each given user, in one query. Used by report and alert fan-out. */
export async function getLangsByTgId(tgUserIds: number[]): Promise<Map<number, Lang>> {
  const langs = new Map<number, Lang>();
  if (tgUserIds.length === 0) return langs;

  const users = await prisma.user.findMany({
    where: { tgId: { in: tgUserIds.map((id) => BigInt(id)) } },
    select: { tgId: true, languageCode: true },
  });
  for (const user of users) {
    langs.set(Number(user.tgId), langFromCode(user.languageCode) ?? DEFAULT_LANG);
  }
  return langs;
}
