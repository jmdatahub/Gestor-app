-- =============================================
-- MIGRACIÓN: FIX API TOKENS - SERVICE ROLE ACCESS
-- =============================================
-- PROBLEMA: La función serverless de Vercel usa SUPABASE_SERVICE_ROLE_KEY
-- para autenticar, pero necesita poder leer api_tokens sin restricciones RLS.
-- 
-- La service_role ya bypassa RLS por defecto en Supabase, pero el RPC
-- update_token_last_used necesita permisos correctos.
-- EJECUTAR EN SUPABASE SQL EDITOR
-- =============================================

-- 1. Asegurarse de que la función update_token_last_used tiene los permisos correctos
-- y puede ser llamada sin autenticación (desde la service_role en la API)
CREATE OR REPLACE FUNCTION update_token_last_used(p_token_hash TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.api_tokens 
  SET last_used_at = NOW() 
  WHERE token_hash = p_token_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permiso de ejecución a todos (la service_role puede llamarla)
GRANT EXECUTE ON FUNCTION update_token_last_used(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_token_last_used(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_token_last_used(TEXT) TO service_role;

-- 2. Verificar que los índices existen para rendimiento
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON public.api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON public.api_tokens(user_id);

-- 3. Verificar que la tabla existe con las columnas correctas
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'api_tokens' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'MIG_022 ejecutada correctamente' AS status;
