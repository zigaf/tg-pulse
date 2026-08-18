function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  /** Public base URL of this service, e.g. https://go.tgpulse.app (Railway domain). */
  publicUrl: process.env.PUBLIC_URL ?? '',
  /** If set, bot runs in webhook mode on /webhook/<secret>; otherwise long polling (dev). */
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  port: Number(process.env.PORT ?? 8080),
};
