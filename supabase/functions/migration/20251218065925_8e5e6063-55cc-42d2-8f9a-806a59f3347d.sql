-- Add first_name and last_name columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS interval_length integer NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS gradient_preset text;

-- Create custom beverages table
CREATE TABLE IF NOT EXISTS public.beverages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  serving_size numeric NOT NULL DEFAULT 8,
  hydration_factor numeric NOT NULL DEFAULT 1.0,
  icon text DEFAULT 'droplet',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on beverages
ALTER TABLE public.beverages ENABLE ROW LEVEL SECURITY;

-- RLS policies for beverages
CREATE POLICY "Users can view their own beverages"
ON public.beverages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = beverages.profile_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users can create their own beverages"
ON public.beverages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = beverages.profile_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users can update their own beverages"
ON public.beverages FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = beverages.profile_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own beverages"
ON public.beverages FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = beverages.profile_id
  AND profiles.user_id = auth.uid()
));

-- Create scanned beverages table for barcode history
CREATE TABLE IF NOT EXISTS public.scanned_beverages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  name text NOT NULL,
  serving_size numeric NOT NULL,
  hydration_factor numeric NOT NULL DEFAULT 1.0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on scanned_beverages
ALTER TABLE public.scanned_beverages ENABLE ROW LEVEL SECURITY;

-- RLS policies for scanned_beverages
CREATE POLICY "Users can view their own scanned beverages"
ON public.scanned_beverages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = scanned_beverages.profile_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users can create their own scanned beverages"
ON public.scanned_beverages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = scanned_beverages.profile_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own scanned beverages"
ON public.scanned_beverages FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = scanned_beverages.profile_id
  AND profiles.user_id = auth.uid()
));

-- Create AI chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_messages
CREATE POLICY "Users can view their own chat messages"
ON public.chat_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = chat_messages.profile_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users can create their own chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = chat_messages.profile_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own chat messages"
ON public.chat_messages FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = chat_messages.profile_id
  AND profiles.user_id = auth.uid()
));

-- Update water_logs to support decimal amounts
ALTER TABLE public.water_logs 
ALTER COLUMN amount TYPE numeric USING amount::numeric;