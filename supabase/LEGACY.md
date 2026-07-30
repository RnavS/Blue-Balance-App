# Legacy — superseded by `server/`

Nothing in this directory is used by the app any more. It is kept only as a
reference during the cutover and for the migration SQL.

The app was migrated off Supabase entirely:

| Was | Now |
|---|---|
| Supabase Auth | `server/src/auth` — scrypt + JWT with rotating refresh tokens |
| Supabase Postgres | Any Postgres, schema in `server/src/db/schema.ts` |
| Row-level security policies | Explicit ownership checks in the route handlers |
| `functions/ai-coach` | `POST /functions/ai-coach` |
| `functions/barcode-lookup` | `POST /functions/barcode-lookup` |
| `functions/sync-premium-status` | `POST /functions/sync-premium-status` |
| `functions/create-stripe-checkout-session` | `POST /functions/create-stripe-checkout-session` |
| `functions/create-stripe-portal-session` | `POST /functions/create-stripe-portal-session` |
| `functions/stripe-webhook` | `POST /webhooks/stripe` |
| `functions/delete-account` | `DELETE /account` |

The `migrations/` SQL here is still the source of truth for what the old schema
looked like, which matters if you ever run
`server/src/scripts/import-from-supabase.ts` against a restored project.

Safe to delete once the new backend has been running in production long enough
that you are confident no data needs recovering. Git history retains it either way.
