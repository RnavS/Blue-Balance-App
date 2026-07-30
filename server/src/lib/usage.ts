import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usageCounters } from '../db/schema.js';

export const FREE_SCAN_LIMIT = 5;
export const BARCODE_LOOKUP_FEATURE_KEY = 'barcode_lookup';

export function getCurrentUsagePeriodKey() {
  return new Date().toISOString().slice(0, 7);
}

export async function getUsageCounter(
  userId: string,
  featureKey: string,
  periodKey: string,
): Promise<number> {
  const [row] = await db
    .select({ count: usageCounters.count })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.featureKey, featureKey),
        eq(usageCounters.periodKey, periodKey),
      ),
    )
    .limit(1);

  return row?.count ?? 0;
}

/**
 * Replaces the `increment_usage_counter` plpgsql function. The upsert is atomic,
 * so concurrent scans cannot both read the same count and overwrite each other.
 */
export async function incrementUsageCounter(
  userId: string,
  featureKey: string,
  periodKey: string,
): Promise<number> {
  const [row] = await db
    .insert(usageCounters)
    .values({ userId, featureKey, periodKey, count: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.featureKey, usageCounters.periodKey],
      set: {
        count: sql`${usageCounters.count} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: usageCounters.count });

  return row?.count ?? 0;
}
