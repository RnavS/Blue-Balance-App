import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError } from "../_shared/http.ts";
import { createServiceClient, requireAuthenticatedUser } from "../_shared/supabase.ts";
import {
  cancelStripeSubscription,
  deleteStripeCustomer,
  getStoredPremiumRecord,
  listStripeSubscriptions,
} from "../_shared/stripe.ts";

// Required by App Store Review Guideline 5.1.1(v): an app that supports account
// creation must let the user delete that account from inside the app.
//
// Every app table cascades from auth.users, so removing the auth user removes
// profiles, water_logs, beverages, scanned_beverages, chat_messages,
// subscription_entitlements and usage_counters along with it.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed", { error: "method_not_allowed" });
    }

    const { user } = await requireAuthenticatedUser(req);
    const serviceSupabase = createServiceClient();

    // Best effort: stop billing before the entitlement row disappears. A Stripe
    // outage must not leave the user unable to delete their account, so failures
    // here are reported back rather than thrown.
    const billingWarnings: string[] = [];
    const stored = await getStoredPremiumRecord(serviceSupabase, user.id).catch(() => null);
    const customerId = stored?.stripe_customer_id ?? null;

    if (customerId) {
      try {
        const subscriptions = await listStripeSubscriptions(customerId);
        for (const subscription of subscriptions) {
          if (subscription?.status === "canceled" || subscription?.status === "incomplete_expired") {
            continue;
          }
          await cancelStripeSubscription(subscription.id);
        }
        await deleteStripeCustomer(customerId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Stripe error";
        console.error("delete-account stripe cleanup failed:", message);
        billingWarnings.push(message);
      }
    }

    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw new HttpError(500, "Unable to delete account", {
        error: "account_delete_failed",
        details: deleteError.message,
      });
    }

    return jsonResponse({
      deleted: true,
      billingWarnings,
    });
  } catch (error) {
    console.error("delete-account error:", error);
    return errorResponse(error);
  }
});
