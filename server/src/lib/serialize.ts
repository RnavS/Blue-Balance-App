import type {
  beverages,
  chatMessages,
  profiles,
  scannedBeverages,
  waterLogs,
} from '../db/schema.js';

// The React Native app reads snake_case fields everywhere (currentProfile.daily_goal,
// log.raw_amount, ...) because that is what PostgREST returned. Serializing to
// snake_case here kept the entire UI layer unchanged during the migration off
// Supabase — only the transport was replaced.
//
// Postgres `numeric` comes back from node-postgres as a string, so every numeric
// column is coerced to a JS number to match what the app used to receive.

type ProfileRow = typeof profiles.$inferSelect;
type WaterLogRow = typeof waterLogs.$inferSelect;
type BeverageRow = typeof beverages.$inferSelect;
type ScannedBeverageRow = typeof scannedBeverages.$inferSelect;
type ChatMessageRow = typeof chatMessages.$inferSelect;

function num(value: string | number | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function serializeProfile(row: ProfileRow) {
  return {
    id: row.id,
    user_id: row.userId,
    username: row.username,
    first_name: row.firstName,
    last_name: row.lastName,
    age: row.age,
    height: row.height,
    weight: row.weight,
    unit_preference: row.unitPreference,
    wake_time: row.wakeTime,
    sleep_time: row.sleepTime,
    activity_level: row.activityLevel,
    daily_goal: row.dailyGoal,
    interval_length: row.intervalLength,
    theme: row.theme,
    custom_accent_color: row.customAccentColor,
    gradient_preset: row.gradientPreset,
    reminders_enabled: row.remindersEnabled,
    reminder_interval: row.reminderInterval,
    quiet_hours_start: row.quietHoursStart,
    quiet_hours_end: row.quietHoursEnd,
    sound_enabled: row.soundEnabled,
    vibration_enabled: row.vibrationEnabled,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function serializeWaterLog(row: WaterLogRow) {
  const amount = num(row.amount, 0);
  return {
    id: row.id,
    profile_id: row.profileId,
    amount,
    raw_amount: num(row.rawAmount, amount),
    hydration_factor: num(row.hydrationFactor, 1),
    drink_type: row.drinkType,
    category: row.category,
    source: row.source,
    barcode: row.barcode,
    details: row.details ?? {},
    logged_at: row.loggedAt.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

export function serializeBeverage(row: BeverageRow) {
  return {
    id: row.id,
    profile_id: row.profileId,
    name: row.name,
    serving_size: num(row.servingSize, 8),
    hydration_factor: num(row.hydrationFactor, 1),
    icon: row.icon,
    is_default: row.isDefault,
    created_at: row.createdAt.toISOString(),
  };
}

export function serializeScannedBeverage(row: ScannedBeverageRow) {
  return {
    id: row.id,
    profile_id: row.profileId,
    barcode: row.barcode,
    name: row.name,
    serving_size: num(row.servingSize, 0),
    hydration_factor: num(row.hydrationFactor, 1),
    created_at: row.createdAt.toISOString(),
  };
}

export function serializeChatMessage(row: ChatMessageRow) {
  return {
    id: row.id,
    profile_id: row.profileId,
    role: row.role,
    content: row.content,
    created_at: row.createdAt.toISOString(),
  };
}
