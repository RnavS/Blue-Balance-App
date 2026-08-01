import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Loads server/.env into process.env. Values already present in the real
 * environment win, so a host's configuration is never overwritten by a file that
 * happened to get committed or left behind locally.
 */
function loadEnvFile(path = './.env'): void {
  if (!existsSync(path)) return;

  const parsed = parseEnv(readFileSync(path, 'utf8')) as Record<string, string>;

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined && value !== '') {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

/** Required in production; in development the caller supplies a safe default. */
function requiredInProduction(name: string, devFallback: () => string): string {
  const value = process.env[name];
  if (value) return value;

  if (isProduction) {
    throw new Error(
      `${name} is not set. It is required when NODE_ENV=production. See server/.env.example.`,
    );
  }

  return devFallback();
}

/**
 * Embedded Postgres (real Postgres compiled to WebAssembly) persisted to disk, so
 * `npm run dev` works with no database to install and no connection string to
 * configure, and the data survives restarts.
 */
const DEV_DATABASE_URL = 'pglite://./pgdata';

const DEV_SECRET_FILE = './.dev-secret';

/**
 * Generates a development signing key once and reuses it, so sessions survive a
 * server restart. Never used in production — requiredInProduction throws first.
 */
function loadOrCreateDevSecret(): string {
  if (existsSync(DEV_SECRET_FILE)) {
    const existing = readFileSync(DEV_SECRET_FILE, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }

  const secret = randomBytes(48).toString('base64url');
  mkdirSync(dirname(DEV_SECRET_FILE), { recursive: true });
  writeFileSync(DEV_SECRET_FILE, `${secret}\n`, { mode: 0o600 });

  console.warn(
    `[config] AUTH_JWT_SECRET was not set. Generated a development key and saved it to ${DEV_SECRET_FILE}. ` +
      'Set AUTH_JWT_SECRET explicitly before deploying.',
  );

  return secret;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  nodeEnv,
  isProduction,

  databaseUrl: requiredInProduction('DATABASE_URL', () => {
    console.warn(
      `[config] DATABASE_URL was not set. Using embedded Postgres at ${DEV_DATABASE_URL}. ` +
        'Set DATABASE_URL to a real Postgres before deploying.',
    );
    return DEV_DATABASE_URL;
  }),

  jwtSecret: requiredInProduction('AUTH_JWT_SECRET', loadOrCreateDevSecret),

  accessTokenTtlSeconds: Number(optional('ACCESS_TOKEN_TTL_SECONDS', '3600')),
  refreshTokenTtlDays: Number(optional('REFRESH_TOKEN_TTL_DAYS', '60')),

  /** Comma-separated. Empty means allow all, which is fine for a native-only app. */
  corsOrigins: optional('CORS_ORIGINS')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),

  // The AI coach talks to any endpoint that speaks the OpenAI chat-completions
  // shape — your own model, a self-hosted server, or OpenAI itself. Point
  // AI_BASE_URL at the root that has /chat/completions under it.
  // OPENAI_* are read as fallbacks so existing setups keep working.
  aiBaseUrl: optional('AI_BASE_URL', optional('OPENAI_BASE_URL', 'https://api.openai.com/v1')),
  aiApiKey: optional('AI_API_KEY', optional('OPENAI_API_KEY')),
  aiModel: optional('AI_MODEL', optional('OPENAI_MODEL', 'gpt-4o-mini')),

  stripeSecretKey: optional('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: optional('STRIPE_WEBHOOK_SECRET'),
  stripeMonthlyPriceId: optional('STRIPE_PREMIUM_MONTHLY_PRICE_ID'),
  stripeAnnualPriceId: optional('STRIPE_PREMIUM_ANNUAL_PRICE_ID'),

  goUpcApiKey: optional('GO_UPC_API_KEY'),

  // Password reset cannot deliver anything without these; the endpoint refuses
  // rather than reporting a success it did not achieve.
  resendApiKey: optional('RESEND_API_KEY'),
  emailFrom: optional('EMAIL_FROM'),

  /** Set to "false" to re-enable the paywall on iOS. See docs-internal/APP_STORE_SUBMISSION.md. */
  iosPremiumFree: optional('IOS_PREMIUM_FREE', 'true'),
} as const;

if (config.jwtSecret.length < 32) {
  throw new Error('AUTH_JWT_SECRET must be at least 32 characters.');
}
