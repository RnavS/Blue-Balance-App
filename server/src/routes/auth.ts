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
import { isEmailConfigured, passwordResetMessage, sendEmail } from '../lib/email.js';
import { rateLimit } from '../lib/rate-limit.js';

// Credential endpoints are the ones worth throttling: sign-in against stuffing,
// signup against bulk account creation, reset against mailbox spam. Deliberately
// loose enough that a person fat-fingering their password a few times is fine.
const signInLimit = rateLimit({ name: 'signin', limit: 10, windowMs: 5 * 60 * 1000 });
const signUpLimit = rateLimit({ name: 'signup', limit: 5, windowMs: 60 * 60 * 1000 });
const resetLimit = rateLimit({ name: 'reset', limit: 5, windowMs: 60 * 60 * 1000 });

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

authRoutes.post('/signup', signUpLimit, async (c) => {
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

authRoutes.post('/signin', signInLimit, async (c) => {
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
 * Reports the same result whether or not the address has an account, so the
 * endpoint cannot be used to discover which emails are registered.
 *
 * It does refuse up front when no email provider is configured. That distinction
 * depends only on server configuration, not on the address supplied, so it leaks
 * nothing — and it avoids telling someone to check an inbox that will never
 * receive anything.
 */
authRoutes.post('/reset-password', resetLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (!email) throw badRequest('An email address is required.');

  const canSend = isEmailConfigured();

  if (!canSend && config.isProduction) {
    throw new HttpError(
      503,
      'Password reset is unavailable right now. Please contact support.',
      { error: 'email_not_configured' },
    );
  }

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  // Nothing to do, but answer exactly as if there were.
  if (!user) return c.json({ success: true, delivery: canSend ? 'email' : 'response' });

  const resetToken = await issuePasswordResetToken(user.id);

  if (canSend) {
    try {
      await sendEmail(passwordResetMessage(email, resetToken));
    } catch (error) {
      console.error('[auth] Failed to send password reset email:', error);
      throw new HttpError(502, 'Could not send the reset email. Please try again.', {
        error: 'email_send_failed',
      });
    }

    return c.json({ success: true, delivery: 'email' });
  }

  // Development without a provider: hand the token back so the flow is testable.
  // Unreachable in production — the 503 above fires first.
  console.warn('[auth] No email provider configured; returning the reset token directly.');
  return c.json({ success: true, delivery: 'response', resetToken });
});

authRoutes.post('/reset-password/confirm', resetLimit, async (c) => {
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
