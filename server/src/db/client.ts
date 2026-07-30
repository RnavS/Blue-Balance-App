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
    });

export const db = embedded ? embedded.db : drizzle(nodePool!, { schema });

/** Driver-agnostic helpers so callers do not branch on which one is active. */
export const pool = {
  query: (text: string) => (embedded ? embedded.query(text) : nodePool!.query(text)),
  end: () => (embedded ? embedded.end() : nodePool!.end()),
};

export type Db = typeof db;
