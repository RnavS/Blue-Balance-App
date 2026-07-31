import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

/**
 * `pglite://` runs real Postgres compiled to WebAssembly inside this process —
 * no server, no Docker. Used by the smoke test and handy for offline development;
 * never use it in production, where the data lives only as long as the process.
 */
export const isEmbedded = config.databaseUrl.startsWith('pglite://');

// Managed Postgres (Neon, Railway, RDS) terminates TLS with a cert the Node
// default trust store often rejects. Local Docker Postgres has no TLS at all.
const needsSsl = !isEmbedded && !/localhost|127\.0\.0\.1/.test(config.databaseUrl);

async function createEmbedded() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const dataDir = config.databaseUrl.slice('pglite://'.length);
  const client = new PGlite(dataDir || undefined);

  return {
    // The query-builder surface is identical across drivers; only the transport
    // differs, so the route code is written against the node-postgres type.
    db: drizzlePglite(client, { schema }) as unknown as ReturnType<typeof drizzle>,
    query: (text: string) => client.query(text),
    end: () => client.close(),
  };
}

const embedded = isEmbedded ? await createEmbedded() : null;

const nodePool = embedded
  ? null
  : new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // Managed Postgres drops idle connections; recycle before it does.
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

// A pg Pool emits 'error' when an *idle* client dies — a routine event on hosted
// Postgres. EventEmitter throws on an unhandled 'error', which would take the
// whole process down. The pool discards the bad client and carries on, so this
// only needs to be logged.
nodePool?.on('error', (error) => {
  console.error('[db] Idle client error (pool will recover):', error.message);
});

export const db = embedded ? embedded.db : drizzle(nodePool!, { schema });

/**
 * Blocks until the database accepts a query, retrying with backoff.
 *
 * On a fresh deploy the app container usually starts before Postgres is ready to
 * accept connections. Without this the first query throws, the process exits, and
 * the host restarts it in a crash loop that looks like a broken deploy.
 */
export async function waitForDatabase(attempts = 10): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      if (attempt > 1) console.log(`[db] Connected after ${attempt} attempts.`);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;

      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 10_000);
      console.warn(
        `[db] Not ready (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms:`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/** Driver-agnostic helpers so callers do not branch on which one is active. */
export const pool = {
  query: (text: string) => (embedded ? embedded.query(text) : nodePool!.query(text)),
  end: () => (embedded ? embedded.end() : nodePool!.end()),
};

export type Db = typeof db;
