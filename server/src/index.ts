import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requireUser, type AppEnv } from './auth/middleware.js';
import { config } from './config.js';
import { pool } from './db/client.js';
import { ensureSchema } from './db/ensure-schema.js';
import { errorResponse } from './lib/errors.js';
import { accountRoutes } from './routes/account.js';
import { authRoutes } from './routes/auth.js';
import { beverageRoutes, scannedBeverageRoutes } from './routes/beverages.js';
import { chatMessageRoutes } from './routes/chat-messages.js';
import { functionRoutes } from './routes/functions.js';
import { profileRoutes } from './routes/profiles.js';
import { stripeWebhookRoutes } from './routes/stripe-webhook.js';
import { waterLogRoutes } from './routes/water-logs.js';

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: config.corsOrigins.length ? config.corsOrigins : '*',
    allowHeaders: ['Authorization', 'Content-Type', 'stripe-signature'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

// Every thrown HttpError lands here and is rendered in the { message, error }
// shape the app already knows how to read.
app.onError((error, c) => errorResponse(c, error));

app.get('/health', async (c) => {
  try {
    await pool.query('SELECT 1');
    return c.json({ status: 'ok', database: 'up' });
  } catch (error) {
    console.error('Health check failed:', error);
    return c.json({ status: 'degraded', database: 'down' }, 503);
  }
});

app.route('/auth', authRoutes);

// Stripe signs the raw body and authenticates by signature, so this must stay
// outside requireUser.
app.route('/webhooks/stripe', stripeWebhookRoutes);

// Everything below requires a valid access token. This mounting is what replaces
// the row-level security policies that used to run inside Postgres.
app.use('/profiles/*', requireUser);
app.use('/profiles', requireUser);
app.use('/water-logs/*', requireUser);
app.use('/water-logs', requireUser);
app.use('/beverages/*', requireUser);
app.use('/beverages', requireUser);
app.use('/scanned-beverages/*', requireUser);
app.use('/scanned-beverages', requireUser);
app.use('/chat-messages/*', requireUser);
app.use('/chat-messages', requireUser);
app.use('/functions/*', requireUser);
app.use('/account', requireUser);

app.route('/profiles', profileRoutes);
app.route('/water-logs', waterLogRoutes);
app.route('/beverages', beverageRoutes);
app.route('/scanned-beverages', scannedBeverageRoutes);
app.route('/chat-messages', chatMessageRoutes);
app.route('/functions', functionRoutes);
app.route('/account', accountRoutes);

// The smoke test imports `app` to drive routes through app.fetch() directly, so
// only bind a port when this module is the process entrypoint.
if (!process.env.BLUE_BALANCE_NO_LISTEN) {
  // Bring the schema up to date before accepting traffic, so a fresh clone needs
  // no migrate step. A failure here is fatal: serving against a missing or stale
  // schema would produce confusing 500s on every request.
  await ensureSchema().catch((error) => {
    console.error('[db] Failed to apply migrations:', error);
    process.exit(1);
  });

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Blue Balance API listening on http://localhost:${info.port}`);
    if (!config.isProduction) {
      console.log('  Point the app at it with EXPO_PUBLIC_API_URL in the repo-root .env');
    }
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, closing database pool.`);
    await pool.end().catch(() => null);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

export { app };
