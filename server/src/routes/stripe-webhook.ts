import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { billingEvents, users } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import {
  getStoredPremiumRecordByCustomerId,
  retrieveStripeCustomer,
  retrieveStripeSubscription,
  syncPremiumRecordForUser,
} from '../lib/stripe.js';

// Ported from supabase/functions/stripe-webhook. The only behavioural change is
// that the Stripe customer metadata key is `app_user_id` rather than
// `supabase_user_id`; both are read so subscriptions created before the migration
// still resolve.

function parseStripeSignature(header: string) {
  const parts = header.split(',').map((entry) => entry.trim());
  const timestamp = parts.find((entry) => entry.startsWith('t='))?.slice(2);
  const signatures = parts.filter((entry) => entry.startsWith('v1=')).map((entry) => entry.slice(3));

  if (!timestamp || !signatures.length) {
    throw new HttpError(400, 'Invalid Stripe signature header', { error: 'invalid_signature' });
  }

  return { timestamp: Number(timestamp), signatures };
}

function verifyStripeSignature(rawBody: string, signatureHeader: string) {
  if (!config.stripeWebhookSecret) {
    throw new HttpError(500, 'STRIPE_WEBHOOK_SECRET is not configured', {
      error: 'stripe_not_configured',
    });
  }

  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);

  // Rejecting stale timestamps is what stops a captured request being replayed.
  if (ageSeconds > 300) {
    throw new HttpError(400, 'Stripe webhook timestamp is too old', { error: 'signature_expired' });
  }

  const expected = createHmac('sha256', config.stripeWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  const matched = signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, 'hex');
    if (candidateBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });

  if (!matched) {
    throw new HttpError(400, 'Stripe webhook signature check failed', {
      error: 'invalid_signature',
    });
  }
}

function extractCustomerId(object: any): string | null {
  if (typeof object?.customer === 'string') return object.customer;
  if (typeof object?.id === 'string' && object.id.startsWith('cus_')) return object.id;
  return null;
}

function metadataUserId(node: any): string | null {
  const value = node?.metadata?.app_user_id ?? node?.metadata?.supabase_user_id;
  return typeof value === 'string' ? value : null;
}

async function resolveUserId(object: any): Promise<string | null> {
  const direct = metadataUserId(object);
  if (direct) return direct;

  if (typeof object?.client_reference_id === 'string') return object.client_reference_id;

  const customerId = extractCustomerId(object);
  if (customerId) {
    const stored = await getStoredPremiumRecordByCustomerId(customerId);
    if (stored?.userId) return stored.userId;

    const customer = await retrieveStripeCustomer(customerId).catch(() => null);
    const fromCustomer = metadataUserId(customer);
    if (fromCustomer) return fromCustomer;
  }

  if (typeof object?.subscription === 'string') {
    const subscription = await retrieveStripeSubscription(object.subscription).catch(() => null);
    const fromSubscription = metadataUserId(subscription);
    if (fromSubscription) return fromSubscription;

    const subscriptionCustomerId =
      typeof subscription?.customer === 'string' ? subscription.customer : null;

    if (subscriptionCustomerId) {
      const stored = await getStoredPremiumRecordByCustomerId(subscriptionCustomerId);
      if (stored?.userId) return stored.userId;

      const customer = await retrieveStripeCustomer(subscriptionCustomerId).catch(() => null);
      const fromCustomer = metadataUserId(customer);
      if (fromCustomer) return fromCustomer;
    }
  }

  return null;
}

export const stripeWebhookRoutes = new Hono();

stripeWebhookRoutes.post('/', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    throw new HttpError(401, 'Missing Stripe signature header', { error: 'missing_signature' });
  }

  // Must be the exact bytes Stripe signed — never a re-serialized JSON object.
  const rawBody = await c.req.text();
  verifyStripeSignature(rawBody, signature);

  const event = JSON.parse(rawBody);
  const object = event?.data?.object ?? {};

  // The event id is the primary key, so a redelivery conflicts and is skipped.
  const inserted = await db
    .insert(billingEvents)
    .values({
      id: String(event.id ?? randomUUID()),
      source: 'stripe',
      customerId: extractCustomerId(object),
      eventType: String(event?.type ?? 'unknown'),
      payload: event,
    })
    .onConflictDoNothing()
    .returning({ id: billingEvents.id });

  if (!inserted.length) {
    return c.json({ received: true, duplicate: true });
  }

  const userId = await resolveUserId(object);

  if (userId) {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user) {
      await syncPremiumRecordForUser(user);
    }
  }

  return c.json({ received: true });
});
