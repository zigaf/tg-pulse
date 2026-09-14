# Telegram Mini App: configure everything from the bot

Date: 2026-09-14. Status: approved (section 1 explicitly, sections 2-4 as stated decisions).

## Goal

A user can manage every TGPulse setting without leaving Telegram: ad integrations, postbacks,
tracked links with UTM, share links, API keys, team, invites, branding, billing. The existing web
dashboard (`apps/web`, routes under `/app`) opens inside Telegram as a Mini App. No second UI.

Non-goals: native chat wizards for settings (already-existing ones stay), a Russian locale for the
dashboard, digest scheduling, workspace switcher in chat. These are follow-ups.

## 1. Architecture and auth

- Dashboard loads `https://telegram.org/js/telegram-web-app.js` (CSP already allows telegram.org
  scripts). Mini App mode = `window.Telegram.WebApp.initData` is non-empty.
- New `POST /api/auth/tma` with body `{ initData: string }`. Server verifies the Mini Apps
  signature: secret = HMAC-SHA256(key="WebAppData", msg=BOT_TOKEN); data_check_string = sorted
  `key=value` lines of every field except `hash`; compare HMAC-SHA256(secret, dcs) to `hash` with
  timingSafeEqual. Reject when `auth_date` is older than 1 hour. Parse `user` (JSON) for
  id/username/first_name/last_name/photo_url. Upsert `User` by `tgId`, create a personal workspace
  when the user has no membership (same code path as the widget login, extracted into one shared
  function in `apps/web/src/server/auth.ts`). Rate-limited like the widget login.
  Response: `{ ok: true, data: { token, user } }`. Token = the same HS256 session JWT, returned in
  the body only. No cookie, no LoginNonce (initData is constant for the whole open session, so a
  one-time nonce would break reloads; the freshness window is the replay bound).
- Session reading: `getSessionUserId` / `getSessionUser` accept the cookie OR an
  `Authorization: Bearer <jwt>` header (read via `headers()` from `next/headers`), so the ~30
  route handlers stay untouched. Cookie session keeps working exactly as before.
- Client: `apps/web/src/lib/tma.ts` owns detection, `ready()`/`expand()`, header/background
  colors matching `--color-bg`, the in-memory bearer token, and `ensureTmaSession()` which
  exchanges initData once (memoised promise). `request()` in `lib/api.ts` awaits it before every
  fetch in Mini App mode and attaches the header; on a 401 in Mini App mode it re-exchanges once.
  Logout and the Telegram Login Widget are hidden in Mini App mode. Telegram BackButton is shown on
  every `/app/...` page except `/app` and triggers `router.back()`.
- Headers: global CSP keeps `frame-ancestors 'none'` and `X-Frame-Options: DENY`. A second
  `next.config.mjs` headers rule for `/app/:path*` overrides CSP with
  `frame-ancestors https://web.telegram.org` and sets `X-Frame-Options: SAMEORIGIN` (ignored by
  browsers when frame-ancestors is present; Telegram Web embeds Mini Apps in an iframe).

## 2. Bot entry points (`apps/bot`)

- `menus.ts`: `openAppButton(keyboard, text, path)` helper. When `config.dashboardUrl` is https it
  adds a `web_app` button, otherwise a plain `url` button (Telegram rejects non-https web_app
  URLs, and local dev uses http). `dashboardUrl` already points at `/app`.
- Chat menu button: at startup `setMyCommands` is followed by `setChatMenuButton` (global
  default, text from the EN dict) when dashboardUrl is https. On `/start` and after `/language`
  the per-chat menu button is set with the user's locale text.
- New `/settings` command (added to the command list, both locales): a card with web_app buttons
  Dashboard (`/app`), Team & branding (`/app/team?ws=<workspaceId>`), Billing
  (`/app/billing?ws=<workspaceId>`), plus one row per channel opening
  `/app/channels/<id>/integrations`. Uses existing `teamHref`/`billingHref` URL shapes from the web.
- Channel card (`ch:open`): a row of web_app buttons Integrations, Postbacks, Share report
  pointing at `/app/channels/<id>/integrations|postbacks|share`.
- `/start` onboarding card and `/help`: an Open dashboard web_app button.
- i18n: every new string added to both `i18n/en.ts` and `i18n/ru.ts` (the Dict type enforces it).

## 3. Mobile pass (`apps/web`)

The settings surfaces must be usable at 375px inside Telegram: shell nav, integrations
(ProviderCard, ConnectModal, HealthTable), postbacks (table + AddPostbackModal), team
(MembersTable, InvitesTable, BrandingCard, InviteModal), links table, share links. Rules: no
horizontal overflow, tables collapse to stacked cards or scroll inside their own container, modals
are full-height sheets, tap targets >= 40px. Verified with Playwright screenshots at 375 and 768
with `/api/*` mocked by fixtures (there is no local database).

## 4. Testing

- Vitest (root `npm test`): `verifyTmaInitData` (valid, tampered hash, stale auth_date, missing
  user), bearer session reading, `openAppButton` https/http switch, dict parity for new keys.
- Playwright screenshots for the mobile pass. Manual: open the bot menu button in a real Telegram
  client against a deployed build.
