/**
 * Security headers for every response.
 *
 * The CSP allows exactly what the app actually uses: the Telegram Login Widget
 * script from telegram.org and its iframe from oauth.telegram.org; avatars come
 * from Telegram's rotating CDN hosts, hence `img-src https:`. `script-src`
 * keeps 'unsafe-inline' because Next.js App Router bootstraps hydration with
 * inline scripts and a nonce-based policy would force every static page
 * (the whole landing) into dynamic rendering — a deliberate tradeoff.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://telegram.org",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://oauth.telegram.org',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
