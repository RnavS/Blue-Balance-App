import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  getStoredPremiumRecordByCustomerId,
  retrieveStripeCustomer,
  retrieveStripeSubscription,
  syncPremiumRecordForUser,
} from "../_shared/stripe.ts";

const encoder = new TextEncoder();

function parseStripeSignature(header: string) {
  const parts = header.split(",").map((entry) => entry.trim());
  const timestamp = parts.find((entry) => entry.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((entry) => entry.startsWith("v1="))
    .map((entry) => entry.slice(3));

  if (!timestamp || !signatures.length) {
    throw new HttpError(400, "Invalid Stripe signature header", { error: "invalid_signature" });
  }

  return {
    timestamp: Number(timestamp),
    signatures,
  };
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string) {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);

  if (ageSeconds > 300) {
    throw new HttpError(400, "Stripe webhook timestamp is too old", { error: "signature_expired" });
  }

  const payload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expected = toHex(signature);

  if (!signatures.includes(expected)) {
    throw new HttpError(400, "Stripe webhook signature check failed", { error: "invalid_signature" });
  }
}

function extractCustomerId(object: any) {
  if (typeof object?.customer === "string") return object.customer;
  if (typeof object?.id === "string" && object.id.startsWith("cus_")) return object.id;
  return null;
}

async function resolveUserId(serviceSupabase: ReturnType<typeof createServiceClient>, object: any) {
  if (typeof object?.metadata?.supabase_user_id === "string") {
    return object.metadata.supabase_user_id;
  }

  if (typeof object?.client_reference_id === "string") {
    return object.client_reference_id;
  }

  const customerId = extractCustomerId(object);
  if (customerId) {
    const stored = await getStoredPremiumRecordByCustomerId(serviceSupabase, customerId);
    if (stored?.user_id) {
      return stored.user_id;
    }

    const customer = await retrieveStripeCustomer(customerId).catch(() => null);
    if (typeof customer?.metadata?.supabase_user_id === "string") {
      return customer.metadata.supabase_user_id;
    }
  }

  if (typeof object?.subscription === "string") {
    const subscription = await retrieveStripeSubscription(object.subscription).catch(() => null);
    if (typeof subscription?.metadata?.supabase_user_id === "string") {
      return subscription.metadata.supabase_user_id;
    }

    const subscriptionCustomerId =
      typeof subscription?.customer === "string" ? subscription.customer : null;
    if (subscriptionCustomerId) {
      const stored = await getStoredPremiumRecordByCustomerId(serviceSupabase, subscriptionCustomerId);
      if (stored?.user_id) {
        return stored.user_id;
      }

      const customer = await retrieveStripeCustomer(subscriptionCustomerId).catch(() => null);
      if (typeof customer?.metadata?.supabase_user_id === "string") {
        return customer.metadata.supabase_user_id;
      }
    }
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

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new HttpError(401, "Missing Stripe signature header", { error: "missing_signature" });
    }

    const rawBody = await req.text();
    await verifyStripeSignature(rawBody, signature);

    const event = JSON.parse(rawBody);
    const serviceSupabase = createServiceClient();

    const { error: eventInsertError } = await serviceSupabase
      .from("billing_events")
      .insert({
        id: String(event.id ?? crypto.randomUUID()),
        source: "stripe",
        customer_id: extractCustomerId(event?.data?.object),
        event_type: String(event?.type ?? "unknown"),
        payload: event,
      });

    if (eventInsertError && eventInsertError.code !== "23505") {
      throw new HttpError(500, "Unable to record billing event", {
        error: "billing_event_failed",
        details: eventInsertError.message,
      });
    }

    if (eventInsertError?.code === "23505") {
      return jsonResponse({ received: true, duplicate: true });
    }

    const object = event?.data?.object ?? {};
    const userId = await resolveUserId(serviceSupabase, object);
    if (userId) {
      await syncPremiumRecordForUser(serviceSupabase, {
        id: userId,
        email: typeof object?.customer_email === "string" ? object.customer_email : undefined,
      });
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("stripe-webhook error:", error);
    return errorResponse(error);
  }
});
