#!/usr/bin/env node
/**
 * Idempotent preflight for `npm run dev`.
 *
 * A fresh clone has no .env (it is gitignored) and no server/node_modules, and
 * both failures are quiet: the app builds and launches fine, then fails on every
 * screen. This creates what is missing and says nothing when everything is
 * already in place.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

let didSomething = false;

function ensureEnvFile(dir, label) {
  const envPath = join(dir, '.env');
  const examplePath = join(dir, '.env.example');

  if (existsSync(envPath) || !existsSync(examplePath)) return;

  copyFileSync(examplePath, envPath);
  console.log(`[setup] Created ${label}/.env from .env.example`);
  didSomething = true;
}

function ensureDependencies(dir, label) {
  if (existsSync(join(dir, 'node_modules'))) return;

  console.log(`[setup] Installing ${label} dependencies (first run only)...`);
  const result = spawnSync(npm, ['install'], { cwd: dir, stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`[setup] npm install failed in ${label}.`);
    process.exit(result.status ?? 1);
  }

  didSomething = true;
}

// The app reads EXPO_PUBLIC_API_URL from here at bundle time.
ensureEnvFile(root, '.');

// The server needs no .env at all — it falls back to embedded Postgres and a
// generated dev key — but copying the example makes the knobs discoverable.
ensureEnvFile(join(root, 'server'), 'server');
ensureDependencies(join(root, 'server'), 'server');

if (didSomething) {
  console.log('[setup] Done.\n');
}
