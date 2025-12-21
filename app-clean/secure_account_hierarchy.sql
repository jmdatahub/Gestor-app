-- Function to validate that the parent account belongs to the same user
CREATE OR REPLACE FUNCTION public.validate_account_parent_same_user()
RETURNS TRIGGER AS $$
DECLARE
  parent_user_id UUID;
BEGIN
  -- If no parent, validation passes
  IF NEW.parent_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prevent self-reference
  IF NEW.parent_account_id = NEW.id THEN
    RAISE EXCEPTION 'Una cuenta no puede ser su propia cuenta padre.';
  END IF;

  -- Get the user_id of the parent account
  SELECT user_id INTO parent_user_id
  FROM public.accounts
  WHERE id = NEW.parent_account_id;

  -- If parent account doesn't exist (should be caught by FK, but good as backup)
  IF parent_user_id IS NULL THEN
     RAISE EXCEPTION 'La cuenta padre especificada no existe.';
  END IF;

  -- Validation: Parent must belong to the same user
  IF parent_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'La cuenta padre debe pertenecer al mismo usuario.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute the validation before INSERT or UPDATE
DROP TRIGGER IF EXISTS check_account_parent_ownership ON public.accounts;

CREATE TRIGGER check_account_parent_ownership
BEFORE INSERT OR UPDATE OF parent_account_id, user_id
ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.validate_account_parent_same_user();

-- Comment:
-- Execute this script in your Supabase SQL Editor to enforce account hierarchy security.
