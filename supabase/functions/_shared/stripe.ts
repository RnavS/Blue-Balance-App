import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { HttpError } from "./http.ts";

export type StoredPremiumRecord = {
  user_id: string;
  entitlement_id: string | null;
  is_active: boolean;
  product_id: string | null;
  price_id: string | null;
  platform: "stripe" | null;
  expires_at: string | null;
  will_renew: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  latest_purchase_at: string | null;
  raw_subscription: Record<string, unknown>;
  updated_at?: string;
};

const MONTHLY_PRODUCT_ID = "bb_premium_monthly";
const ANNUAL_PRODUCT_ID = "bb_premium_yearly";

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function formEncode(values: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }

  return params;
}

async function stripeRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: URLSearchParams;
    query?: Record<string, string | number | undefined>;
  } = {},
) {
  const { method = "GET", body, query } = options;
  const url = new URL(`https://api.stripe.com/v1${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${requireEnv("STRIPE_SECRET_KEY")}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body?.toString(),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new HttpError(502, "Stripe request failed", {
      error: "stripe_request_failed",
      stripeStatus: response.status,
      stripe: data,
    });
  }

  return data as T;
}

function getPriceIds() {
  return {
    monthly: requireEnv("STRIPE_PREMIUM_MONTHLY_PRICE_ID"),
    annual: requireEnv("STRIPE_PREMIUM_ANNUAL_PRICE_ID"),
  };
}

export function mapPriceIdToProductId(priceId: string | null | undefined) {
  if (!priceId) return null;

  const priceIds = getPriceIds();
  if (priceId === priceIds.monthly) return MONTHLY_PRODUCT_ID;
  if (priceId === priceIds.annual) return ANNUAL_PRODUCT_ID;
  return priceId;
}

export async function getStoredPremiumRecord(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("subscription_entitlements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Unable to read premium state", {
      error: "premium_lookup_failed",
      details: error.message,
    });
  }

  return data as StoredPremiumRecord | null;
}

export async function getStoredPremiumRecordByCustomerId(
  supabase: SupabaseClient,
  customerId: string,
) {
  const { data, error } = await supabase
    .from("subscription_entitlements")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Unable to read Stripe customer mapping", {
      error: "premium_lookup_failed",
      details: error.message,
    });
  }

  return data as StoredPremiumRecord | null;
}

export async function upsertPremiumRecord(
  supabase: SupabaseClient,
  record: Partial<StoredPremiumRecord> & { user_id: string },
) {
  const payload = {
    entitlement_id: "premium",
    is_active: false,
    product_id: null,
    price_id: null,
    platform: "stripe",
    expires_at: null,
    will_renew: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    latest_purchase_at: null,
    raw_subscription: {},
    ...record,
  };

  const { data, error } = await supabase
    .from("subscription_entitlements")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(500, "Unable to save premium state", {
      error: "premium_upsert_failed",
      details: error.message,
    });
  }

  return data as StoredPremiumRecord;
}

export async function searchStripeCustomerByUserId(userId: string) {
  const query = `metadata['supabase_user_id']:'${userId}'`;
  const result = await stripeRequest<{ data?: Array<any> }>("/customers/search", {
    query: { query, limit: 1 },
  }).catch(() => ({ data: [] }));

  return result.data?.[0] ?? null;
}

export async function listStripeCustomersByEmail(email: string) {
  const result = await stripeRequest<{ data?: Array<any> }>("/customers", {
    query: { email, limit: 10 },
  });

  return result.data ?? [];
}

export async function retrieveStripeCustomer(customerId: string) {
  return await stripeRequest<any>(`/customers/${customerId}`);
}

export async function createStripeCustomer(user: User) {
  return await stripeRequest<any>("/customers", {
    method: "POST",
    body: formEncode({
      email: user.email ?? undefined,
      "metadata[supabase_user_id]": user.id,
    }),
  });
}

export async function ensureStripeCustomerForUser(
  supabase: SupabaseClient,
  user: User,
) {
  const stored = await getStoredPremiumRecord(supabase, user.id);
  if (stored?.stripe_customer_id) {
    return stored.stripe_customer_id;
  }

  let customer = await searchStripeCustomerByUserId(user.id);

  if (!customer && user.email) {
    const matchingCustomer = (await listStripeCustomersByEmail(user.email)).find(
      (entry) => entry?.metadata?.supabase_user_id === user.id,
    );
    customer = matchingCustomer ?? null;
  }

  if (!customer) {
    customer = await createStripeCustomer(user);
  }

  await upsertPremiumRecord(supabase, {
    user_id: user.id,
    stripe_customer_id: customer.id,
  });

  return customer.id as string;
}

export async function listStripeSubscriptions(customerId: string) {
  const result = await stripeRequest<{ data?: Array<any> }>("/subscriptions", {
    query: {
      customer: customerId,
      status: "all",
      limit: 10,
    },
  });

  return result.data ?? [];
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return await stripeRequest<any>(`/subscriptions/${subscriptionId}`);
}

function selectRelevantSubscription(subscriptions: any[]) {
  const rankedStatuses = ["active", "trialing", "past_due", "unpaid", "canceled", "incomplete"];

  const sorted = [...subscriptions].sort((left, right) => {
    const leftRank = rankedStatuses.indexOf(left?.status ?? "");
    const rightRank = rankedStatuses.indexOf(right?.status ?? "");

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return Number(right?.created ?? 0) - Number(left?.created ?? 0);
  });

  return sorted[0] ?? null;
}

function isActiveStripeStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing" || status === "past_due";
}

export function serializePremiumState(record: StoredPremiumRecord | null, scansUsedThisMonth = 0) {
  return {
    isPremium: Boolean(record?.is_active),
    entitlementId: record?.entitlement_id === "premium" ? "premium" : null,
    productId: record?.product_id ?? null,
    priceId: record?.price_id ?? null,
    platform: record?.platform ?? null,
    expiresAt: record?.expires_at ?? null,
    willRenew: typeof record?.will_renew === "boolean" ? record.will_renew : null,
    scansUsedThisMonth,
    scansLimitThisMonth: record?.is_active ? null : 5,
  };
}

export async function syncPremiumRecordForUser(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">,
) {
  const stored = await getStoredPremiumRecord(supabase, user.id);
  let customerId = stored?.stripe_customer_id ?? null;

  if (!customerId) {
    const searched = await searchStripeCustomerByUserId(user.id);
    if (searched?.id) {
      customerId = searched.id;
    } else if (user.email) {
      const matchingCustomer = (await listStripeCustomersByEmail(user.email)).find(
        (entry) => entry?.metadata?.supabase_user_id === user.id,
      );
      customerId = matchingCustomer?.id ?? null;
    }
  }

  if (!customerId) {
    if (!stored) {
      return await upsertPremiumRecord(supabase, {
        user_id: user.id,
        platform: "stripe",
      });
    }

    return stored;
  }

  const customer = await retrieveStripeCustomer(customerId);
  const subscriptions = await listStripeSubscriptions(customerId);
  const subscription = selectRelevantSubscription(subscriptions);
  const priceId = subscription?.items?.data?.[0]?.price?.id ?? null;
  const expiresAt =
    typeof subscription?.current_period_end === "number"
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
  const latestPurchaseAt =
    typeof subscription?.created === "number"
      ? new Date(subscription.created * 1000).toISOString()
      : null;
  const isActive = isActiveStripeStatus(subscription?.status ?? null);

  return await upsertPremiumRecord(supabase, {
    user_id: user.id,
    entitlement_id: "premium",
    is_active: isActive,
    product_id: mapPriceIdToProductId(priceId),
    price_id: priceId,
    platform: "stripe",
    expires_at: expiresAt,
    will_renew: isActive ? !Boolean(subscription?.cancel_at_period_end) : false,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription?.id ?? null,
    latest_purchase_at: latestPurchaseAt,
    raw_subscription: {
      customer,
      subscription,
    },
  });
}
