import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError } from "../_shared/http.ts";
import { createServiceClient, requireAuthenticatedUser } from "../_shared/supabase.ts";
import { ensureStripeCustomerForUser } from "../_shared/stripe.ts";

function getPriceId(packageType: string) {
  if (packageType === "monthly") {
    return Deno.env.get("STRIPE_PREMIUM_MONTHLY_PRICE_ID");
  }

  if (packageType === "annual") {
    return Deno.env.get("STRIPE_PREMIUM_ANNUAL_PRICE_ID");
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed", { error: "method_not_allowed" });
    }

    const { user } = await requireAuthenticatedUser(req);
    const { packageType, platform, successUrl, cancelUrl } = await req.json();
    const priceId = getPriceId(String(packageType ?? ""));

    if (!priceId) {
      throw new HttpError(400, "Unknown premium package", { error: "invalid_package" });
    }

    if (!successUrl || !cancelUrl) {
      throw new HttpError(400, "Missing checkout return URLs", { error: "invalid_return_urls" });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new HttpError(500, "STRIPE_SECRET_KEY is not configured", { error: "stripe_not_configured" });
    }

    const serviceSupabase = createServiceClient();
    const customerId = await ensureStripeCustomerForUser(serviceSupabase, user);
    const params = new URLSearchParams();

    params.set("mode", "subscription");
    params.set("customer", customerId);
    params.set("success_url", String(successUrl));
    params.set("cancel_url", String(cancelUrl));
    params.set("allow_promotion_codes", "true");
    params.set("client_reference_id", user.id);
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[supabase_user_id]", user.id);
    params.set("metadata[platform]", String(platform ?? "stripe"));
    params.set("subscription_data[metadata][supabase_user_id]", user.id);
    params.set("subscription_data[metadata][platform]", String(platform ?? "stripe"));

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok || !data?.url) {
      throw new HttpError(502, "Unable to create Stripe Checkout session", {
        error: "stripe_checkout_failed",
        stripe: data,
      });
    }

    return jsonResponse({ url: data.url });
  } catch (error) {
    console.error("create-stripe-checkout-session error:", error);
    return errorResponse(error);
  }
});
