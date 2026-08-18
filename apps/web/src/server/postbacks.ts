import { getPrisma, type Postback } from '@tgpulse/db';
import { ApiError } from './http';

/** Macros supported inside a postback urlTemplate (kept in sync with the bot's postback engine). */
export const POSTBACK_MACROS = [
  'event',
  'slug',
  'label',
  'cid',
  'yclid',
  'gclid',
  'fbclid',
  'ttclid',
  'tg_user_id',
] as const;

export type PostbackMacro = (typeof POSTBACK_MACROS)[number];

/** Substitution values used for template validation and the "Test" endpoint. */
export const TEST_MACRO_VALUES: Record<PostbackMacro, string> = {
  event: 'join',
  slug: 'test',
  label: 'test',
  cid: 'test',
  yclid: 'test',
  gclid: 'test',
  fbclid: 'test',
  ttclid: 'test',
  tg_user_id: '1',
};

const MACRO_PATTERN = /\{([a-z_]+)\}/g;

function isKnownMacro(name: string): name is PostbackMacro {
  return (POSTBACK_MACROS as readonly string[]).includes(name);
}

/** Replace known {macro} tokens with URL-encoded values; unknown tokens are left as is. */
export function renderPostbackTemplate(template: string, values: Record<PostbackMacro, string>): string {
  return template.replace(MACRO_PATTERN, (token, name: string) =>
    isKnownMacro(name) ? encodeURIComponent(values[name]) : token,
  );
}

/**
 * Ensure the template uses known macros only and renders to a valid http(s) URL
 * once test values are substituted. Throws ApiError(400) otherwise.
 */
export function assertValidUrlTemplate(template: string): void {
  const unknown = [...template.matchAll(MACRO_PATTERN)]
    .map((match) => match[1])
    .filter((name) => !isKnownMacro(name));
  if (unknown.length > 0) {
    const list = [...new Set(unknown)].map((name) => `{${name}}`).join(', ');
    throw new ApiError(400, `Unknown macros: ${list}`);
  }

  const rendered = renderPostbackTemplate(template, TEST_MACRO_VALUES);
  let url: URL;
  try {
    url = new URL(rendered);
  } catch {
    throw new ApiError(400, 'urlTemplate must be a valid URL after macro substitution');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError(400, 'urlTemplate must use http or https');
  }
}

/**
 * Load a postback and ensure the user is a member of the workspace owning its channel.
 * Throws 404 for unknown postbacks, 403 for foreign ones.
 */
export async function assertPostbackAccess(userId: string, postbackId: string): Promise<Postback> {
  const prisma = getPrisma();

  const postback = await prisma.postback.findUnique({
    where: { id: postbackId },
    include: { channel: { select: { workspaceId: true } } },
  });
  if (!postback) {
    throw new ApiError(404, 'Postback not found');
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: postback.channel.workspaceId } },
  });
  if (!membership) {
    throw new ApiError(403, 'No access to this postback');
  }

  const { channel: _channel, ...rest } = postback;
  return rest;
}

/** API-safe postback shape shared by all postback endpoints. */
export function toPostbackDto(postback: Postback) {
  return {
    id: postback.id,
    channelId: postback.channelId,
    name: postback.name,
    urlTemplate: postback.urlTemplate,
    onJoin: postback.onJoin,
    onLeave: postback.onLeave,
    isActive: postback.isActive,
    createdAt: postback.createdAt,
  };
}
