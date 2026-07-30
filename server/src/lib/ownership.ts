import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import { notFound } from './errors.js';

/**
 * Replaces the RLS policies that used to guard every child table:
 *
 *   USING (EXISTS (SELECT 1 FROM profiles
 *                  WHERE profiles.id = <table>.profile_id
 *                  AND profiles.user_id = auth.uid()))
 *
 * Postgres enforced that automatically before; now every route that accepts a
 * profile_id must call this first. Throws 404 rather than 403 so the endpoint
 * cannot be used to probe which profile ids exist.
 */
export async function assertProfileOwned(userId: string, profileId: string): Promise<void> {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
    .limit(1);

  if (!row) {
    throw notFound('Profile not found');
  }
}
