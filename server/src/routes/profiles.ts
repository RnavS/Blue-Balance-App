import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import { badRequest, notFound } from '../lib/errors.js';
import { serializeProfile } from '../lib/serialize.js';

const profileInputSchema = z.object({
  username: z.string().min(1).optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  age: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  weight: z.number().int().positive().nullable().optional(),
  unit_preference: z.enum(['oz', 'ml']).optional(),
  wake_time: z.string().optional(),
  sleep_time: z.string().optional(),
  activity_level: z.enum(['light', 'moderate', 'high']).optional(),
  daily_goal: z.number().int().positive().optional(),
  interval_length: z.number().int().positive().optional(),
  theme: z.string().optional(),
  custom_accent_color: z.string().nullable().optional(),
  gradient_preset: z.string().nullable().optional(),
  reminders_enabled: z.boolean().optional(),
  reminder_interval: z.number().int().positive().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  sound_enabled: z.boolean().optional(),
  vibration_enabled: z.boolean().optional(),
});

type ProfileInput = z.infer<typeof profileInputSchema>;

/** Maps the app's snake_case wire format onto the Drizzle column names. */
function toColumns(input: ProfileInput) {
  const values: Record<string, unknown> = {};
  const assign = (key: keyof ProfileInput, column: string) => {
    if (input[key] !== undefined) values[column] = input[key];
  };

  assign('username', 'username');
  assign('first_name', 'firstName');
  assign('last_name', 'lastName');
  assign('age', 'age');
  assign('height', 'height');
  assign('weight', 'weight');
  assign('unit_preference', 'unitPreference');
  assign('wake_time', 'wakeTime');
  assign('sleep_time', 'sleepTime');
  assign('activity_level', 'activityLevel');
  assign('daily_goal', 'dailyGoal');
  assign('interval_length', 'intervalLength');
  assign('theme', 'theme');
  assign('custom_accent_color', 'customAccentColor');
  assign('gradient_preset', 'gradientPreset');
  assign('reminders_enabled', 'remindersEnabled');
  assign('reminder_interval', 'reminderInterval');
  assign('quiet_hours_start', 'quietHoursStart');
  assign('quiet_hours_end', 'quietHoursEnd');
  assign('sound_enabled', 'soundEnabled');
  assign('vibration_enabled', 'vibrationEnabled');

  return values;
}

export const profileRoutes = new Hono<AppEnv>();

profileRoutes.get('/', async (c) => {
  const user = c.get('user');

  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .orderBy(asc(profiles.createdAt));

  return c.json({ data: rows.map(serializeProfile) });
});

profileRoutes.post('/', async (c) => {
  const user = c.get('user');
  const parsed = profileInputSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid profile.');
  }

  const values = toColumns(parsed.data);
  const username =
    (typeof values.username === 'string' && values.username.trim()) ||
    [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(' ').trim() ||
    'User';

  const [row] = await db
    .insert(profiles)
    .values({ ...values, userId: user.id, username })
    .returning();

  if (!row) throw badRequest('Unable to create profile.');
  return c.json({ data: serializeProfile(row) }, 201);
});

profileRoutes.patch('/:id', async (c) => {
  const user = c.get('user');
  const parsed = profileInputSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid profile.');
  }

  // The user_id predicate is what replaces the RLS UPDATE policy: a profile
  // belonging to someone else simply matches no rows.
  const [row] = await db
    .update(profiles)
    .set({ ...toColumns(parsed.data), updatedAt: new Date() })
    .where(and(eq(profiles.id, c.req.param('id')), eq(profiles.userId, user.id)))
    .returning();

  if (!row) throw notFound('Profile not found');
  return c.json({ data: serializeProfile(row) });
});

profileRoutes.delete('/:id', async (c) => {
  const user = c.get('user');

  const [row] = await db
    .delete(profiles)
    .where(and(eq(profiles.id, c.req.param('id')), eq(profiles.userId, user.id)))
    .returning({ id: profiles.id });

  if (!row) throw notFound('Profile not found');
  return c.json({ success: true });
});
