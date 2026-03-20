-- Auto-confirm email users so signup does not require manual confirmation links.
-- This is intended for the Blue Balance app auth flow.

CREATE OR REPLACE FUNCTION public.auto_confirm_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_confirm_auth_user_trigger ON auth.users;

CREATE TRIGGER auto_confirm_auth_user_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_auth_user();

-- Backfill existing unconfirmed users.
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;
