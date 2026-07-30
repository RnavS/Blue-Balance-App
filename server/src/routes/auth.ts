import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { requireUser, type AppEnv } from '../auth/middleware.js';
import {
  consumePasswordResetToken,
  issuePasswordResetToken,
  issueRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '../auth/tokens.js';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { HttpError, badRequest, unauthorized } from '../lib/errors.js';

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export const authRoutes = new Hono<AppEnv>();

/** Compared against on sign-in attempts for emails that have no account. */
const DUMMY_PASSWORD_HASH = await hashPassword(randomBytes(32).toString('hex'));

function sessionPayload(user: { id: string; email: string }, accessToken: string, refreshToken: string) {
  return {
    user: { id: user.id, email: user.email },
    session: {
      accessToken,
      refreshToken,
      expiresIn: config.accessTokenTtlSeconds,
      expiresAt: new Date(Date.now() + config.accessTokenTtlSeconds * 1000).toISOString(),
    },
  };
}

authRoutes.post('/signup', async (c) => {
  const parsed = credentialsSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid credentials.');
  }

  const email = parsed.data.email.trim().toLowerCase();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists.', {
      error: 'email_taken',
    });
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(parsed.data.password),
      // Supabase auto-confirmed signups via a trigger; same behaviour here.
      emailConfirmedAt: new Date(),
    })
    .returning({ id: users.id, email: users.email });

  if (!user) throw new HttpError(500, 'Unable to create your account.');

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email }),
    issueRefreshToken(user.id),
  ]);

  return c.json(sessionPayload(user, accessToken, refreshToken), 201);
});

authRoutes.post('/signin', async (c) => {
  const parsed = credentialsSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    throw unauthorized('Invalid email or password.');
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Verify against a real hash even when the account does not exist, so the
  // response time does not reveal which emails are registered. DUMMY_PASSWORD_HASH
  // has full-length salt and key, so scrypt does the same work either way.
  const passwordOk = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordOk) {
    throw unauthorized('Invalid email or password.');
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email }),
    issueRefreshToken(user.id),
  ]);

  return c.json(sessionPayload(user, accessToken, refreshToken));
});

authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = String(body?.refreshToken ?? '');

  if (!token) throw unauthorized('A refresh token is required.');

  const { userId, refreshToken } = await rotateRefreshToken(token);

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw unauthorized();

  const accessToken = await signAccessToken({ sub: user.id, email: user.email });
  return c.json(sessionPayload(user, accessToken, refreshToken));
});

authRoutes.post('/signout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = String(body?.refreshToken ?? '');
  if (token) await revokeRefreshToken(token);
  return c.json({ success: true });
});

/**
 * Always reports success so the endpoint cannot be used to enumerate which
 * emails have accounts.
 *
 * There is no transactional email provider wired up yet, so in development the
 * token is returned in the response. Before launch, send it by email instead and
 * delete the `resetToken` field — see server/README.md.
 */
authRoutes.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (!email) throw badRequest('An email address is required.');

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    return c.json({ success: true });
  }

  const resetToken = await issuePasswordResetToken(user.id);

  if (config.nodeEnv === 'production') {
    console.warn('Password reset requested but no email provider is configured.');
    return c.json({ success: true });
  }

  return c.json({ success: true, resetToken });
});

authRoutes.post('/reset-password/confirm', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = String(body?.token ?? '');
  const password = String(body?.password ?? '');

  if (!token) throw badRequest('A reset token is required.');
  if (password.length < 8) throw badRequest('Password must be at least 8 characters.');

  const userId = await consumePasswordResetToken(token);

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
    .where(eq(users.id, userId));

  // A password change should end every other session.
  await revokeAllRefreshTokens(userId);

  return c.json({ success: true });
});

authRoutes.get('/me', requireUser, (c) => {
  return c.json({ user: c.get('user') });
});
