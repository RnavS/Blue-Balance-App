import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/http.ts";
import { createServiceClient, requireAuthenticatedUser } from "../_shared/supabase.ts";
import { serializePremiumState, syncPremiumRecordForUser } from "../_shared/stripe.ts";
import { BARCODE_LOOKUP_FEATURE_KEY, getCurrentUsagePeriodKey, getUsageCounter } from "../_shared/usage.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user } = await requireAuthenticatedUser(req);
    const serviceSupabase = createServiceClient();
    const premiumRecord = await syncPremiumRecordForUser(serviceSupabase, user);
    const scansUsedThisMonth = await getUsageCounter(
      serviceSupabase,
      user.id,
      BARCODE_LOOKUP_FEATURE_KEY,
      getCurrentUsagePeriodKey(),
    );

    return jsonResponse(serializePremiumState(premiumRecord, scansUsedThisMonth));
  } catch (error) {
    console.error("sync-premium-status error:", error);
    return errorResponse(error);
  }
});
