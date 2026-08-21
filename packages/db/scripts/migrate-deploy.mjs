#!/usr/bin/env node
/**
 * Production migration entrypoint.
 *
 * Runs `prisma migrate deploy`. On P3005 — a non-empty database that predates
 * migration history — it marks the 0_init baseline as applied once and retries.
 * A brand-new database never hits P3005, so the baseline is actually executed there.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function prisma(args) {
  const result = spawnSync('npx', ['--no-install', 'prisma', ...args], {
    cwd: pkgRoot,
    encoding: 'utf8',
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const deploy = prisma(['migrate', 'deploy']);
if (deploy.status === 0) process.exit(0);

if (deploy.output.includes('P3005')) {
  console.log('[migrate-deploy] P3005: baselining existing database with 0_init');
  // web and bot may race here on the same database: if the other service already
  // recorded the baseline, resolve fails but the retried deploy succeeds.
  prisma(['migrate', 'resolve', '--applied', '0_init']);
  process.exit(prisma(['migrate', 'deploy']).status);
}

process.exit(deploy.status);
