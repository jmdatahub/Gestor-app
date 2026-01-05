-- =============================================
-- FIX_SCHEMA_FINAL - SOLUCIÓN DEFINITIVA
-- =============================================
-- EJECUTAR TODO JUNTO EN SUPABASE SQL EDITOR
-- Este script añade TODAS las columnas que el código necesita
-- =============================================

-- =============================================
-- 1. SAVINGS_GOALS - TODAS LAS COLUMNAS NECESARIAS
-- =============================================

-- El código espera: id, user_id, name, target_amount, current_amount, 
--                   target_date, description, status, created_at

ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS target_date DATE;

ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS current_amount DECIMAL(15,2) DEFAULT 0;

ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================
-- 2. ACCOUNTS - TODAS LAS COLUMNAS NECESARIAS
-- =============================================

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS parent_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =============================================
-- 3. CATEGORIES - COLUMNAS NECESARIAS
-- =============================================

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description TEXT;

-- =============================================
-- 4. HABILITAR RLS (Row Level Security)
-- =============================================

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. POLICIES SAVINGS_GOALS (reset completo)
-- =============================================

DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;

CREATE POLICY "Users can view own savings goals" 
ON public.savings_goals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings goals" 
ON public.savings_goals FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals" 
ON public.savings_goals FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals" 
ON public.savings_goals FOR DELETE 
USING (auth.uid() = user_id);

-- =============================================
-- 6. POLICIES ACCOUNTS (reset completo)
-- =============================================

DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

CREATE POLICY "Users can view own accounts" 
ON public.accounts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" 
ON public.accounts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" 
ON public.accounts FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" 
ON public.accounts FOR DELETE 
USING (auth.uid() = user_id);

-- =============================================
-- 7. POLICIES CATEGORIES (reset completo)
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
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
ON public.categories FOR DELETE 
USING (auth.uid() = user_id);

-- =============================================
-- 8. GRANT PERMISSIONS
-- =============================================

GRANT ALL ON public.savings_goals TO authenticated;
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.categories TO authenticated;

-- =============================================
-- 9. REFRESCAR SCHEMA CACHE DE POSTGREST
-- =============================================

NOTIFY pgrst, 'reload schema';

-- =============================================
-- 10. VERIFICACIÓN FINAL
-- =============================================

SELECT '=== SAVINGS_GOALS ===' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'savings_goals'
ORDER BY ordinal_position;

SELECT '=== ACCOUNTS ===' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'accounts'
ORDER BY ordinal_position;
