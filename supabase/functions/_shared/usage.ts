import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { HttpError } from "./http.ts";

export const FREE_SCAN_LIMIT = 5;
export const BARCODE_LOOKUP_FEATURE_KEY = "barcode_lookup";

export function getCurrentUsagePeriodKey() {
  return new Date().toISOString().slice(0, 7);
}

export async function getUsageCounter(
  supabase: SupabaseClient,
  userId: string,
  featureKey: string,
  periodKey: string,
) {
  const { data, error } = await supabase
    .from("usage_counters")
    .select("count")
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Unable to read usage counters", {
      error: "usage_lookup_failed",
      details: error.message,
    });
  }

  return Number(data?.count ?? 0);
}

export async function incrementUsageCounter(
  supabase: SupabaseClient,
  userId: string,
  featureKey: string,
  periodKey: string,
) {
  const { data, error } = await supabase.rpc("increment_usage_counter", {
    p_user_id: userId,
    p_feature_key: featureKey,
    p_period_key: periodKey,
  });

  if (error) {
    throw new HttpError(500, "Unable to update usage counters", {
      error: "usage_increment_failed",
      details: error.message,
    });
  }

  return Number(data?.count ?? 0);
}
