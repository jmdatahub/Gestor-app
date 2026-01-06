-- ==============================================================================
-- MIG_001: CORE MULTI-WORKSPACE INFRASTRUCTURE
-- ==============================================================================
-- Description: Sets up the base tables for multi-tenancy (Profiles, Orgs, Members).
-- Does NOT modify existing resource tables (account, movements) yet.
-- Date: 2026-01-05
-- ==============================================================================

BEGIN;

-- 1. PROFILES TABLE (Public user identity)
-- ==============================================================================
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

-- RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for invites by username)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING ( true );

-- Users can update own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING ( auth.uid() = id );

-- Users can insert own profile (trigger handles this usually, but safe to allow)
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK ( auth.uid() = id );


-- 2. ORGANIZATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT, -- For URL friendless (optional future use)
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- RLS for Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Select: Visible if you are the owner OR a member (via exists query)
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

-- Insert: Only via RPC logic mostly, but RLS layer allows if you are the owner
CREATE POLICY "Users can create organizations" 
ON public.organizations FOR INSERT 
WITH CHECK ( auth.uid() = owner_id );

-- Update: Only owner (or admins, Logic handled in Members table check usually)
CREATE POLICY "Owners can update organizations" 
ON public.organizations FOR UPDATE 
USING ( auth.uid() = owner_id );


-- 3. ORGANIZATION MEMBERS
-- ==============================================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role DEFAULT 'member' NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(org_id, user_id)
);

-- RLS for Members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- View: Members can see who else is in their org
CREATE POLICY "Members see other members" 
ON public.organization_members FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members as om
    WHERE om.org_id = organization_members.org_id 
    AND om.user_id = auth.uid()
  )
);


-- 4. INVITATIONS
-- ==============================================================================
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

-- RLS for Invitations
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- View: Visible to Admins/Owners of the Org
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


-- 5. RPC: HANDLE NEW USER (Triggers Profile Creation)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger setup safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 6. RPC: CREATE ORGANIZATION (Secure Transaction)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_organization(org_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id UUID;
  can_create BOOLEAN;
BEGIN
  -- 1. Check permission
  SELECT can_create_orgs INTO can_create FROM public.profiles WHERE id = auth.uid();
  
  -- (Optional: For now allow everyone, or uncomment below to enforce)
  -- IF can_create IS NOT TRUE THEN
  --   RAISE EXCEPTION 'User not authorized to create organizations';
  -- END IF;

  -- 2. Create Org
  INSERT INTO public.organizations (name, owner_id)
  VALUES (org_name, auth.uid())
  RETURNING id INTO new_org_id;

  -- 3. Add Creator as Owner
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (new_org_id, auth.uid(), 'owner');

  RETURN new_org_id;
END;
$$;


-- 7. RPC: INVITE TO ORGANIZATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.invite_to_organization(
  p_org_id UUID, 
  p_target_email TEXT, 
  p_role public.app_role
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_role public.app_role;
  target_user_id UUID;
BEGIN
  -- 1. Check if requester is admin/owner
  SELECT role INTO current_user_role 
  FROM public.organization_members 
  WHERE org_id = p_org_id AND user_id = auth.uid();

  IF current_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only Admins can invite.';
  END IF;

  -- 2. Check if user exists in Auth (Optional: Auto-add if exists)
  -- This part is tricky with Supabase structure, usually we just store email.
  -- Logic: Just create invitation record.
  
  INSERT INTO public.organization_invitations (org_id, email, role, invited_by)
  VALUES (p_org_id, p_target_email, p_role, auth.uid());

  RETURN json_build_object('status', 'success', 'email', p_target_email);
END;
$$;


COMMIT;

-- ==============================================================================
-- 8. REFRESH SCHEMA
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 9. VERIFICATION
-- ==============================================================================
SELECT '=== PROFILES ===' as table_name;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public';

SELECT '=== ORGANIZATIONS ===' as table_name;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organizations' AND table_schema = 'public';

SELECT '=== ORGANIZATION_MEMBERS ===' as table_name;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organization_members' AND table_schema = 'public';
