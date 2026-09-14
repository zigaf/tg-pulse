/**
 * Security headers for every response.
 *
 * The CSP allows exactly what the app actually uses: the Telegram Login Widget
 * and Mini App SDK scripts from telegram.org and the widget iframe from
 * oauth.telegram.org; avatars come from Telegram's rotating CDN hosts, hence
 * `img-src https:`. `script-src` keeps 'unsafe-inline' because Next.js App Router
 * bootstraps hydration with inline scripts and a nonce-based policy would force
 * every static page (the whole landing) into dynamic rendering — a deliberate
 * tradeoff.
 *
 * `frame-ancestors` is the one directive that differs per route, so the shared
 * directives live in one array and both policies are built from it; they cannot
 * drift apart.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Next's dev bundles rely on eval; production bundles never do, so the relaxation is dev-only.
  `script-src 'self' 'unsafe-inline' https://telegram.org${
    process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://oauth.telegram.org',
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

/** @param {string} frameAncestors  value of the frame-ancestors directive */
const buildCsp = (frameAncestors) => [...CSP_DIRECTIVES, `frame-ancestors ${frameAncestors}`].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: buildCsp("'none'") },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/**
 * The dashboard (/app/...) also runs as a Telegram Mini App, and Telegram Web
 * (web.telegram.org) embeds Mini Apps in an iframe, so that origin alone may frame
 * it. `X-Frame-Options` has no allow-list syntax; SAMEORIGIN is the closest value
 * and is ignored anyway by every browser that understands CSP `frame-ancestors`,
 * which takes precedence. Older clients without CSP support still get a sane
 * fallback instead of an open policy. Landing and API keep the DENY rule above.
 */
const MINI_APP_OVERRIDES = {
  'Content-Security-Policy': buildCsp('https://web.telegram.org'),
  'X-Frame-Options': 'SAMEORIGIN',
};

const MINI_APP_HEADERS = SECURITY_HEADERS.map((header) =>
  header.key in MINI_APP_OVERRIDES ? { ...header, value: MINI_APP_OVERRIDES[header.key] } : header,
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Order matters: Next applies every matching rule and a later value for the
    // same key wins, so the dashboard rule must come after the global one.
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/app/:path*', headers: MINI_APP_HEADERS },
    ];
  },
};

export default nextConfig;
