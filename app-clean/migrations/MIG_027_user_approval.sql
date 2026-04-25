-- ============================================
-- MIG_027: User Approval System
-- ============================================
-- Purpose: Admin must approve new user registrations
-- New users start with is_approved = false
-- Existing users are auto-approved (backfill)
-- ============================================

-- 1. Add is_approved column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false NOT NULL;

-- 2. Backfill: existing users are considered approved
UPDATE public.profiles SET is_approved = true;

-- 3. Super admin is always approved
UPDATE public.profiles SET is_approved = true WHERE is_super_admin = true;

-- 4. Update handle_new_user trigger to set is_approved = false for new users
--    (DEFAULT false already handles this, but we make it explicit)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, is_approved)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Check column exists:
-- SELECT id, email, is_approved FROM public.profiles LIMIT 5;
-- Check pending users:
-- SELECT id, email, is_approved FROM public.profiles WHERE is_approved = false;
