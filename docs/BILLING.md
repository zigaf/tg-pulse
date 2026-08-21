# Billing contract (Phase 6)

Single source of truth for plans, limits and payment flow. Web and bot must agree on every number here.

## Plans and entitlements

Billing is per workspace, with a channel quota. Not per channel.

| | Free | Pro | Agency |
|---|---|---|---|
| Price | 0 | 10 XTR / 30 days (~$0.20) | 4000 XTR / 30 days (~$79) |
| Channels | 1 | 3 | 25 |
| Tracking links per channel | 5 | unlimited | unlimited |
| Attribution, joins/leaves, daily report, instant alerts | yes | yes | yes |
| Dashboard overview and subscribers | yes | yes | yes |
| Landing pixel | yes | yes | yes |
| Postbacks | no | yes | yes |
| Revenue module (API keys, ingest, CSV, ROMI) | no | yes | yes |
| Fraud reports | last link only | yes | yes |
| Team members per workspace | 1 | 5 | 25 |

`FEATURES` and `LIMITS` live in one shared module per app; do not hardcode numbers in routes or handlers.

Canonical keys, identical in `apps/bot/src/billing.ts`, `apps/web/src/server/entitlements.ts` and
`apps/web/src/lib/billing.ts`:

- limits: `channels`, `linksPerChannel` (null = unlimited), `members`
- features: `postbacks`, `revenue`, `fraudFull`

## Enforcement rules

- Quotas are checked at creation time (channel connect, link create, member invite).
- Feature gates return HTTP 402 with `{ ok: false, error, upgrade: true }` from the API, and an upgrade
  card with a Stars button in the bot.
- Downgrade never deletes data. Over-quota channels become read-only: existing links keep redirecting and
  attribution keeps recording, but new links and new channels are blocked until the workspace upgrades.
- Access is granted while `Subscription.status != EXPIRED` and `now() < currentPeriodEnd`.
  A daily sweep expires stale rows and downgrades `Workspace.plan` back to FREE.

## Telegram Stars flow

1. User picks a plan in the bot (`/upgrade` or an upgrade card shown on a gate hit).
2. Bot creates an invoice in `XTR` (`sendInvoice` / `createInvoiceLink`, `subscription_period = 2592000`
   when recurring is available; otherwise a one-off 30-day invoice).
3. `pre_checkout_query` is answered `ok: true` after re-validating the workspace and plan from the payload.
4. `successful_payment` writes a `PaymentEvent` keyed by `telegram_payment_charge_id` (idempotent), then
   upserts the workspace `Subscription` (extends `currentPeriodEnd` by 30 days from the later of now and the
   current end) and syncs `Workspace.plan`.
5. Refunds and cancellations: `/billing` shows status and how to cancel; Telegram handles the cancellation
   itself for recurring Stars subscriptions, our sweep picks up the missing renewal.

Invoice payload format: `plan:<PRO|AGENCY>:ws:<workspaceId>` (validated server-side, never trusted blindly).

## Web

- Read-only billing view: current plan, renewal date, quota usage, payment history.
- Upgrading happens in the bot (Stars is a Telegram-native flow), so the web page deep-links to
  `t.me/<bot>?start=upgrade_<workspaceId>`.
- Lemon Squeezy for card payments is out of scope for this phase; the schema already carries the provider
  enum so it can be added without a migration to the payment model.
