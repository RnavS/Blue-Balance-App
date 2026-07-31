import { Hono } from 'hono';
import type { AppEnv } from '../auth/middleware.js';
import { config } from '../config.js';
import { lookupBarcode } from '../lib/barcode.js';
import { hasPremiumAccess } from '../lib/entitlement.js';
import { HttpError, badRequest } from '../lib/errors.js';
import {
  ensureStripeCustomerForUser,
  formEncode,
  getPriceId,
  serializePremiumState,
  stripeRequest,
  syncPremiumRecordForUser,
} from '../lib/stripe.js';
import {
  BARCODE_LOOKUP_FEATURE_KEY,
  FREE_SCAN_LIMIT,
  getCurrentUsagePeriodKey,
  getUsageCounter,
  incrementUsageCounter,
} from '../lib/usage.js';

export const functionRoutes = new Hono<AppEnv>();

/** Replaces the sync-premium-status edge function. */
functionRoutes.post('/sync-premium-status', async (c) => {
  const user = c.get('user');
  const record = await syncPremiumRecordForUser(user);
  const scansUsedThisMonth = await getUsageCounter(
    user.id,
    BARCODE_LOOKUP_FEATURE_KEY,
    getCurrentUsagePeriodKey(),
  );

  return c.json(serializePremiumState(record, scansUsedThisMonth));
});

/** Replaces the barcode-lookup edge function. */
functionRoutes.post('/barcode-lookup', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const barcode = String(body?.barcode ?? '').trim();
  const unit = body?.unit === 'ml' ? 'ml' : 'oz';

  if (!barcode) throw badRequest('Barcode is required');

  const record = await syncPremiumRecordForUser(user);
  const periodKey = getCurrentUsagePeriodKey();
  const scansUsedThisMonth = await getUsageCounter(
    user.id,
    BARCODE_LOOKUP_FEATURE_KEY,
    periodKey,
  );
  const entitled = hasPremiumAccess(record.isActive, body?.platform);

  if (!entitled && scansUsedThisMonth >= FREE_SCAN_LIMIT) {
    return c.json(
      {
        ...serializePremiumState(record, scansUsedThisMonth),
        message: 'Upgrade to Premium for unlimited barcode scans.',
        error: 'scan_limit_reached',
      },
      402,
    );
  }

  const result = await lookupBarcode(barcode, unit);
  let nextCount = scansUsedThisMonth;

  if (!entitled && result) {
    nextCount = await incrementUsageCounter(user.id, BARCODE_LOOKUP_FEATURE_KEY, periodKey);
  }

  return c.json({
    result,
    scansUsedThisMonth: nextCount,
    scansLimitThisMonth: entitled ? null : FREE_SCAN_LIMIT,
  });
});

/** Replaces the ai-coach edge function. */
functionRoutes.post('/ai-coach', async (c) => {
  const user = c.get('user');
  const record = await syncPremiumRecordForUser(user);
  const body = await c.req.json().catch(() => ({}));

  if (!hasPremiumAccess(record.isActive, body?.platform)) {
    return c.json(
      {
        response: 'Blue AI Coach is part of Premium. Upgrade in Settings to unlock it.',
        error: 'premium_required',
      },
      402,
    );
  }

  const message = String(body?.message ?? '').trim();
  if (!message) throw badRequest('Message is required');

  if (!config.aiApiKey) {
    throw new HttpError(500, 'AI_API_KEY is not configured', { error: 'ai_not_configured' });
  }

  const systemPrompt = `You are Blue, the Blue Balance hydration assistant.

CRITICAL FORMATTING RULES:
- Write in plain text only. NO asterisks, NO bold markers (**), NO markdown formatting.
- Use simple dashes (-) for bullet points if needed.
- Keep responses conversational and natural.
- Do NOT use headers or special formatting.

YOUR ROLE:
1. Answer questions about hydration using the user's actual data.
2. Make app changes when requested (include action JSON at end).
3. Proactively propose realistic daily hydration plans.

RESPONSE GUIDELINES:
- Be specific and use numbers from the user's data.
- Keep responses short (2-4 sentences for simple questions).
- Be encouraging but not overly enthusiastic.
- If user asks to change a setting, confirm what you changed.

APP ACTIONS (add this JSON at the END of your response when user requests changes):
- Goal change: {"action":{"type":"update_goal","params":{"daily_goal":100}}}
- Add beverage: {"action":{"type":"add_water","params":{"amount":8,"drink_type":"Water"}}}
- Schedule: {"action":{"type":"update_schedule","params":{"wake_time":"06:00","sleep_time":"22:00"}}}
- Interval: {"action":{"type":"update_interval","params":{"interval_length":45}}}
- Reminders: {"action":{"type":"update_reminders","params":{"reminders_enabled":true,"reminder_interval":30}}}
- Theme: {"action":{"type":"update_theme","params":{"theme":"ocean"}}}
- Unit preference: {"action":{"type":"update_unit","params":{"unit_preference":"ml"}}}
- Create beverage: {"action":{"type":"create_beverage","params":{"name":"Electrolyte Drink","serving_size":16.9,"hydration_factor":0.95}}}
- Undo latest log: {"action":{"type":"undo_last_log","params":{}}}
- Generic profile update: {"action":{"type":"update_profile","params":{"vibration_enabled":false}}}

Available themes: midnight, ocean, mint, sunset, graphite

Current User Context:
${body?.context ?? ''}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(Array.isArray(body?.history) ? body.history : []),
    { role: 'user', content: message },
  ];

  // ---------------------------------------------------------------------------
  // This is the only place the AI provider is called.
  //
  // Any endpoint exposing OpenAI-compatible /chat/completions works by setting
  // AI_BASE_URL — no code change. If your model expects a different request or
  // response shape, this fetch and the two lines reading `choices[0].message`
  // below are the only things to rewrite.
  // ---------------------------------------------------------------------------
  const endpoint = `${config.aiBaseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.aiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.aiModel, messages, temperature: 0.7 }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`AI request to ${endpoint} failed:`, response.status, detail);
    throw new HttpError(502, 'The coach is unavailable right now.', { error: 'ai_request_failed' });
  }

  const data: any = await response.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? '';

  // The model appends an action as trailing JSON; split it off before display.
  let action: unknown = null;
  let text = raw;
  const match = raw.match(/\{\s*"action"\s*:[\s\S]*\}\s*$/);

  if (match) {
    try {
      action = JSON.parse(match[0])?.action ?? null;
      text = raw.slice(0, match.index).trim();
    } catch {
      action = null;
    }
  }

  return c.json({ response: text || raw, action });
});

/** Replaces the create-stripe-checkout-session edge function. */
functionRoutes.post('/create-stripe-checkout-session', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const priceId = getPriceId(String(body?.packageType ?? ''));
  if (!priceId) throw new HttpError(400, 'Unknown premium package', { error: 'invalid_package' });

  const { successUrl, cancelUrl } = body ?? {};
  if (!successUrl || !cancelUrl) {
    throw new HttpError(400, 'Missing checkout return URLs', { error: 'invalid_return_urls' });
  }

  const customerId = await ensureStripeCustomerForUser(user);

  const session = await stripeRequest<{ url?: string }>('/checkout/sessions', {
    method: 'POST',
    body: formEncode({
      mode: 'subscription',
      customer: customerId,
      success_url: String(successUrl),
      cancel_url: String(cancelUrl),
      allow_promotion_codes: 'true',
      client_reference_id: user.id,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'metadata[app_user_id]': user.id,
      'metadata[platform]': String(body?.platform ?? 'stripe'),
      'subscription_data[metadata][app_user_id]': user.id,
    }),
  });

  return c.json({ url: session.url });
});

/** Replaces the create-stripe-portal-session edge function. */
functionRoutes.post('/create-stripe-portal-session', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const returnUrl = body?.returnUrl;
  if (!returnUrl) throw new HttpError(400, 'Missing return URL', { error: 'invalid_return_urls' });

  const customerId = await ensureStripeCustomerForUser(user);

  const session = await stripeRequest<{ url?: string }>('/billing_portal/sessions', {
    method: 'POST',
    body: formEncode({ customer: customerId, return_url: String(returnUrl) }),
  });

  return c.json({ url: session.url });
});
