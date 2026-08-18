import { SESSION_COOKIE, sessionCookieOptions } from '@/server/auth';
import { jsonOk } from '@/server/http';

export const runtime = 'nodejs';

export async function POST() {
  const res = jsonOk(null);
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return res;
}
