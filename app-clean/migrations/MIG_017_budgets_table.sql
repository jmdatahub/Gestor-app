-- =============================================
-- MIGRACIÓN: PRESUPUESTOS POR CATEGORÍA
-- =============================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- =============================================

-- 1. Eliminar tabla si existe (empezar limpio)
DROP TABLE IF EXISTS public.budgets CASCADE;

-- 2. Crear tabla de presupuestos
CREATE TABLE public.budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  monthly_limit NUMERIC(15,2) NOT NULL DEFAULT 0,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índice único para evitar duplicados
CREATE UNIQUE INDEX idx_budgets_unique 
  ON public.budgets(user_id, category_name, month);

-- 4. Índices para rendimiento
CREATE INDEX idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX idx_budgets_month ON public.budgets(month);

-- 5. Habilitar RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS
CREATE POLICY "Users can view own budgets" 
  ON public.budgets FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets" 
  ON public.budgets FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets" 
  ON public.budgets FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets" 
  ON public.budgets FOR DELETE 
  USING (auth.uid() = user_id);

-- 7. Permisos
GRANT ALL ON public.budgets TO authenticated;

-- 8. Verificación
SELECT 'Tabla budgets creada correctamente' AS status;
