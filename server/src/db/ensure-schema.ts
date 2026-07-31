import { db, isEmbedded } from './client.js';

/**
 * Applies any pending migrations at startup so the server is usable immediately
 * after `npm run dev` with no separate migrate step. Drizzle records which
 * migrations have run in its own metadata table, so this is idempotent and cheap
 * once the schema is current.
 *
 * Safe in production too: applying already-applied migrations is a no-op. If you
 * would rather gate deploys on an explicit migration step, set
 * SKIP_AUTO_MIGRATE=true and run `npm run db:migrate` yourself.
 */
export async function ensureSchema(): Promise<void> {
  if (process.env.SKIP_AUTO_MIGRATE === 'true') {
    console.log('[db] SKIP_AUTO_MIGRATE=true — skipping automatic migrations.');
    return;
  }

  const migrationsFolder = './drizzle';

  // The two drivers ship different migrators; pick the one matching the client
  // that db/client.ts actually created.
  if (isEmbedded) {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as any, { migrationsFolder });
  } else {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db as any, { migrationsFolder });
  }

  console.log('[db] Schema is up to date.');
}
