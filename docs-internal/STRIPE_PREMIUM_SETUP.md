# Blue Balance Stripe Premium Setup

## 1. Create Stripe products and prices

In Stripe Dashboard:

- Create product `Blue Balance Premium Monthly`
- Create a recurring monthly price and copy its `price_...` ID
- Create product `Blue Balance Premium Annual`
- Create a recurring yearly price and copy its `price_...` ID

## 2. Add Stripe secrets for Supabase functions

Update `supabase/functions/.env` with:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_...
GO_UPC_API_KEY=...
```

## 3. Apply the billing migration

Run:

```bash
supabase db push
```

This creates:

- `subscription_entitlements`
- `usage_counters`
- `billing_events`

## 4. Deploy the Stripe functions

Run:

```bash
supabase functions deploy create-stripe-checkout-session
supabase functions deploy create-stripe-portal-session
supabase functions deploy sync-premium-status
supabase functions deploy stripe-webhook
supabase functions deploy barcode-lookup
supabase functions deploy ai-coach
```

## 5. Configure the Stripe webhook

In Stripe Dashboard:

- Go to `Developers` > `Webhooks`
- Add endpoint:
  - `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
- Subscribe to:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- Copy the webhook signing secret `whsec_...`
- Paste it into `STRIPE_WEBHOOK_SECRET`

## 6. Test the Premium rules

- Free users can manually log drinks
- Free users get 5 successful barcode lookups per month
- Free users cannot use AI coach
- Premium users can use unlimited barcode lookups
- Premium users can use AI coach
- `Manage subscription` opens Stripe Customer Portal
- Webhook updates premium status after purchase, renewal, cancellation, and expiration

## 7. App Store policy note

As of March 31, 2026, Stripe external purchase flows for digital subscriptions on iOS are a policy-sensitive area.
Review Apple's latest digital-goods rules before shipping this build through the App Store.
