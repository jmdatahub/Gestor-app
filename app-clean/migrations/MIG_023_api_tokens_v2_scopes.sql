-- =============================================
-- MIG_023: API TOKENS v2 — Scopes + Workspace
-- Añade soporte para permisos granulares y
-- scope por workspace a los tokens API
-- EJECUTAR EN SUPABASE SQL EDITOR
-- =============================================

-- 1. Añadir columnas a api_tokens
ALTER TABLE public.api_tokens
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT ARRAY[
    'movements:read',
    'movements:write', 
    'accounts:read',
    'categories:read',
    'debts:read',
    'debts:write',
    'savings:read',
    'savings:write',
    'investments:read',
    'investments:write'
  ],
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL; -- NULL = nunca expira

-- 2. Índice para búsquedas por workspace
CREATE INDEX IF NOT EXISTS idx_api_tokens_org_id ON public.api_tokens(organization_id);

-- 3. Actualizar la función update_token_last_used para que sea accesible sin auth
DROP FUNCTION IF EXISTS update_token_last_used(TEXT);
CREATE OR REPLACE FUNCTION update_token_last_used(p_token_hash TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.api_tokens 
  SET last_used_at = NOW() 
  WHERE token_hash = p_token_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_token_last_used(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_token_last_used(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_token_last_used(TEXT) TO service_role;

-- 4. Migrar tokens existentes: darles todos los scopes por retrocompatibilidad
UPDATE public.api_tokens 
SET scopes = ARRAY[
  'movements:read', 'movements:write',
  'accounts:read', 'categories:read',
  'debts:read', 'debts:write',
  'savings:read', 'savings:write',
  'investments:read', 'investments:write'
]
WHERE scopes IS NULL OR array_length(scopes, 1) IS NULL;

-- 5. Verificación
SELECT 
  name, 
  organization_id,
  scopes,
  expires_at,
  created_at
FROM public.api_tokens
ORDER BY created_at DESC;

SELECT 'MIG_023 completada correctamente' AS status;
