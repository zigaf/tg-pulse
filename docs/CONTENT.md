# Content module

Post performance and join cohorts for a connected channel. Available on every plan.

## What the Bot API can and cannot see

The bot is a channel admin, which gives it exactly three content signals:

| Signal | Update | Notes |
|---|---|---|
| New post | `channel_post` | Type, text/caption, date. Only from the moment the channel was connected. |
| Edit | `edited_channel_post` | Refreshes the stored preview and kind. |
| Reactions | `message_reaction_count` | Anonymous per-post totals; opt-in via `allowed_updates`. Telegram batches these, so counts trail reality by a bit. |

**View counts do not exist in the Bot API.** They are exposed only to client (MTProto)
applications. We therefore never show view-based ER; the engagement metric is
**ERR — reactions per 100 current subscribers** — and the UI says so. If an MTProto
companion is ever added, views slot into the same `ChannelPost` row.

Deletions are also invisible to bots: a deleted post keeps its last known numbers.

## Data model

`ChannelPost` (packages/db/prisma/schema.prisma): one row per post, unique on
`(channelId, messageId)`, storing `postedAt`, `editedAt`, `kind`, a 160-char
`preview`, the latest `reactions` array (`[{ reaction, count }]`) and
`reactionsTotal`. Handlers live in `apps/bot/src/posts.ts` and never throw —
content tracking must not break attribution.

## Metrics

- **Joins/leaves 24h** — every member event is attributed to the most recent post
  published within 24 hours before it (`apps/web/src/server/content.ts`). When posts
  are more frequent than that, the newest post wins; this measures "what happened
  after this post", not causality.
- **ERR** — `reactionsTotal / memberCount × 100`, null while the member count is
  not synced yet.
- **Cohorts** — every JOIN in the window is split into *first-time* vs *returning*.
  Returning means the subscriber row existed more than 60 seconds before the join
  event (the row keeps its original `joinedAt`; a rejoin only clears `leftAt`).
  A missing subscriber row reads as first-time: it cannot prove a rejoin.

## Surfaces

- Dashboard: `/app/channels/[id]/content` — tiles (posts, reactions, avg ERR,
  returning share), daily stacked cohort chart, posts table over 7/30/90 days.
- API: `GET /api/channels/[id]/content?days=7|30|90`, workspace members only.
