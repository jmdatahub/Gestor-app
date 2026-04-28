-- ==============================================================================
-- MIG_001_v2: HARDENED MULTI-WORKSPACE INFRASTRUCTURE (FIXED)
-- ==============================================================================
-- Description: Sets up the base tables for multi-tenancy with STRICT security.
--              - Client-side INSERT blocked for Orgs/Invites (RPC only).
--              - Strict 'can_create_orgs' check.
--              - Idempotent execution.
--              - FIXED: Reordered Tables vs Policies to avoid 42P01 error.
-- Date: 2026-01-05
-- ==============================================================================

BEGIN;

-- 0. PRE-REQUISITES (Extensions & Types)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ==============================================================================
-- SECTION A: CREATE TABLES (Structure First)
-- ==============================================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  can_create_orgs BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- 2. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT, 
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 3. ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role DEFAULT 'member' NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- 4. INVITATIONS
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role public.app_role DEFAULT 'member' NOT NULL,
  token UUID DEFAULT gen_random_uuid() NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);


-- ==============================================================================
-- SECTION B: ENABLE RLS & POLICIES (Logic Second)
-- ==============================================================================

-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING ( true );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING ( auth.uid() = id );

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT WITH CHECK ( auth.uid() = id );


-- 2. ORGANIZATIONS RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Note: Now this works because organization_members table ALREADY exists
DROP POLICY IF EXISTS "Orgs visible to members and owner" ON public.organizations;
CREATE POLICY "Orgs visible to members and owner" 
ON public.organizations FOR SELECT 
USING (
  auth.uid() = owner_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE org_id = organizations.id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can update organizations" ON public.organizations;
CREATE POLICY "Owners can update organizations" 
ON public.organizations FOR UPDATE 
USING ( auth.uid() = owner_id );
-- INSERT blocked (RPC only)


-- 3. MEMBERS RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see other members" ON public.organization_members;
CREATE POLICY "Members see other members" 
ON public.organization_members FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members as om
    WHERE om.org_id = organization_members.org_id 
    AND om.user_id = auth.uid()
  )
);
-- INSERT/UPDATE/DELETE blocked (RPC only)


-- 4. INVITATIONS RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view invitations" ON public.organization_invitations;
CREATE POLICY "Admins view invitations" 
ON public.organization_invitations FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE org_id = organization_invitations.org_id 
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);
-- INSERT blocked (RPC only)


-- ==============================================================================
-- SECTION C: FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 1. HANDLE NEW USER
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. CREATE ORGANIZATION
CREATE OR REPLACE FUNCTION public.create_organization(org_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  can_create BOOLEAN;
BEGIN
  -- Check permission
  SELECT can_create_orgs INTO can_create FROM public.profiles WHERE id = auth.uid();
  
  IF can_create IS NOT TRUE THEN
    RAISE EXCEPTION 'User not authorized to create organizations. Please verify your profile permissions.';
  END IF;

  -- Create Org
  INSERT INTO public.organizations (name, owner_id)
  VALUES (org_name, auth.uid())
  RETURNING id INTO new_org_id;

  -- Add Creator as Owner
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (new_org_id, auth.uid(), 'owner');

  RETURN new_org_id;
END;
$$;


-- 3. INVITE TO ORGANIZATION
CREATE OR REPLACE FUNCTION public.invite_to_organization(
  p_org_id UUID, 
  p_target_email TEXT, 
  p_role public.app_role
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_role public.app_role;
BEGIN
  -- Check permission
  SELECT role INTO current_user_role 
  FROM public.organization_members 
  WHERE org_id = p_org_id AND user_id = auth.uid();

  IF current_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only Admins can invite.';
  END IF;

  -- Insert Invitation
  INSERT INTO public.organization_invitations (org_id, email, role, invited_by)
  VALUES (p_org_id, p_target_email, p_role, auth.uid());

  RETURN json_build_object('status', 'success', 'email', p_target_email);
END;
$$;


COMMIT;

-- REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';

-- VERIFICATION
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'organizations');
