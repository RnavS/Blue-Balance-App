import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { chatMessages } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { assertProfileOwned } from '../lib/ownership.js';
import { serializeChatMessage } from '../lib/serialize.js';

const createSchema = z.object({
  profile_id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

export const chatMessageRoutes = new Hono<AppEnv>();

chatMessageRoutes.get('/', async (c) => {
  const user = c.get('user');
  const profileId = c.req.query('profile_id');

  if (!profileId) throw badRequest('profile_id is required.');
  await assertProfileOwned(user.id, profileId);

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.profileId, profileId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(100);

  return c.json({ data: rows.map(serializeChatMessage) });
});

chatMessageRoutes.post('/', async (c) => {
  const user = c.get('user');
  const parsed = createSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid chat message.');
  }

  const input = parsed.data;
  await assertProfileOwned(user.id, input.profile_id);

  const [row] = await db
    .insert(chatMessages)
    .values({ profileId: input.profile_id, role: input.role, content: input.content })
    .returning();

  if (!row) throw badRequest('Unable to save this message.');
  return c.json({ data: serializeChatMessage(row) }, 201);
});

/** Clears an entire conversation — the app's "clear chat" action. */
chatMessageRoutes.delete('/', async (c) => {
  const user = c.get('user');
  const profileId = c.req.query('profile_id');

  if (!profileId) throw badRequest('profile_id is required.');
  await assertProfileOwned(user.id, profileId);

  await db.delete(chatMessages).where(eq(chatMessages.profileId, profileId));
  return c.json({ success: true });
});
