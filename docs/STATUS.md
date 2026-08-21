# TGPulse status

Live: web https://web-production-1001b.up.railway.app · bot @tgpulse_app_bot · repo zigaf/tg-pulse
Railway project `tg-pulse`: services `web`, `bot`, Postgres. One `railway.json`, role switched by `SERVICE_ROLE`.

## Shipped

**Attribution core.** Bot added as channel admin connects the channel, records the real member count
(`getChatMemberCount`) as a baseline and reconciles it every 6 hours. Every join and leave arrives as a
`chat_member` update and is stored with its source: joins through our unique invite links are attributed
deterministically, the rest fall into organic.

**Tracking links.** Created from the bot (`/newlink`) or the dashboard. Redirect `go/l/:slug` records the
click, the pixel visitor id and ad click ids, then forwards to the invite link.

**Landing pixel.** `<script async src="<go>/pixel.js" data-tgp="<slug>">` collects pageviews, UTM and
yclid/gclid/fbclid/ttclid, persists them across pages and stitches the visitor id onto outbound go-links.

**Conversion postbacks.** URL templates with macros (`{event} {slug} {label} {cid} {yclid} {gclid} {fbclid}
{ttclid} {tg_user_id}`), fired on join/leave, one retry, delivery status persisted per postback. All
server-side fetches of user URLs pass an SSRF guard that revalidates every redirect hop.

**Native ad integrations.** Attributed joins are fed back to the ad platforms through a conversion
outbox: Meta Conversions API (fbclid), Yandex Metrica offline conversions (yclid), TikTok Events
API 2.0 (ttclid) and Google Data Manager API (gclid, no developer token — the legacy
UploadClickConversions path closed to new tokens in June 2026). Credentials AES-256-GCM at rest,
masked hints in the UI, per-connection Test doing a real dry-run call, delivery health per
integration. See docs/AD-INTEGRATIONS.md.

**Revenue and ROMI.** Channel API keys (sha256 at rest, shown once), `POST /api/ingest/sales` webhook, CSV
import, and a report joining sources to revenue, purchases, conversion and revenue per join.

**Seeding antifraud.** Weighted signals (join bursts, 24h/7d churn, missing usernames, Premium share,
click-to-join conversion) produce a 0-100 score and a verdict, with refund-ready wording in `/fraud`.

**Bot UX.** English and Russian (`/language`, per-user locale, localized reports and alerts), onboarding
checklist, breadcrumbs with back/close on every screen, sparklines and ranked source bars, instant
join/leave alerts persisted in the database.

**Dashboard.** Telegram login, channel list, overview (tiles, joins/leaves chart, source breakdown), links
with pixel install, postbacks, subscribers, revenue.

**Monetization.** Free/Pro/Agency with workspace-level quotas (see docs/BILLING.md). Payment runs on
Telegram Stars inside the bot (`/upgrade`, `/billing`): recurring invoice with a one-off fallback,
pre-checkout validation, idempotent activation keyed by the Telegram charge id, daily expiry sweep.
The API gates quota and feature access with HTTP 402, the dashboard shows plan, quota rails, plan table,
payment history and upgrade cards on locked sections.

**Team and sharing.** Workspace invites with one-time links and OWNER/ADMIN/VIEWER roles enforced on every
mutating route. Public client report at `/r/<token>`: traffic numbers only, revocable, view counted.
CSV exports for subscribers, links and events. Buyer tag on links with a comparison table.

**Bot link tooling.** `/bulklinks` turns a pasted list of placements into links plus a CSV for the ad
manager. Landing-post links redirect straight to a channel post, validated against the channel's own
identity so they cannot become an open redirect.

**Engineering hardening (2026-08-21).** Prisma switched from `db push` to real migrations: `0_init`
baseline plus `scripts/migrate-deploy.mjs` (deploy, baseline-on-P3005, retry) run by `railway:start`.
GitHub Actions CI: typecheck, vitest, both builds. Sentry wired into bot (grammY `bot.catch`, Fastify
`onError`) and web (`instrumentation.ts` / `instrumentation-client.ts`); dormant until `SENTRY_DSN` /
`NEXT_PUBLIC_SENTRY_DSN` are set. Vitest suite covers billing invariants, invoice payload parsing and
quota math. `/admin grant|revoke` support commands gated by `ADMIN_TG_IDS`. Pro price set to 10 XTR
(test pricing) across bot, web catalog, landing and BILLING.md.

## Known gaps / next

1. Shared `createTrackedLink` helper: slug and invite-link rules are implemented twice (web + bot).
2. Overview aggregates events in JS per request; move to SQL grouping or cache before ~5-10k events/channel.
3. Postback delivery status is stored but not surfaced in the dashboard yet.
4. Telegram Login payloads have no replay protection beyond the 24h `auth_date` window.
5. No security headers on the web app (CSP, HSTS, nosniff, referrer policy).
8. Content module: post performance, ER, new vs returning cohorts (Prizma parity).
9. White-label on client reports, the real reason to buy Agency.
10. Rate limits are per process and in memory; they will need a shared store if the web app scales out.
6. Card payments (Lemon Squeezy) for buyers who do not want Stars; the provider enum is already in place.
7. Stars payments are untested against a real charge: run one live Pro purchase and verify the receipt,
   the subscription period and the renewal update.
