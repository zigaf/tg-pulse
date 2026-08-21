import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/src/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
    // Modules under test import @tgpulse/db, whose client wants a URL at
    // construction time. Tests never run queries, so a placeholder is enough.
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test',
      BOT_TOKEN: '0:test',
    },
  },
});
