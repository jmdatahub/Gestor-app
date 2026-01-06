-- ==============================================================================
-- VERIFY_MIG_001.sql
-- ==============================================================================
-- Objetivo: Comprobar el estado EXACTO tras ejecutar MIG_001.
-- ==============================================================================

-- 1. TABLAS CREADAS Y ESTADO RLS
-- ==============================================================================
SELECT 
    schemaname || '.' || tablename as full_tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename IN ('profiles', 'organizations', 'organization_members', 'organization_invitations', 'movements');
-- Nota: 'movements' NO debería estar modificada, solo listada para check de comparación.


-- 2. POLICIES ACTIVAS EN LAS NUEVAS TABLAS
-- ==============================================================================
SELECT 
    tablename, 
    policyname, 
    cmd as action 
FROM pg_policies 
WHERE tablename IN ('profiles', 'organizations', 'organization_members', 'organization_invitations')
ORDER BY tablename, cmd;


-- 3. FUNCIONES RPC CREADAS
-- ==============================================================================
SELECT 
    routine_name, 
    security_type -- Debe ser 'DEFINER' para functions seguras
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('create_organization', 'invite_to_organization', 'handle_new_user');


-- 4. COLUMNAS DE ORGANIZATIONS Y MEMBERS (Estructura Correcta)
-- ==============================================================================
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name IN ('organizations', 'organization_members')
ORDER BY table_name, ordinal_position;


-- 5. TEST NO-DESTRUCTIVO DE CORE TABLES (Movements no debe tener org_id aun)
-- ==============================================================================
SELECT 
    'movements' as table_checked, 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'movements' AND column_name = 'organization_id'
        ) THEN 'ERROR: organization_id exists (It shouldn''t yet!)'
        ELSE 'OK: Clean (No modifications yet)'
    END as status;
