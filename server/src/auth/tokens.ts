import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { passwordResetTokens, refreshTokens } from '../db/schema.js';
import { unauthorized } from '../lib/errors.js';

const secret = new TextEncoder().encode(config.jwtSecret);
const ISSUER = 'blue-balance';

export interface AccessTokenClaims {
  sub: string;
  email: string;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return await new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTokenTtlSeconds}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    if (!payload.sub) throw new Error('missing sub');
    return { sub: payload.sub, email: String(payload.email ?? '') };
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Returns the raw token; only its hash is persisted. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return token;
}

/**
 * Validates a refresh token and rotates it — the presented token is revoked and a
 * fresh one issued, so a stolen token is usable at most once before the real
 * client's next refresh invalidates it.
 */
export async function rotateRefreshToken(
  token: string,
): Promise<{ userId: string; refreshToken: string }> {
  const tokenHash = hashToken(token);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
    .limit(1);

  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Your session has expired. Please sign in again.');
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, stored.id));

  const refreshToken = await issueRefreshToken(stored.userId);
  return { userId: stored.userId, refreshToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, hashToken(token)));
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

export async function issuePasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string> {
  const tokenHash = hashToken(token);

  const [stored] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt)))
    .limit(1);

  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw unauthorized('This reset link is invalid or has expired.');
  }

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, stored.id));

  return stored.userId;
}
