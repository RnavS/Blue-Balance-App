import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { subscriptionEntitlements } from '../db/schema.js';
import { HttpError } from './errors.js';

// Ported from supabase/functions/_shared/stripe.ts. The Stripe REST calls are
// unchanged; only the persistence layer moved from the Supabase client to Drizzle.

export type PremiumRecord = typeof subscriptionEntitlements.$inferSelect;

const MONTHLY_PRODUCT_ID = 'bb_premium_monthly';
const ANNUAL_PRODUCT_ID = 'bb_premium_yearly';

function requireStripeKey(): string {
  if (!config.stripeSecretKey) {
    throw new HttpError(500, 'STRIPE_SECRET_KEY is not configured', {
      error: 'stripe_not_configured',
    });
  }
  return config.stripeSecretKey;
}

export function formEncode(values: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  return params;
}

export async function stripeRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: URLSearchParams;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const { method = 'GET', body, query } = options;
  const url = new URL(`https://api.stripe.com/v1${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${requireStripeKey()}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body?.toString(),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new HttpError(502, 'Stripe request failed', {
      error: 'stripe_request_failed',
      stripeStatus: response.status,
      stripe: data,
    });
  }

  return data as T;
}

export function getPriceId(packageType: string): string | null {
  if (packageType === 'monthly') return config.stripeMonthlyPriceId || null;
  if (packageType === 'annual') return config.stripeAnnualPriceId || null;
  return null;
}

export function mapPriceIdToProductId(priceId: string | null | undefined) {
  if (!priceId) return null;
  if (priceId === config.stripeMonthlyPriceId) return MONTHLY_PRODUCT_ID;
  if (priceId === config.stripeAnnualPriceId) return ANNUAL_PRODUCT_ID;
  return priceId;
}

export async function getStoredPremiumRecord(userId: string): Promise<PremiumRecord | null> {
  const [row] = await db
    .select()
    .from(subscriptionEntitlements)
    .where(eq(subscriptionEntitlements.userId, userId))
    .limit(1);

  return row ?? null;
}

export async function getStoredPremiumRecordByCustomerId(
  customerId: string,
): Promise<PremiumRecord | null> {
  const [row] = await db
    .select()
    .from(subscriptionEntitlements)
    .where(eq(subscriptionEntitlements.stripeCustomerId, customerId))
    .limit(1);

  return row ?? null;
}

type PremiumUpsert = Partial<typeof subscriptionEntitlements.$inferInsert> & { userId: string };

export async function upsertPremiumRecord(record: PremiumUpsert): Promise<PremiumRecord> {
  const values = {
    entitlementId: 'premium',
    isActive: false,
    platform: 'stripe',
    rawSubscription: {},
    ...record,
  };

  const [row] = await db
    .insert(subscriptionEntitlements)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptionEntitlements.userId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  if (!row) {
    throw new HttpError(500, 'Unable to save premium state', { error: 'premium_upsert_failed' });
  }

  return row;
}

export async function searchStripeCustomerByUserId(userId: string) {
  const query = `metadata['app_user_id']:'${userId}'`;
  const result = await stripeRequest<{ data?: Array<any> }>('/customers/search', {
    query: { query, limit: 1 },
  }).catch(() => ({ data: [] as Array<any> }));

  return result.data?.[0] ?? null;
}

export async function listStripeCustomersByEmail(email: string) {
  const result = await stripeRequest<{ data?: Array<any> }>('/customers', {
    query: { email, limit: 10 },
  });
  return result.data ?? [];
}

export async function retrieveStripeCustomer(customerId: string) {
  return await stripeRequest<any>(`/customers/${customerId}`);
}

export async function createStripeCustomer(user: { id: string; email: string }) {
  return await stripeRequest<any>('/customers', {
    method: 'POST',
    body: formEncode({
      email: user.email,
      'metadata[app_user_id]': user.id,
    }),
  });
}

export async function ensureStripeCustomerForUser(user: { id: string; email: string }) {
  const stored = await getStoredPremiumRecord(user.id);
  if (stored?.stripeCustomerId) return stored.stripeCustomerId;

  let customer = await searchStripeCustomerByUserId(user.id);

  if (!customer && user.email) {
    const matching = (await listStripeCustomersByEmail(user.email)).find(
      (entry) => entry?.metadata?.app_user_id === user.id,
    );
    customer = matching ?? null;
  }

  if (!customer) {
    customer = await createStripeCustomer(user);
  }

  await upsertPremiumRecord({ userId: user.id, stripeCustomerId: customer.id });
  return customer.id as string;
}

export async function listStripeSubscriptions(customerId: string) {
  const result = await stripeRequest<{ data?: Array<any> }>('/subscriptions', {
    query: { customer: customerId, status: 'all', limit: 10 },
  });
  return result.data ?? [];
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return await stripeRequest<any>(`/subscriptions/${subscriptionId}`);
}

export async function cancelStripeSubscription(subscriptionId: string) {
  return await stripeRequest<any>(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

export async function deleteStripeCustomer(customerId: string) {
  return await stripeRequest<any>(`/customers/${customerId}`, { method: 'DELETE' });
}

function selectRelevantSubscription(subscriptions: any[]) {
  const rankedStatuses = ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete'];

  const sorted = [...subscriptions].sort((left, right) => {
    const leftRank = rankedStatuses.indexOf(left?.status ?? '');
    const rightRank = rankedStatuses.indexOf(right?.status ?? '');
    if (leftRank !== rightRank) return leftRank - rightRank;
    return Number(right?.created ?? 0) - Number(left?.created ?? 0);
  });

  return sorted[0] ?? null;
}

function isActiveStripeStatus(status: string | null | undefined) {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export function serializePremiumState(record: PremiumRecord | null, scansUsedThisMonth = 0) {
  return {
    isPremium: Boolean(record?.isActive),
    entitlementId: record?.entitlementId === 'premium' ? 'premium' : null,
    productId: record?.productId ?? null,
    priceId: record?.priceId ?? null,
    platform: record?.platform ?? null,
    expiresAt: record?.expiresAt?.toISOString() ?? null,
    willRenew: typeof record?.willRenew === 'boolean' ? record.willRenew : null,
    scansUsedThisMonth,
    scansLimitThisMonth: record?.isActive ? null : 5,
  };
}

export async function syncPremiumRecordForUser(user: {
  id: string;
  email: string;
}): Promise<PremiumRecord> {
  const stored = await getStoredPremiumRecord(user.id);

  // With Stripe unconfigured there is nothing to sync against; return whatever
  // is stored so the rest of the app still works.
  if (!config.stripeSecretKey) {
    return stored ?? (await upsertPremiumRecord({ userId: user.id, platform: 'stripe' }));
  }

  let customerId = stored?.stripeCustomerId ?? null;

  if (!customerId) {
    const searched = await searchStripeCustomerByUserId(user.id);
    if (searched?.id) {
      customerId = searched.id;
    } else if (user.email) {
      const matching = (await listStripeCustomersByEmail(user.email)).find(
        (entry) => entry?.metadata?.app_user_id === user.id,
      );
      customerId = matching?.id ?? null;
    }
  }

  if (!customerId) {
    return stored ?? (await upsertPremiumRecord({ userId: user.id, platform: 'stripe' }));
  }

  const customer = await retrieveStripeCustomer(customerId);
  const subscriptions = await listStripeSubscriptions(customerId);
  const subscription = selectRelevantSubscription(subscriptions);
  const priceId = subscription?.items?.data?.[0]?.price?.id ?? null;
  const isActive = isActiveStripeStatus(subscription?.status ?? null);

  return await upsertPremiumRecord({
    userId: user.id,
    entitlementId: 'premium',
    isActive,
    productId: mapPriceIdToProductId(priceId),
    priceId,
    platform: 'stripe',
    expiresAt:
      typeof subscription?.current_period_end === 'number'
        ? new Date(subscription.current_period_end * 1000)
        : null,
    willRenew: isActive ? !subscription?.cancel_at_period_end : false,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription?.id ?? null,
    latestPurchaseAt:
      typeof subscription?.created === 'number' ? new Date(subscription.created * 1000) : null,
    rawSubscription: { customer, subscription },
  });
}
