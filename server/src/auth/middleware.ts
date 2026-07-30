import { eq } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from './tokens.js';

export interface AuthedUser {
  id: string;
  email: string;
}

export type AppEnv = {
  Variables: {
    user: AuthedUser;
  };
};

/**
 * Replaces Supabase's `requireAuthenticatedUser`. Every route that touches user
 * data mounts this, and handlers read `c.get('user')` — the row-level security
 * policies that used to enforce ownership are now explicit `WHERE user_id = ...`
 * clauses in the route handlers.
 */
export async function requireUser(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('Authorization');

  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Authorization header is required');
  }

  const claims = await verifyAccessToken(header.slice('Bearer '.length).trim());

  // Confirm the user still exists — a deleted account must not keep working for
  // the remaining lifetime of an already-issued access token.
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, claims.sub))
    .limit(1);

  if (!user) {
    throw unauthorized();
  }

  c.set('user', user);
  await next();
}
