-- =============================================
-- FIX_ALL_TABLES_DEFINITIVE
-- =============================================
-- Este script hace TODAS las columnas opcionales NULLABLE
-- para que no haya errores de "violates not-null constraint"
-- 
-- EJECUTAR TODO JUNTO EN SUPABASE SQL EDITOR
-- =============================================

-- =============================================
-- 1. SAVINGS_GOALS - Hacer columnas opcionales nullable
-- =============================================

-- Si account_id existe y es NOT NULL, hacerla nullable
ALTER TABLE public.savings_goals 
ALTER COLUMN account_id DROP NOT NULL;

-- Añadir columnas faltantes (ya existen? no problem con IF NOT EXISTS)
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS current_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================
-- 2. ACCOUNTS - Hacer opcionales nullable
-- =============================================

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS parent_account_id UUID;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =============================================
-- 3. CATEGORIES - Añadir opcionales
-- =============================================

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================
-- 4. INVESTMENTS - Asegurar columnas
-- =============================================

ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS symbol TEXT;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS quantity DECIMAL(20,8) DEFAULT 0;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(15,2);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS current_price DECIMAL(15,2);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Hacer account_id nullable si existe
ALTER TABLE public.investments ALTER COLUMN account_id DROP NOT NULL;

-- =============================================
-- 5. DEBTS - Asegurar todo correcto
-- =============================================

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================
-- 6. RECURRING_RULES - Asegurar columnas
-- =============================================

ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT FALSE;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS next_occurrence DATE;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Hacer opcionales nullable
ALTER TABLE public.recurring_rules ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE public.recurring_rules ALTER COLUMN account_id DROP NOT NULL;

-- =============================================
-- 7. HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. POLICIES PARA TODAS LAS TABLAS
-- =============================================

-- SAVINGS_GOALS
DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;
CREATE POLICY "Users can view own savings goals" ON public.savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own savings goals" ON public.savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own savings goals" ON public.savings_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own savings goals" ON public.savings_goals FOR DELETE USING (auth.uid() = user_id);

-- ACCOUNTS
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- CATEGORIES
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- INVESTMENTS
DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can insert own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can delete own investments" ON public.investments;
CREATE POLICY "Users can view own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON public.investments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- DEBTS
DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;
CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- RECURRING_RULES
DROP POLICY IF EXISTS "Users can view own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can insert own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can update own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can delete own recurring rules" ON public.recurring_rules;
CREATE POLICY "Users can view own recurring rules" ON public.recurring_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring rules" ON public.recurring_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring rules" ON public.recurring_rules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring rules" ON public.recurring_rules FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 9. GRANT PERMISSIONS
-- =============================================

GRANT ALL ON public.savings_goals TO authenticated;
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.investments TO authenticated;
GRANT ALL ON public.debts TO authenticated;
GRANT ALL ON public.recurring_rules TO authenticated;

-- =============================================
-- 10. REFRESCAR SCHEMA CACHE
-- =============================================

NOTIFY pgrst, 'reload schema';

-- =============================================
-- VERIFICACIÓN
-- =============================================

SELECT 'Script ejecutado correctamente. Hacer HARD RELOAD en el navegador (Ctrl+Shift+R)' as resultado;
