import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Replaces Supabase's `auth.users`. Everything that used to reference
 * `auth.users(id)` now references this table, and the ON DELETE CASCADE chain is
 * preserved so deleting a user still removes all of their data in one statement.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  // Supabase auto-confirmed users via a trigger (see the
  // auto_confirm_auth_users migration), so signup confirms immediately here too.
  emailConfirmedAt: timestamp('email_confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Opaque refresh tokens. Only a SHA-256 hash is stored, so a database leak does
 * not hand out live sessions. Rotated on every use.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('refresh_tokens_user_idx').on(table.userId)],
);

/** Single-use password reset tokens, stored hashed for the same reason. */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('password_reset_tokens_user_idx').on(table.userId)],
);

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    username: text('username').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    age: integer('age'),
    height: integer('height'),
    weight: integer('weight'),
    unitPreference: text('unit_preference').notNull().default('oz'),
    wakeTime: text('wake_time').notNull().default('07:00'),
    sleepTime: text('sleep_time').notNull().default('22:00'),
    activityLevel: text('activity_level').notNull().default('moderate'),
    dailyGoal: integer('daily_goal').notNull().default(80),
    intervalLength: integer('interval_length').notNull().default(60),
    theme: text('theme').notNull().default('midnight'),
    customAccentColor: text('custom_accent_color'),
    gradientPreset: text('gradient_preset'),
    remindersEnabled: boolean('reminders_enabled').notNull().default(false),
    reminderInterval: integer('reminder_interval').notNull().default(60),
    quietHoursStart: text('quiet_hours_start').notNull().default('22:00'),
    quietHoursEnd: text('quiet_hours_end').notNull().default('07:00'),
    soundEnabled: boolean('sound_enabled').notNull().default(true),
    vibrationEnabled: boolean('vibration_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('profiles_user_idx').on(table.userId)],
);

export const waterLogs = pgTable(
  'water_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    amount: numeric('amount').notNull(),
    rawAmount: numeric('raw_amount'),
    hydrationFactor: numeric('hydration_factor').notNull().default('1.0'),
    drinkType: text('drink_type').notNull().default('water'),
    category: text('category'),
    source: text('source').notNull().default('manual'),
    barcode: text('barcode'),
    details: jsonb('details').notNull().default({}),
    loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('water_logs_profile_logged_idx').on(table.profileId, table.loggedAt),
    index('water_logs_profile_category_idx').on(table.profileId, table.category),
  ],
);

export const beverages = pgTable(
  'beverages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    servingSize: numeric('serving_size').notNull().default('8'),
    hydrationFactor: numeric('hydration_factor').notNull().default('1.0'),
    icon: text('icon').default('droplet'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('beverages_profile_idx').on(table.profileId)],
);

export const scannedBeverages = pgTable(
  'scanned_beverages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    barcode: text('barcode').notNull(),
    name: text('name').notNull(),
    servingSize: numeric('serving_size').notNull(),
    hydrationFactor: numeric('hydration_factor').notNull().default('1.0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('scanned_beverages_profile_idx').on(table.profileId)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('chat_messages_profile_idx').on(table.profileId)],
);

export const subscriptionEntitlements = pgTable(
  'subscription_entitlements',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    entitlementId: text('entitlement_id').notNull().default('premium'),
    isActive: boolean('is_active').notNull().default(false),
    productId: text('product_id'),
    priceId: text('price_id'),
    platform: text('platform'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    willRenew: boolean('will_renew'),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    latestPurchaseAt: timestamp('latest_purchase_at', { withTimezone: true }),
    rawSubscription: jsonb('raw_subscription').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('subscription_entitlements_customer_idx').on(table.stripeCustomerId)],
);

export const usageCounters = pgTable(
  'usage_counters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    featureKey: text('feature_key').notNull(),
    periodKey: text('period_key').notNull(),
    count: integer('count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('usage_counters_user_feature_period_unique').on(
      table.userId,
      table.featureKey,
      table.periodKey,
    ),
  ],
);

/** Stripe webhook idempotency ledger — the event id is the primary key. */
export const billingEvents = pgTable('billing_events', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  customerId: text('customer_id'),
  eventType: text('event_type'),
  payload: jsonb('payload').notNull().default({}),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});
