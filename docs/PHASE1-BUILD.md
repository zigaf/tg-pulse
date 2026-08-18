# Phase 1 Build: бот + бэкенд + личный кабинет

> Оркестрация: 3 параллельных агента с непересекающимися зонами.
> Схема БД (packages/db) в этом раунде ЗАМОРОЖЕНА — текущих моделей достаточно для MVP.
> Общий словарь: атрибуция через уникальные invite links, go-редирект уже живёт в apps/bot (`/l/:slug`).

## Архитектура

```
Telegram ──webhook──▶ apps/bot (grammY+Fastify)     ──▶ Postgres (Prisma, @tgpulse/db)
    ▲                    · onboarding каналов                 ▲
    │                    · chat_member → Subscriber/Event     │
    │                    · /newlink, /stats, daily report     │
    │                    · GET /l/:slug (клики+редирект)      │
    │                                                         │
Telegram Login Widget ─▶ apps/web (Next.js)  ────────────────┘
                         · /api/* route handlers (auth, channels, links, stats)
                         · /app/* личный кабинет (React, дизайн лендинга)
                         · создание invite link через Bot API (HTTPS, тот же BOT_TOKEN)
```

## Env-переменные (добавляются к существующим)

| Var | Где | Что |
|---|---|---|
| `BOT_TOKEN` | web + bot | один и тот же токен @BotFather |
| `BOT_USERNAME` | web | для Telegram Login Widget (без @) |
| `SESSION_SECRET` | web | HS256 для JWT-сессии (cookie `tgp_session`, httpOnly, 30d) |
| `GO_BASE_URL` | web + bot | база трекинг-ссылок, например https://go.tgpulse.io (пока = домен bot-сервиса) |

## API-контракт (route handlers в apps/web)

Все ответы: `{ ok: true, data }` либо `{ ok: false, error }`. Авторизация: cookie `tgp_session` (JWT `{ userId }`), 401 без неё. Доступ к каналу = членство в его workspace.

- `POST /api/auth/telegram` — body: поля Telegram Login Widget (id, first_name, username?, photo_url?, auth_date, hash). Проверка hash по алгоритму TG (HMAC-SHA256, ключ = SHA256(BOT_TOKEN)), auth_date не старше 24ч. Upsert User по tgId; если у юзера нет workspace — создать личный. Ставит cookie. → `{ user }`
- `POST /api/auth/logout` — сброс cookie.
- `GET /api/me` → `{ user, workspaces: [{ id, name, plan, channels: [{ id, title, username, botStatus, subscriberCount }] }] }`
- `GET /api/channels/:id/overview?days=7|30` → `{ channel, totals: { joins, leaves, net, unsubRate }, series: [{ date, joins, leaves }], sources: [{ linkId, label, creative, clicks, joins, leaves, unsubRate }] }` (sources включает строку `linkId: null` = organic)
- `GET /api/channels/:id/links` → `[{ id, slug, url, label, creative, utmSource, utmMedium, utmCampaign, inviteLink, isRevoked, clicks, joins, leaves, createdAt }]` (`url` = `${GO_BASE_URL}/l/${slug}`)
- `POST /api/channels/:id/links` — body `{ label, creative?, utmSource?, utmMedium?, utmCampaign? }`. Создаёт invite link через Bot API `createChatInviteLink` (name = label, creates_join_request=false), пишет TrackedLink (slug = nanoid(8)). → объект ссылки как выше
- `POST /api/links/:id/revoke` — revokeChatInviteLink + isRevoked=true
- `GET /api/channels/:id/subscribers?cursor?&take=50&q?` → `{ items: [{ tgUserId, username, firstName, isPremium, joinedAt, leftAt, source: { label } | null }], nextCursor }`

## Зоны агентов (параллельно, без пересечений)

### Агент A — Backend (apps/web: только src/server/** и src/app/api/**)
- `src/server/auth.ts` (verify TG hash, JWT sign/verify, getSession(cookies))
- `src/server/telegram.ts` (вызовы Bot API: createChatInviteLink, revokeChatInviteLink)
- `src/server/access.ts` (assertChannelAccess(userId, channelId))
- route handlers по контракту, zod-валидация входа, агрегации Prisma (`groupBy` по дням/링кам)
- Ошибки: 400 (валидация), 401, 403, 404; не течь стектрейсами

### Агент B — Bot (apps/bot/src/**)
- `/start` c deep-link параметрами; `/newlink` — диалог: выбор канала (inline-кнопки) → ввод label → создать invite link + TrackedLink → отдать go-URL + QR не нужен
- `/stats` — сводка за 7 дней по каналам юзера (joins/leaves/топ-3 источника)
- Ежедневный отчёт 09:00 UTC (node-cron): всем owner'ам workspace по каждому ACTIVE-каналу: joins/leaves/net вчера, топ источников, отписавшиеся
- Рефактор: session-state диалога в памяти (Map) достаточно для MVP
- Не трогать: механику chat_member/redirect (работает), packages/db

### Агент C — Кабинет UI (apps/web: только src/app/app/**, src/components/dashboard/**, src/lib/api.ts)
- Дизайн = система лендинга (токены globals.css, тёмный violet, Onest/JetBrains Mono, стеклянные поверхности). Реальные компоненты в духе DeviceMockup.
- `/app` — если нет сессии: экран логина с Telegram Login Widget (script telegram-widget.js, data-onauth → POST /api/auth/telegram); есть сессия: список каналов (+empty state «добавь бота в канал» с инструкцией и кнопкой на t.me/бота)
- `/app/channels/[id]` — overview: стат-тайлы (joins/leaves/net/unsub rate), area-чарт по дням (recharts), таблица источников (клики→подписки→конверсия→отписки, сортировка), переключатель 7д/30д
- `/app/channels/[id]/links` — таблица ссылок + «Create link» модал (label/creative/utm) + copy-to-clipboard go-URL + revoke
- `/app/channels/[id]/subscribers` — таблица с поиском и курсорной пагинацией
- `src/lib/api.ts` — типизированный fetch-клиент под контракт (типы руками, без codegen)
- Состояния: loading (скелетоны), empty, error — обязательны

## Критерии приёмки
1. `npm run typecheck` — 0 ошибок во всех workspace
2. Логин через TG-виджет работает end-to-end на localhost (web dev + bot long-polling)
3. Создание ссылки из кабинета даёт рабочий go-URL → редирект в канал → join атрибуцируется
4. Ежедневный отчёт триггерится вручную (экспортируемая функция + `/report_now` команда для теста)
5. Деплой: оба сервиса на Railway, вебхук бота поставлен
