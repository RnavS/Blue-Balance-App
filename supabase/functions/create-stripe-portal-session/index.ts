import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError } from "../_shared/http.ts";
import { createServiceClient, requireAuthenticatedUser } from "../_shared/supabase.ts";
import { ensureStripeCustomerForUser } from "../_shared/stripe.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed", { error: "method_not_allowed" });
    }

    const { user } = await requireAuthenticatedUser(req);
    const { returnUrl } = await req.json();

    if (!returnUrl) {
      throw new HttpError(400, "Missing portal return URL", { error: "invalid_return_url" });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new HttpError(500, "STRIPE_SECRET_KEY is not configured", { error: "stripe_not_configured" });
    }

    const serviceSupabase = createServiceClient();
    const customerId = await ensureStripeCustomerForUser(serviceSupabase, user);
    const params = new URLSearchParams();

    params.set("customer", customerId);
    params.set("return_url", String(returnUrl));

    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok || !data?.url) {
      throw new HttpError(502, "Unable to create Stripe portal session", {
        error: "stripe_portal_failed",
        stripe: data,
      });
    }

    return jsonResponse({ url: data.url });
  } catch (error) {
    console.error("create-stripe-portal-session error:", error);
    return errorResponse(error);
  }
});
