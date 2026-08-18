# TGPulse

Атрибуция и сквозная аналитика трафика Telegram-каналов: кто пришёл, с какого креатива,
когда отписался, что принесло деньги.

- **[docs/PLAN.md](docs/PLAN.md)** — план реализации по фазам, позиционирование, стек
- **[docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md)** — деплой на Railway

## Структура

```
apps/
├── web/    # Next.js: маркетинговый лендинг + личный кабинет
└── bot/    # grammY + Fastify: TG-бот, вебхук, трекинг-редирект /l/:slug
packages/
└── db/     # Prisma schema + клиент (общий для web и bot)
```

## Быстрый старт

```bash
npm install
cp .env.example .env        # заполнить BOT_TOKEN и DATABASE_URL
npm run db:migrate          # создать таблицы
npm run dev:bot             # бот в long-polling режиме
npm run dev:web             # лендинг на :3000
```
