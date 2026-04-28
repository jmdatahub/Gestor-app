-- =============================================
-- MIGRACIÓN 020: Tabla de Proveedores (Autocomplete)
-- =============================================
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Crear tabla de proveedores
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_unique 
  ON public.providers(user_id, LOWER(name));

-- Índices para búsqueda y ordenación
CREATE INDEX IF NOT EXISTS idx_providers_user ON public.providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_name ON public.providers(name);
CREATE INDEX IF NOT EXISTS idx_providers_usage ON public.providers(usage_count DESC);

-- RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own providers" 
  ON public.providers FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own providers" 
  ON public.providers FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own providers" 
  ON public.providers FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own providers" 
  ON public.providers FOR DELETE 
  USING (auth.uid() = user_id);

-- Permisos
GRANT ALL ON public.providers TO authenticated;

-- Verificación
SELECT 'Tabla providers creada correctamente' AS status;
