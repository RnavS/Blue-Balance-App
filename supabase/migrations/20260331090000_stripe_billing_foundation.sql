CREATE TABLE IF NOT EXISTS public.subscription_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  entitlement_id text NOT NULL DEFAULT 'premium',
  is_active boolean NOT NULL DEFAULT false,
  product_id text,
  price_id text,
  platform text CHECK (platform IN ('stripe')),
  expires_at timestamp with time zone,
  will_renew boolean,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  latest_purchase_at timestamp with time zone,
  raw_subscription jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  period_key text NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usage_counters_user_feature_period_unique UNIQUE (user_id, feature_key, period_key)
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id text PRIMARY KEY,
  source text NOT NULL,
  customer_id text,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription entitlements"
ON public.subscription_entitlements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage counters"
ON public.usage_counters FOR SELECT
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_usage_counter(
  p_user_id uuid,
  p_feature_key text,
  p_period_key text
)
RETURNS public.usage_counters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counter public.usage_counters;
BEGIN
  INSERT INTO public.usage_counters (user_id, feature_key, period_key, count)
  VALUES (p_user_id, p_feature_key, p_period_key, 1)
  ON CONFLICT (user_id, feature_key, period_key)
  DO UPDATE
    SET
      count = public.usage_counters.count + 1,
      updated_at = now()
  RETURNING * INTO v_counter;

  RETURN v_counter;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage_counter(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_usage_counter(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.increment_usage_counter(uuid, text, text) FROM authenticated;

DROP TRIGGER IF EXISTS update_subscription_entitlements_updated_at ON public.subscription_entitlements;
CREATE TRIGGER update_subscription_entitlements_updated_at
BEFORE UPDATE ON public.subscription_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_counters_updated_at ON public.usage_counters;
CREATE TRIGGER update_usage_counters_updated_at
BEFORE UPDATE ON public.usage_counters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS subscription_entitlements_customer_idx
ON public.subscription_entitlements (stripe_customer_id);
