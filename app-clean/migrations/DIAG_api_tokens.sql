-- =============================================
-- DIAGNÓSTICO: API TOKENS
-- Ejecuta esto en el SQL Editor de Supabase para ver el estado actual
-- =============================================

-- 1. Ver todos los tokens (como service_role puedes ver todo)
SELECT 
  id,
  user_id,
  name,
  LEFT(token_hash, 16) || '...' AS token_hash_preview,
  permissions,
  last_used_at,
  created_at
FROM public.api_tokens
ORDER BY created_at DESC;

-- 2. Ver si el RPC existe
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_token_last_used';

-- 3. Ver políticas RLS activas en api_tokens
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'api_tokens';

-- 4. Test: simular lo que hace la API serverless
-- Reemplaza XXXX con el hash SHA256 de un token real
-- La API hace exactamente esta query:
-- SELECT user_id FROM api_tokens WHERE token_hash = '<sha256_del_token>';
