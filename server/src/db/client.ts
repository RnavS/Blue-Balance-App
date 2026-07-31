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

  /** Opening is not enough — a corrupt directory only aborts once queried. */
  async function open() {
    const client = new PGlite(dataDir || undefined);
    try {
      await client.query('SELECT 1');
      return client;
    } catch (error) {
      // Release the directory before anyone tries to move or delete it —
      // Windows refuses both while a handle is open.
      await client.close().catch(() => null);
      throw error;
    }
  }

  let client: Awaited<ReturnType<typeof open>>;

  try {
    client = await open();
  } catch (error) {
    // Killing the process while PGlite holds the directory open can leave it
    // unreadable, and it never recovers on its own — the server simply refuses
    // to boot with an opaque WebAssembly abort. This is a disposable local dev
    // database, so move the wreckage aside and start clean rather than making
    // someone decode that. A real DATABASE_URL never reaches this path.
    if (!dataDir) throw error;

    const { rename } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');
    const quarantine = `${dataDir}.corrupt-${Date.now()}`;

    console.error(
      '[db] Could not open the embedded database:',
      error instanceof Error ? error.message : error,
    );

    if (!existsSync(dataDir)) throw error;

    // Move, never delete. The same failure is raised when another server
    // already has this directory open, and that server's data must not be
    // destroyed by a second one starting up. A rename fails while anything
    // holds the directory, which is exactly the guard we want: recovery only
    // proceeds when nothing else is using it.
    try {
      await rename(dataDir, quarantine);
    } catch {
      throw new Error(
        `The embedded database at ${dataDir} could not be opened or moved aside.\n` +
          '  Most likely another Blue Balance server is already running — check for one before starting a second.\n' +
          `  If nothing else is running, the directory is damaged: delete ${dataDir} and start again.`,
      );
    }

    console.warn(
      `[db] Moved the unreadable database to ${quarantine} and started fresh. Local dev data is gone.`,
    );

    client = await open();
  }

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
