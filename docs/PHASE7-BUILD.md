# Phase 7: deliver what we already sell

Every item here is promised on the landing page or inside a paid plan but does not exist yet.
Schema is frozen for this phase (models `WorkspaceInvite`, `ShareLink` and `TrackedLink.buyer` are in place).

## 1. Team and roles (billed on Pro/Agency, currently unusable)

Roles: `OWNER` (billing, delete workspace), `ADMIN` (everything except billing and member removal of owners),
`VIEWER` (read-only: no link creation, no postbacks, no key management).

- `GET /api/workspaces/[id]/members` — members with role and join date, plus pending invites.
- `POST /api/workspaces/[id]/invites` — `{ role }`, returns a one-time link `/<origin>/invite/<token>`,
  valid 7 days. Enforces the `members` quota, counting pending invites.
- `DELETE /api/invites/[id]`, `POST /api/invites/[token]/accept` (session required, joins the workspace).
- `PATCH /api/workspaces/[id]/members/[userId]` — change role. `DELETE` — remove member.
  The last `OWNER` can never be demoted or removed.
- Enforcement: `VIEWER` gets 403 on every mutating channel route.

## 2. Shareable client report (landing promise: "share a report with a client in one link")

- `POST /api/channels/[id]/share-links` — `{ label?, windowDays: 7|30|90, expiresInDays? }` → token.
- `GET /api/share/[token]` — public, no session: channel title, totals, series and source breakdown for the
  window. Never exposes subscriber identities, revenue, keys or member data. Increments `viewCount`.
- `POST /api/share-links/[id]/revoke`.
- Public page `/r/[token]`: read-only version of the overview, TGPulse branding, no navigation.

## 3. Exports (sold in Pro)

- `GET /api/channels/[id]/export?type=subscribers|links|events&days=` → streamed CSV with a
  `Content-Disposition` filename. Subscribers export includes source label and join/leave timestamps.
- Free plan: 100-row cap with a note in the response headers; paid plans: unlimited.

## 4. Buyer comparison (Prizma parity, uses `TrackedLink.buyer`)

- Buyer is an optional field on link create/edit (bot and dashboard).
- `GET /api/channels/[id]/buyers?days=` → per buyer: links, clicks, joins, unsub rate, revenue when the
  revenue module is on, cost per join if the buyer reported spend (out of scope now, keep the shape ready).

## 5. Bulk link generation for Telegram Ads (promised in "how it works")

- Bot: `/bulklinks` — paste up to 50 placement names, one per line, get one tracking link per line as a
  code block plus a CSV file the user can paste into an ad manager.
- Dashboard: same action in the Links section, with a textarea and a downloadable CSV.
- Respects the per-channel link quota; on overflow creates what fits and reports the rest.

## 6. Landing-post mode (tgtrack's "invisible bot" scheme)

`TrackedLink.targetPostUrl` already exists but nothing writes it.

- On link create, an optional "landing post" URL (`https://t.me/<channel>/<id>`), validated against the
  channel's own username so it cannot become an open redirect.
- The redirect prefers `targetPostUrl`; attribution then falls back to time-window matching, so the link
  detail view must show which mode it is and warn that attribution is probabilistic.
