/**
 * End-to-end smoke test for the API.
 *
 * Runs against embedded Postgres (PGlite), so it needs no database server and no
 * network. Hono apps are plain fetch handlers, so this drives the real routes,
 * real middleware and real SQL — not mocks.
 *
 *   npm run smoke
 */
import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';

// Must be set before importing anything that reads config at module load time.
process.env.DATABASE_URL ||= 'pglite://';
process.env.AUTH_JWT_SECRET ||= 'smoke-test-secret-that-is-at-least-32-chars';
process.env.BLUE_BALANCE_NO_LISTEN = '1';

const { db, pool } = await import('./db/client.js');

const BASE = 'http://localhost';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function applyMigrations() {
  const raw = await readFile('./drizzle/0000_init.sql', 'utf8');
  // Drizzle separates statements with this breakpoint marker.
  const statements = raw
    .split('--> statement-breakpoint')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

async function main() {
  console.log('Applying migrations to embedded Postgres...');
  await applyMigrations();

  const { app } = await import('./index.js');
  const call = (path: string, init: RequestInit = {}) =>
    app.fetch(new Request(`${BASE}${path}`, init));

  const json = (body: unknown) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  console.log('\nHealth');
  const health = await call('/health');
  check('GET /health returns 200', health.status === 200);

  console.log('\nAuth');
  const email = `test-${Date.now()}@example.com`;
  const signup = await call('/auth/signup', json({ email, password: 'hunter2hunter2' }));
  const signupBody: any = await signup.json();
  check('POST /auth/signup creates an account', signup.status === 201, `got ${signup.status}`);
  check('signup returns an access token', typeof signupBody?.session?.accessToken === 'string');
  check('signup returns a refresh token', typeof signupBody?.session?.refreshToken === 'string');

  const dupe = await call('/auth/signup', json({ email, password: 'hunter2hunter2' }));
  check('duplicate signup is rejected with 409', dupe.status === 409, `got ${dupe.status}`);

  const weak = await call('/auth/signup', json({ email: 'x@y.com', password: 'short' }));
  check('short password is rejected', weak.status === 400, `got ${weak.status}`);

  const badSignin = await call('/auth/signin', json({ email, password: 'wrongpassword' }));
  check('wrong password is rejected with 401', badSignin.status === 401, `got ${badSignin.status}`);

  const signin = await call('/auth/signin', json({ email, password: 'hunter2hunter2' }));
  const session: any = await signin.json();
  check('POST /auth/signin succeeds', signin.status === 200, `got ${signin.status}`);

  const token = session.session.accessToken;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const authed = (body: unknown) => ({ method: 'POST', headers: auth, body: JSON.stringify(body) });

  const me = await call('/auth/me', { headers: auth });
  const meBody: any = await me.json();
  check('GET /auth/me returns the user', me.status === 200 && meBody?.user?.email === email);

  const noAuth = await call('/profiles');
  check('unauthenticated request is rejected with 401', noAuth.status === 401, `got ${noAuth.status}`);

  const badToken = await call('/profiles', { headers: { Authorization: 'Bearer not.a.token' } });
  check('invalid token is rejected with 401', badToken.status === 401, `got ${badToken.status}`);

  const refreshed = await call('/auth/refresh', json({ refreshToken: session.session.refreshToken }));
  check('POST /auth/refresh issues a new session', refreshed.status === 200, `got ${refreshed.status}`);
  const reused = await call('/auth/refresh', json({ refreshToken: session.session.refreshToken }));
  check('a used refresh token cannot be replayed', reused.status === 401, `got ${reused.status}`);

  console.log('\nProfiles');
  const createProfile = await call(
    '/profiles',
    authed({ first_name: 'Test', last_name: 'User', daily_goal: 100, unit_preference: 'oz' }),
  );
  const profileBody: any = await createProfile.json();
  check('POST /profiles creates a profile', createProfile.status === 201, `got ${createProfile.status}`);
  check('profile is serialized as snake_case', profileBody?.data?.daily_goal === 100);
  check('username is derived from first/last name', profileBody?.data?.username === 'Test User');

  const profileId = profileBody.data.id;

  const listProfiles = await call('/profiles', { headers: auth });
  const listBody: any = await listProfiles.json();
  check('GET /profiles lists the profile', listBody?.data?.length === 1);

  const patch = await call(`/profiles/${profileId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ daily_goal: 120, theme: 'ocean' }),
  });
  const patchBody: any = await patch.json();
  check('PATCH /profiles updates fields', patchBody?.data?.daily_goal === 120 && patchBody?.data?.theme === 'ocean');

  console.log('\nWater logs');
  const createLog = await call(
    '/water-logs',
    authed({
      profile_id: profileId,
      amount: 14.4,
      raw_amount: 16,
      hydration_factor: 0.9,
      drink_type: 'Coffee',
      category: 'coffee',
      source: 'manual',
    }),
  );
  const logBody: any = await createLog.json();
  check('POST /water-logs creates a log', createLog.status === 201, `got ${createLog.status}`);
  check('numeric columns come back as numbers', typeof logBody?.data?.amount === 'number');
  check('amount round-trips exactly', logBody?.data?.amount === 14.4);
  check('raw_amount round-trips', logBody?.data?.raw_amount === 16);

  const listLogs = await call(`/water-logs?profile_id=${profileId}`, { headers: auth });
  const logsBody: any = await listLogs.json();
  check('GET /water-logs lists logs', logsBody?.data?.length === 1);

  const missingProfileQuery = await call('/water-logs', { headers: auth });
  check('GET /water-logs requires profile_id', missingProfileQuery.status === 400);

  console.log('\nBeverages, scans and chat');
  const beverage = await call('/beverages', authed({ profile_id: profileId, name: 'Electrolyte', serving_size: 16.9, hydration_factor: 0.95 }));
  check('POST /beverages creates a beverage', beverage.status === 201, `got ${beverage.status}`);

  const scanned = await call('/scanned-beverages', authed({ profile_id: profileId, barcode: '5449000000996', name: 'Coca-Cola', serving_size: 11.2 }));
  check('POST /scanned-beverages records a scan', scanned.status === 201, `got ${scanned.status}`);

  const chat = await call('/chat-messages', authed({ profile_id: profileId, role: 'user', content: 'How am I doing?' }));
  check('POST /chat-messages stores a message', chat.status === 201, `got ${chat.status}`);

  const badRole = await call('/chat-messages', authed({ profile_id: profileId, role: 'system', content: 'x' }));
  check('invalid chat role is rejected', badRole.status === 400, `got ${badRole.status}`);

  console.log('\nOwnership isolation (replaces RLS)');
  const otherEmail = `other-${Date.now()}@example.com`;
  const otherSignup = await call('/auth/signup', json({ email: otherEmail, password: 'hunter2hunter2' }));
  const otherBody: any = await otherSignup.json();
  const otherAuth = {
    Authorization: `Bearer ${otherBody.session.accessToken}`,
    'Content-Type': 'application/json',
  };

  const otherList = await call('/profiles', { headers: otherAuth });
  const otherListBody: any = await otherList.json();
  check("another user cannot see the first user's profiles", otherListBody?.data?.length === 0);

  const stealLogs = await call(`/water-logs?profile_id=${profileId}`, { headers: otherAuth });
  check("another user cannot read someone else's water logs", stealLogs.status === 404, `got ${stealLogs.status}`);

  const stealWrite = await call('/water-logs', {
    method: 'POST',
    headers: otherAuth,
    body: JSON.stringify({ profile_id: profileId, amount: 8 }),
  });
  check("another user cannot write into someone else's profile", stealWrite.status === 404, `got ${stealWrite.status}`);

  const stealPatch = await call(`/profiles/${profileId}`, {
    method: 'PATCH',
    headers: otherAuth,
    body: JSON.stringify({ daily_goal: 999 }),
  });
  check("another user cannot update someone else's profile", stealPatch.status === 404, `got ${stealPatch.status}`);

  const stealDelete = await call(`/profiles/${profileId}`, { method: 'DELETE', headers: otherAuth });
  check("another user cannot delete someone else's profile", stealDelete.status === 404, `got ${stealDelete.status}`);

  console.log('\nPremium and usage metering');
  const premium = await call('/functions/sync-premium-status', { method: 'POST', headers: auth });
  const premiumBody: any = await premium.json();
  check('POST /functions/sync-premium-status responds', premium.status === 200, `got ${premium.status}`);
  check('a new user is not premium', premiumBody?.isPremium === false);
  check('free tier reports a scan limit of 5', premiumBody?.scansLimitThisMonth === 5);

  const coachLocked = await call('/functions/ai-coach', authed({ message: 'hi', platform: 'android' }));
  check('AI coach is gated behind premium on Android', coachLocked.status === 402, `got ${coachLocked.status}`);

  console.log('\nAccount deletion (App Store 5.1.1(v))');
  const del = await call('/account', { method: 'DELETE', headers: auth });
  check('DELETE /account succeeds', del.status === 200, `got ${del.status}`);

  const afterDelete = await call('/auth/me', { headers: auth });
  check('the access token stops working immediately', afterDelete.status === 401, `got ${afterDelete.status}`);

  const orphanCheck = await db.execute(sql`SELECT COUNT(*)::int AS count FROM profiles`);
  const remaining = (orphanCheck as any).rows?.[0]?.count ?? (orphanCheck as any)[0]?.count;
  check('deleting the user cascaded away their profiles', Number(remaining) === 0, `found ${remaining}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nSmoke test crashed:', error);
  await pool.end().catch(() => null);
  process.exit(1);
});
