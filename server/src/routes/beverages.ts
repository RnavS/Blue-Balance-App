import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { beverages, profiles, scannedBeverages } from '../db/schema.js';
import { badRequest, notFound } from '../lib/errors.js';
import { assertProfileOwned } from '../lib/ownership.js';
import { serializeBeverage, serializeScannedBeverage } from '../lib/serialize.js';

const beverageSchema = z.object({
  profile_id: z.string().uuid(),
  name: z.string().min(1).default('Custom'),
  serving_size: z.number().positive().default(8),
  hydration_factor: z.number().positive().default(1),
  icon: z.string().default('droplet'),
  is_default: z.boolean().default(false),
});

const scannedSchema = z.object({
  profile_id: z.string().uuid(),
  barcode: z.string().default(''),
  name: z.string().min(1).default('Scanned'),
  serving_size: z.number().positive().default(8),
  hydration_factor: z.number().positive().default(1),
});

/** Shared by both delete routes: restricts to profiles the caller owns. */
function ownedProfileIds(userId: string) {
  return db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId));
}

export const beverageRoutes = new Hono<AppEnv>();

beverageRoutes.get('/', async (c) => {
  const user = c.get('user');
  const profileId = c.req.query('profile_id');

  if (!profileId) throw badRequest('profile_id is required.');
  await assertProfileOwned(user.id, profileId);

  const rows = await db
    .select()
    .from(beverages)
    .where(eq(beverages.profileId, profileId))
    .orderBy(asc(beverages.createdAt));

  return c.json({ data: rows.map(serializeBeverage) });
});

beverageRoutes.post('/', async (c) => {
  const user = c.get('user');
  const parsed = beverageSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid beverage.');
  }

  const input = parsed.data;
  await assertProfileOwned(user.id, input.profile_id);

  const [row] = await db
    .insert(beverages)
    .values({
      profileId: input.profile_id,
      name: input.name,
      servingSize: String(input.serving_size),
      hydrationFactor: String(input.hydration_factor),
      icon: input.icon,
      isDefault: input.is_default,
    })
    .returning();

  if (!row) throw badRequest('Unable to save this beverage.');
  return c.json({ data: serializeBeverage(row) }, 201);
});

beverageRoutes.delete('/:id', async (c) => {
  const user = c.get('user');

  const [row] = await db
    .delete(beverages)
    .where(
      and(eq(beverages.id, c.req.param('id')), inArray(beverages.profileId, ownedProfileIds(user.id))),
    )
    .returning({ id: beverages.id });

  if (!row) throw notFound('Beverage not found');
  return c.json({ success: true });
});

export const scannedBeverageRoutes = new Hono<AppEnv>();

scannedBeverageRoutes.get('/', async (c) => {
  const user = c.get('user');
  const profileId = c.req.query('profile_id');

  if (!profileId) throw badRequest('profile_id is required.');
  await assertProfileOwned(user.id, profileId);

  const rows = await db
    .select()
    .from(scannedBeverages)
    .where(eq(scannedBeverages.profileId, profileId))
    .orderBy(desc(scannedBeverages.createdAt));

  return c.json({ data: rows.map(serializeScannedBeverage) });
});

scannedBeverageRoutes.post('/', async (c) => {
  const user = c.get('user');
  const parsed = scannedSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid scanned beverage.');
  }

  const input = parsed.data;
  await assertProfileOwned(user.id, input.profile_id);

  const [row] = await db
    .insert(scannedBeverages)
    .values({
      profileId: input.profile_id,
      barcode: input.barcode,
      name: input.name,
      servingSize: String(input.serving_size),
      hydrationFactor: String(input.hydration_factor),
    })
    .returning();

  if (!row) throw badRequest('Unable to save this scanned beverage.');
  return c.json({ data: serializeScannedBeverage(row) }, 201);
});

scannedBeverageRoutes.delete('/:id', async (c) => {
  const user = c.get('user');

  const [row] = await db
    .delete(scannedBeverages)
    .where(
      and(
        eq(scannedBeverages.id, c.req.param('id')),
        inArray(scannedBeverages.profileId, ownedProfileIds(user.id)),
      ),
    )
    .returning({ id: scannedBeverages.id });

  if (!row) throw notFound('Scanned beverage not found');
  return c.json({ success: true });
});
