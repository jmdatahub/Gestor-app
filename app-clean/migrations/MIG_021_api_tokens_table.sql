-- =============================================
-- MIGRACIÓN: API TOKENS
-- =============================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- =============================================

-- 1. Crear tabla de tokens API
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, -- SHA256 hash del token
  permissions TEXT[] DEFAULT ARRAY['read', 'write'], -- Permisos del token
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON public.api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON public.api_tokens(token_hash);

-- 3. Habilitar RLS
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS (Solo el propietario puede ver/gestionar sus tokens)
CREATE POLICY "Users can view own tokens" 
  ON public.api_tokens FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" 
  ON public.api_tokens FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" 
  ON public.api_tokens FOR DELETE 
  USING (auth.uid() = user_id);

-- No permitimos UPDATE, para revocar se borra y crea nuevo
-- 5. Permisos
GRANT ALL ON public.api_tokens TO authenticated;

-- 6. Función para actualizar last_used_at (llamada desde la API)
CREATE OR REPLACE FUNCTION update_token_last_used(p_token_hash TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.api_tokens 
  SET last_used_at = NOW() 
  WHERE token_hash = p_token_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Verificación
SELECT 'Tabla api_tokens creada correctamente' AS status;
