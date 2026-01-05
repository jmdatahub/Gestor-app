-- =============================================
-- FIX_SCHEMA_v3 - ALINEACIÓN COMPLETA DB ↔ CÓDIGO
-- =============================================
-- Ejecutar TODO de una vez en Supabase SQL Editor
-- NO fragmentar - ejecutar completo
-- =============================================

-- =============================================
-- 1. SAVINGS_GOALS - Añadir columnas faltantes
-- =============================================

-- Añadir status si no existe (el código usa 'active' | 'completed' | 'cancelled')
ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Añadir description si no existe
ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Asegurar created_at existe
ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Asegurar updated_at existe
ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =============================================
-- 2. ACCOUNTS - Asegurar columnas correctas
-- =============================================

-- Añadir description si no existe
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Asegurar parent_account_id existe (para sub-cuentas)
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS parent_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Asegurar timestamps
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =============================================
-- 3. CATEGORIES - Añadir description
-- =============================================

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description TEXT;

-- =============================================
-- 4. RESET RLS POLICIES - SAVINGS_GOALS
-- =============================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;

-- Crear políticas limpias
CREATE POLICY "Users can view own savings goals" 
ON public.savings_goals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings goals" 
ON public.savings_goals FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals" 
ON public.savings_goals FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals" 
ON public.savings_goals FOR DELETE 
USING (auth.uid() = user_id);

-- =============================================
-- 5. RESET RLS POLICIES - ACCOUNTS
-- =============================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

-- Crear políticas limpias
CREATE POLICY "Users can view own accounts" 
ON public.accounts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" 
ON public.accounts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" 
ON public.accounts FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" 
ON public.accounts FOR DELETE 
USING (auth.uid() = user_id);

-- =============================================
-- 6. RESET RLS POLICIES - CATEGORIES
-- =============================================

DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "Users can view own categories" 
ON public.categories FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" 
ON public.categories FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" 
ON public.categories FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
ON public.categories FOR DELETE 
USING (auth.uid() = user_id);

-- =============================================
-- 7. REFRESCAR CACHE DE POSTGREST
-- =============================================

NOTIFY pgrst, 'reload schema';

-- =============================================
-- 8. VERIFICACIÓN
-- =============================================

-- Columnas de savings_goals
SELECT 'SAVINGS_GOALS' as tabla, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'savings_goals'
ORDER BY ordinal_position;

-- Columnas de accounts
SELECT 'ACCOUNTS' as tabla, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'accounts'
ORDER BY ordinal_position;

-- Columnas de categories
SELECT 'CATEGORIES' as tabla, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'categories'
ORDER BY ordinal_position;
