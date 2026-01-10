-- ============================================
-- MIG_009: Fix Profile Emails & Add Avatar
-- ============================================
-- Purpose: Sync missing emails and add avatar support
-- ============================================

-- 1. Add avatar_type column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'avatar_type') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_type TEXT DEFAULT 'default';
    END IF;
END $$;

-- 2. Sync emails from auth.users to profiles (for existing users with missing emails)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 3. Sync display_name from auth.users metadata if null
UPDATE public.profiles p
SET display_name = COALESCE(
    u.raw_user_meta_data->>'full_name', 
    split_part(u.email, '@', 1)
)
FROM auth.users u
WHERE p.id = u.id AND (p.display_name IS NULL OR p.display_name = '');

-- 4. Ensure your super admin profile is complete
UPDATE public.profiles 
SET 
    is_super_admin = true,
    display_name = COALESCE(display_name, 'Jorge')
WHERE email = 'mp.jorge00@gmail.com';

-- 5. Backfill any missing profiles (users in auth.users not in profiles)
INSERT INTO public.profiles (id, email, display_name, avatar_type)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    'default'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================
-- SELECT id, email, display_name, avatar_type, is_super_admin FROM public.profiles;
