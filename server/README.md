# Blue Balance API

The backend for the Blue Balance app. Replaces Supabase (auth, Postgres, RLS, and
the seven edge functions) with a self-hosted service that runs anywhere Node runs.

## Stack

| Concern | Choice | Why |
|---|---|---|
| HTTP | [Hono](https://hono.dev) | Plain `Request`/`Response` handlers, so the Deno edge functions ported over almost unchanged and the app is testable without binding a port |
| Database | Postgres via [Drizzle](https://orm.drizzle.team) | Typed queries and real migrations; no vendor lock-in |
| Auth | scrypt + JWT (`jose`) | scrypt ships with Node, so there is no native module to build on deploy |
| Validation | zod | Already used in the app |

Nothing here is tied to a specific host. It runs on Railway, Render, Fly, a VPS,
Docker, or an EC2 box.

## Setup

```bash
cd server
npm install
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` — any Postgres. Neon and Railway both have usable free tiers.
- `AUTH_JWT_SECRET` — generate with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then create the schema and start it:

```bash
npm run db:migrate
npm run dev
```

The API listens on `http://localhost:8787`. Point the app at it by setting
`EXPO_PUBLIC_API_URL` in the repo-root `.env`.

## Verifying it works

```bash
npm run smoke
```

Runs 40 assertions against **real Postgres compiled to WebAssembly** (PGlite), so
it needs no database server and no network. It drives the actual routes and
middleware — signup, signin, refresh-token rotation and replay rejection, CRUD on
every resource, cross-user isolation, premium gating, and account deletion with
its cascade.

You can also run the whole API with zero infrastructure by setting
`DATABASE_URL=pglite://` — handy offline, but the data lives only as long as the
process.

## Routes

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Also pings the database |
| `POST` | `/auth/signup` `/auth/signin` `/auth/refresh` `/auth/signout` | |
| `POST` | `/auth/reset-password` `/auth/reset-password/confirm` | See the caveat below |
| `GET` | `/auth/me` | |
| `GET/POST/PATCH/DELETE` | `/profiles` | |
| `GET/POST/DELETE` | `/water-logs` `/beverages` `/scanned-beverages` `/chat-messages` | Scoped by `?profile_id=` |
| `POST` | `/functions/sync-premium-status` `/functions/barcode-lookup` `/functions/ai-coach` | |
| `POST` | `/functions/create-stripe-checkout-session` `/functions/create-stripe-portal-session` | |
| `POST` | `/webhooks/stripe` | Signature-verified, no bearer token |
| `DELETE` | `/account` | App Store Guideline 5.1.1(v) |

## How authorization replaced RLS

Supabase enforced ownership inside Postgres with policies like:

```sql
USING (EXISTS (SELECT 1 FROM profiles
               WHERE profiles.id = water_logs.profile_id
               AND profiles.user_id = auth.uid()))
```

That protection is now explicit in the route handlers. `requireUser` resolves the
bearer token to a user, and every query either filters on `user_id` directly or
calls `assertProfileOwned()` first. Ownership failures return **404, not 403**, so
the API cannot be used to probe which ids exist.

This is the part of the migration most worth reviewing carefully: Postgres used to
catch a forgotten predicate automatically, and now nothing does. The smoke test
covers the isolation cases (a second user attempting to read, write, update, and
delete another user's data), so keep those passing when adding routes.

## Known gaps

- **Password reset does not send email.** There is no transactional email
  provider wired up. In development the token comes back in the response; in
  production the endpoint returns success and logs a warning without delivering
  anything. Wire up Resend/Postmark/SES and remove the `resetToken` field from
  the response before launch.
- **No rate limiting.** Sign-in and password reset should be throttled before
  this is public.

## Migrating data from Supabase

If the old project is restored and you need its data:

```bash
SOURCE_DATABASE_URL="postgres://...supabase..." \
DATABASE_URL="postgres://...new..." \
npx tsx src/scripts/import-from-supabase.ts
```

User ids carry over, so every foreign key still lines up. Passwords cannot: they
are bcrypt in Supabase and scrypt here, so imported accounts get an unusable
password hash and each user must reset once.

## Deploying

Build and run:

```bash
npm run build
npm start
```

Set the same environment variables on the host, run `npm run db:migrate` against
the production database, and point `EXPO_PUBLIC_API_URL` at the deployed URL.
For Stripe, add a webhook endpoint pointing at `https://<your-host>/webhooks/stripe`
and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
