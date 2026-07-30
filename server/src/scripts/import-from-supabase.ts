/**
 * One-time data import from a Supabase project into the new Postgres database.
 *
 *   SOURCE_DATABASE_URL=postgres://...supabase... \
 *   DATABASE_URL=postgres://...new... \
 *   npx tsx src/scripts/import-from-supabase.ts
 *
 * Reads directly from the old Postgres (Supabase's connection string, not the
 * REST API), so it needs the project to be running and unpaused.
 *
 * Passwords cannot come across: Supabase stores bcrypt hashes in `auth.users`,
 * and this backend uses scrypt. Users are imported with an unusable password and
 * must go through "forgot password" once. Their data is preserved because the
 * user id is carried over unchanged, so every foreign key still lines up.
 *
 * Safe to re-run: every insert is ON CONFLICT DO NOTHING.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;

if (!sourceUrl) throw new Error('SOURCE_DATABASE_URL is required (the Supabase connection string).');
if (!targetUrl) throw new Error('DATABASE_URL is required (the new database).');

const source = new pg.Pool({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
const target = new pg.Pool({
  connectionString: targetUrl,
  ssl: /localhost|127\.0\.0\.1/.test(targetUrl) ? undefined : { rejectUnauthorized: false },
});

async function copy(
  label: string,
  selectSql: string,
  insertSql: string,
  toValues: (row: any) => unknown[],
) {
  const { rows } = await source.query(selectSql);
  let inserted = 0;

  for (const row of rows) {
    const result = await target.query(insertSql, toValues(row));
    inserted += result.rowCount ?? 0;
  }

  console.log(`${label}: ${inserted} inserted (${rows.length} read)`);
}

async function main() {
  console.log('Importing from Supabase...\n');

  // Users first — everything else references them.
  await copy(
    'users',
    `SELECT id, email, email_confirmed_at, created_at FROM auth.users WHERE deleted_at IS NULL`,
    `INSERT INTO users (id, email, password_hash, email_confirmed_at, created_at)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
    (row) => [
      row.id,
      String(row.email).toLowerCase(),
      // Deliberately unusable: no password can hash to this, so the account can
      // only be accessed after a password reset.
      `imported$${randomBytes(32).toString('hex')}`,
      row.email_confirmed_at,
      row.created_at,
    ],
  );

  await copy(
    'profiles',
    `SELECT * FROM public.profiles`,
    `INSERT INTO profiles (
       id, user_id, username, first_name, last_name, age, height, weight,
       unit_preference, wake_time, sleep_time, activity_level, daily_goal,
       interval_length, theme, custom_accent_color, gradient_preset,
       reminders_enabled, reminder_interval, quiet_hours_start, quiet_hours_end,
       sound_enabled, vibration_enabled, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
     ON CONFLICT (id) DO NOTHING`,
    (r) => [
      r.id, r.user_id, r.username, r.first_name, r.last_name, r.age, r.height, r.weight,
      r.unit_preference, r.wake_time, r.sleep_time, r.activity_level, r.daily_goal,
      r.interval_length ?? 60, r.theme, r.custom_accent_color, r.gradient_preset,
      r.reminders_enabled, r.reminder_interval, r.quiet_hours_start, r.quiet_hours_end,
      r.sound_enabled, r.vibration_enabled, r.created_at, r.updated_at,
    ],
  );

  await copy(
    'water_logs',
    `SELECT * FROM public.water_logs`,
    `INSERT INTO water_logs (
       id, profile_id, amount, raw_amount, hydration_factor, drink_type,
       category, source, barcode, details, logged_at, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO NOTHING`,
    (r) => [
      r.id, r.profile_id, r.amount, r.raw_amount, r.hydration_factor ?? 1, r.drink_type,
      r.category, r.source ?? 'manual', r.barcode, r.details ?? {}, r.logged_at, r.created_at,
    ],
  );

  await copy(
    'beverages',
    `SELECT * FROM public.beverages`,
    `INSERT INTO beverages (id, profile_id, name, serving_size, hydration_factor, icon, is_default, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
    (r) => [r.id, r.profile_id, r.name, r.serving_size, r.hydration_factor, r.icon, r.is_default, r.created_at],
  );

  await copy(
    'scanned_beverages',
    `SELECT * FROM public.scanned_beverages`,
    `INSERT INTO scanned_beverages (id, profile_id, barcode, name, serving_size, hydration_factor, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    (r) => [r.id, r.profile_id, r.barcode, r.name, r.serving_size, r.hydration_factor, r.created_at],
  );

  await copy(
    'chat_messages',
    `SELECT * FROM public.chat_messages`,
    `INSERT INTO chat_messages (id, profile_id, role, content, created_at)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
    (r) => [r.id, r.profile_id, r.role, r.content, r.created_at],
  );

  await copy(
    'subscription_entitlements',
    `SELECT * FROM public.subscription_entitlements`,
    `INSERT INTO subscription_entitlements (
       user_id, entitlement_id, is_active, product_id, price_id, platform,
       expires_at, will_renew, stripe_customer_id, stripe_subscription_id,
       latest_purchase_at, raw_subscription, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (user_id) DO NOTHING`,
    (r) => [
      r.user_id, r.entitlement_id, r.is_active, r.product_id, r.price_id, r.platform,
      r.expires_at, r.will_renew, r.stripe_customer_id, r.stripe_subscription_id,
      r.latest_purchase_at, r.raw_subscription ?? {}, r.created_at, r.updated_at,
    ],
  );

  await copy(
    'usage_counters',
    `SELECT * FROM public.usage_counters`,
    `INSERT INTO usage_counters (id, user_id, feature_key, period_key, count, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, feature_key, period_key) DO NOTHING`,
    (r) => [r.id, r.user_id, r.feature_key, r.period_key, r.count, r.created_at, r.updated_at],
  );

  console.log('\nImport complete.');
  console.log('Every imported user must reset their password before signing in.');
  console.log('Stripe customers carry over, but their metadata still uses the');
  console.log('supabase_user_id key — the webhook reads both keys, so this is fine.');
}

main()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.end().catch(() => null);
    await target.end().catch(() => null);
  });
