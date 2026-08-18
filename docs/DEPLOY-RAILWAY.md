# Деплой на Railway

Один проект Railway, 4 сервиса:

| Сервис | Источник | Настройки |
|---|---|---|
| **postgres** | Railway plugin | — |
| **redis** | Railway plugin | (понадобится с Фазы 1: кэш редиректов, очереди отчётов) |
| **web** | этот репозиторий | Build: `npm run build:web` · Start: `npm run start -w apps/web` |
| **bot** | этот репозиторий | Build: `npm run build:bot` · Start: `npm run start -w apps/bot` |

## Переменные окружения

**web** и **bot**: `DATABASE_URL` — reference на `postgres.DATABASE_URL`.

**bot** дополнительно:
- `BOT_TOKEN` — токен от @BotFather
- `PUBLIC_URL` — публичный домен сервиса bot (Railway → Settings → Networking → Generate Domain)
- `WEBHOOK_SECRET` — случайная строка (`openssl rand -hex 24`); при её наличии бот сам ставит вебхук на старте

## Миграции

Прогоняются перед стартом бота. Добавить в Start command сервиса **bot**:

```
npm run migrate:deploy -w packages/db && npm run start -w apps/bot
```

## Домены

- `tgpulse.app` (пример) → сервис web
- `go.tgpulse.app` → сервис bot (короткие трекинг-ссылки `/l/:slug`)

## Чек-лист первого деплоя

1. Создать бота у @BotFather, включить **Group Privacy = OFF** не требуется (каналы), но боту нужны права админа канала с «Invite users via link».
2. Railway: New Project → Deploy from GitHub repo (или `railway up` через CLI).
3. Добавить Postgres, привязать `DATABASE_URL` к обоим сервисам.
4. Сгенерировать домен для bot, прописать `PUBLIC_URL` + `WEBHOOK_SECRET`.
5. Проверить `GET <PUBLIC_URL>/health` → `{ "ok": true }`.
