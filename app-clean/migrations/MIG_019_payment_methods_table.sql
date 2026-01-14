-- =============================================
-- MIGRACIÓN 019: Tabla de Métodos de Pago
-- =============================================
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Crear tabla de métodos de pago
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  name TEXT NOT NULL,
  icon TEXT,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON public.payment_methods(user_id);

-- RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods" 
  ON public.payment_methods FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods" 
  ON public.payment_methods FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods" 
  ON public.payment_methods FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods" 
  ON public.payment_methods FOR DELETE 
  USING (auth.uid() = user_id);

-- Permisos
GRANT ALL ON public.payment_methods TO authenticated;

-- Verificación
SELECT 'Tabla payment_methods creada correctamente' AS status;
