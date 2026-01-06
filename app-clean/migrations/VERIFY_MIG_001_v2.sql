-- ==============================================================================
-- VERIFY_MIG_001_v2.sql
-- ==============================================================================
-- Objetivo: Comprobar el hardening de seguridad y estructura tras MIG_001_v2
-- ==============================================================================

-- 1. TABLAS CREADAS Y ESTADO RLS
-- ==============================================================================
SELECT 
    schemaname || '.' || tablename as full_tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename IN ('profiles', 'organizations', 'organization_members', 'organization_invitations', 'movements');

-- 2. POLICIES ACTIVAS (Confirmar AUSENCIA de INSERT en organizations/members/invites)
-- ==============================================================================
SELECT 
    tablename, 
    policyname, 
    cmd as action,
    roles
FROM pg_policies 
WHERE tablename IN ('profiles', 'organizations', 'organization_members', 'organization_invitations')
ORDER BY tablename, cmd;
-- CHECK KEY: No debe haber 'INSERT' para organizations, organization_members, invitations

-- 3. FUNCIONES RPC CREADAS (Confirmar SECURITY DEFINER)
-- ==============================================================================
SELECT 
    routine_name, 
    security_type,
    external_language
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('create_organization', 'invite_to_organization', 'handle_new_user');

-- 4. TEST DE INTEGRIDAD CORE (No contaminación)
-- ==============================================================================
SELECT 
    'movements' as table_checked, 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'movements' AND column_name = 'organization_id'
        ) THEN 'FAIL: organization_id exists unexpectedly'
        ELSE 'PASS: Clean'
    END as status;
