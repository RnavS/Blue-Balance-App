import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { profiles, waterLogs } from '../db/schema.js';
import { badRequest, notFound } from '../lib/errors.js';
import { assertProfileOwned } from '../lib/ownership.js';
import { serializeWaterLog } from '../lib/serialize.js';

const createSchema = z.object({
  profile_id: z.string().uuid(),
  amount: z.number().positive(),
  raw_amount: z.number().positive().optional(),
  hydration_factor: z.number().positive().optional(),
  drink_type: z.string().min(1).default('Water'),
  category: z.string().nullable().optional(),
  source: z.string().default('manual'),
  barcode: z.string().nullable().optional(),
  details: z.record(z.unknown()).nullable().optional(),
  logged_at: z.string().datetime().optional(),
});

export const waterLogRoutes = new Hono<AppEnv>();

waterLogRoutes.get('/', async (c) => {
  const user = c.get('user');
  const profileId = c.req.query('profile_id');

  if (!profileId) throw badRequest('profile_id is required.');
  await assertProfileOwned(user.id, profileId);

  // Mirrors the old client query: a rolling 400-day window, newest first.
  const sinceParam = c.req.query('since');
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(since.getTime())) throw badRequest('since must be an ISO timestamp.');

  const rows = await db
    .select()
    .from(waterLogs)
    .where(and(eq(waterLogs.profileId, profileId), gte(waterLogs.loggedAt, since)))
    .orderBy(desc(waterLogs.loggedAt));

  return c.json({ data: rows.map(serializeWaterLog) });
});

waterLogRoutes.post('/', async (c) => {
  const user = c.get('user');
  const parsed = createSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid water log.');
  }

  const input = parsed.data;
  await assertProfileOwned(user.id, input.profile_id);

  const [row] = await db
    .insert(waterLogs)
    .values({
      profileId: input.profile_id,
      // numeric columns take strings through node-postgres
      amount: String(input.amount),
      rawAmount: String(input.raw_amount ?? input.amount),
      hydrationFactor: String(input.hydration_factor ?? 1),
      drinkType: input.drink_type,
      category: input.category ?? null,
      source: input.source,
      barcode: input.barcode ?? null,
      details: input.details ?? {},
      loggedAt: input.logged_at ? new Date(input.logged_at) : new Date(),
    })
    .returning();

  if (!row) throw badRequest('Unable to save this log.');
  return c.json({ data: serializeWaterLog(row) }, 201);
});

waterLogRoutes.delete('/:id', async (c) => {
  const user = c.get('user');

  // Delete only if the log's profile belongs to this user. The subquery is the
  // direct equivalent of the RLS DELETE policy it replaces.
  const ownedProfileIds = db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  const [row] = await db
    .delete(waterLogs)
    .where(
      and(eq(waterLogs.id, c.req.param('id')), inArray(waterLogs.profileId, ownedProfileIds)),
    )
    .returning({ id: waterLogs.id });

  if (!row) throw notFound('Water log not found');
  return c.json({ success: true });
});
