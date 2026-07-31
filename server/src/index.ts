import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requireUser, type AppEnv } from './auth/middleware.js';
import { config } from './config.js';
import { pool, waitForDatabase } from './db/client.js';
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
  // A rejected promise or a thrown error with no handler terminates Node. Log
  // loudly and keep serving: one bad request should not take down every other
  // user's session.
  process.on('unhandledRejection', (reason) => {
    console.error('[fatal] Unhandled promise rejection:', reason);
  });

  // Errors that mean the process can never do its job — a port already taken,
  // a file handle limit — must still be fatal. Swallowing those leaves a
  // process that is alive, logging nothing, and serving nobody.
  const UNRECOVERABLE = new Set(['EADDRINUSE', 'EACCES', 'EMFILE', 'ENFILE']);

  process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
    if (error.code && UNRECOVERABLE.has(error.code)) {
      console.error(`[fatal] ${error.code}: ${error.message}`);
      if (error.code === 'EADDRINUSE') {
        console.error(`[fatal] Port ${config.port} is already in use. Stop the other process, or set PORT.`);
      }
      process.exit(1);
    }

    // Anything else is most likely scoped to one request. Log it and keep
    // serving rather than dropping every other user's session.
    console.error('[fatal] Uncaught exception:', error);
  });

  // The database is usually not accepting connections yet on a fresh deploy.
  // Wait for it rather than exiting into a crash loop.
  await waitForDatabase().catch((error) => {
    console.error('[db] Database never became reachable:', error);
    process.exit(1);
  });

  // Bring the schema up to date before accepting traffic, so a fresh clone needs
  // no migrate step. A failure here is fatal: serving against a missing or stale
  // schema would produce confusing 500s on every request.
  await ensureSchema().catch((error) => {
    console.error('[db] Failed to apply migrations:', error);
    process.exit(1);
  });

  // 0.0.0.0 rather than loopback: a container that binds only to localhost is
  // unreachable from its host, and it lets a physical device reach the dev
  // server over the LAN.
  serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
    console.log(`Blue Balance API listening on port ${info.port}`);
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
