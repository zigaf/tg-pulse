function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const publicUrl = process.env.PUBLIC_URL ?? '';

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  /** Public base URL of this service, e.g. https://go.tgpulse.app (Railway domain). */
  publicUrl,
  /** If set, bot runs in webhook mode on /webhook/<secret>; otherwise long polling (dev). */
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  port: Number(process.env.PORT ?? 8080),
  /** Base URL for tracking links (go-redirect). Falls back to PUBLIC_URL, then localhost. */
  goBaseUrl: stripTrailingSlash(process.env.GO_BASE_URL ?? (publicUrl || 'http://localhost:8080')),
  /** Web dashboard URL used in bot buttons and help texts. */
  /** Dashboard link shown in bot menus. Set DASHBOARD_URL per environment. */
  dashboardUrl: stripTrailingSlash(process.env.DASHBOARD_URL ?? 'http://localhost:3000/app'),
};
