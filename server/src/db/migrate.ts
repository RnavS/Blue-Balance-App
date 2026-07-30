import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

// Applies everything in ./drizzle. Safe to re-run: Drizzle tracks which
// migrations have already been applied in its own metadata table.
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied.');
await pool.end();
