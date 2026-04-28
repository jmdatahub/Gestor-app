-- ============================================
-- FIX_008: Sync Profile Emails and Fix Trigger
-- ============================================
-- Purpose: Fix missing emails in profiles table and ensure
--          the handle_new_user trigger works correctly
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. First, update the trigger to properly sync emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, is_suspended, is_super_admin)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        false,
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Sync ALL existing users - update emails for all profiles
UPDATE public.profiles p
SET 
    email = u.email,
    display_name = COALESCE(
        NULLIF(p.display_name, ''), 
        u.raw_user_meta_data->>'full_name', 
        split_part(u.email, '@', 1)
    )
FROM auth.users u
WHERE p.id = u.id;

-- 4. Create profiles for any auth.users that don't have profiles
INSERT INTO public.profiles (id, email, display_name, is_suspended, is_super_admin)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    false,
    false
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 5. Ensure mp.jorge00@gmail.com is super admin
UPDATE public.profiles 
SET is_super_admin = true 
WHERE email = 'mp.jorge00@gmail.com';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
    p.id, 
    p.email, 
    p.display_name, 
    p.is_super_admin,
    CASE WHEN u.id IS NOT NULL THEN '✅ Linked' ELSE '❌ Orphan' END as auth_status
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;

-- Done! Profile emails synced and trigger updated.
