-- Add richer metadata to water logs so UI can show:
-- - raw consumed amount (before hydration factor)
-- - grouped category percentages (e.g. latte variants)
-- - scan source/barcode details for drill-down views

ALTER TABLE public.water_logs
ADD COLUMN IF NOT EXISTS raw_amount numeric,
ADD COLUMN IF NOT EXISTS hydration_factor numeric NOT NULL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS barcode text,
ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.water_logs
SET
  raw_amount = COALESCE(raw_amount, amount),
  hydration_factor = COALESCE(hydration_factor, 1.0),
  category = COALESCE(category, trim(lower(drink_type))),
  source = COALESCE(source, 'manual'),
  details = COALESCE(details, '{}'::jsonb)
WHERE
  raw_amount IS NULL
  OR hydration_factor IS NULL
  OR category IS NULL
  OR source IS NULL
  OR details IS NULL;

CREATE INDEX IF NOT EXISTS water_logs_profile_logged_idx
ON public.water_logs (profile_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS water_logs_profile_category_idx
ON public.water_logs (profile_id, category);
