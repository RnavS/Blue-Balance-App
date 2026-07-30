import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../auth/middleware.js';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import {
  cancelStripeSubscription,
  deleteStripeCustomer,
  getStoredPremiumRecord,
  listStripeSubscriptions,
} from '../lib/stripe.js';

export const accountRoutes = new Hono<AppEnv>();

/**
 * Required by App Store Review Guideline 5.1.1(v): an app that supports account
 * creation must let the user delete that account from inside the app.
 *
 * Every table cascades from `users`, so one delete removes profiles, water_logs,
 * beverages, scanned_beverages, chat_messages, subscription_entitlements,
 * usage_counters, refresh_tokens and password_reset_tokens along with it.
 */
accountRoutes.delete('/', async (c) => {
  const user = c.get('user');

  // Best effort: stop billing before the entitlement row disappears. A Stripe
  // outage must not leave the user unable to delete their account, so failures
  // are reported back rather than thrown.
  const billingWarnings: string[] = [];
  const stored = await getStoredPremiumRecord(user.id).catch(() => null);
  const customerId = stored?.stripeCustomerId ?? null;

  if (customerId && config.stripeSecretKey) {
    try {
      const subscriptions = await listStripeSubscriptions(customerId);
      for (const subscription of subscriptions) {
        if (subscription?.status === 'canceled' || subscription?.status === 'incomplete_expired') {
          continue;
        }
        await cancelStripeSubscription(subscription.id);
      }
      await deleteStripeCustomer(customerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Stripe error';
      console.error('delete-account stripe cleanup failed:', message);
      billingWarnings.push(message);
    }
  }

  await db.delete(users).where(eq(users.id, user.id));

  return c.json({ deleted: true, billingWarnings });
});
