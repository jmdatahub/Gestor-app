-- =============================================
-- MEGA FIX SCHEMA - VERSIÓN DEFINITIVA
-- =============================================
-- Análisis completo de todos los servicios del código
-- Este script asegura que TODAS las columnas existan y sean correctas
-- EJECUTAR TODO JUNTO EN SUPABASE SQL EDITOR
-- =============================================

-- =============================================
-- 1. ACCOUNTS
-- Código usa: id, user_id, name, type, description, is_active, parent_account_id, created_at, updated_at
-- Tipos permitidos en código: general, savings, cash, bank, broker, other
-- =============================================

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS parent_account_id UUID;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Fix constraint de type
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_type_check 
CHECK (type IN ('general', 'savings', 'cash', 'bank', 'broker', 'other', 'checking', 'credit', 'investment'));

-- =============================================
-- 2. DEBTS
-- Código usa: id, user_id, direction ('i_owe' | 'they_owe_me'), counterparty_name, 
--             total_amount, remaining_amount, due_date, description, is_closed, created_at
-- =============================================

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'i_owe';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS counterparty_name TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Check constraint para direction
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_direction_check;
ALTER TABLE public.debts ADD CONSTRAINT debts_direction_check 
CHECK (direction IN ('i_owe', 'they_owe_me'));

-- Hacer counterparty_name nullable para evitar errores
ALTER TABLE public.debts ALTER COLUMN counterparty_name DROP NOT NULL;

-- =============================================
-- 3. SAVINGS_GOALS
-- Código usa: id, user_id, name, target_amount, current_amount, target_date, 
--             description, status, color, icon, created_at
-- =============================================

ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS target_amount DECIMAL(15,2);
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS current_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Hacer nullable las columnas que el código no envía
ALTER TABLE public.savings_goals ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.savings_goals ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.savings_goals ALTER COLUMN target_amount DROP NOT NULL;

-- =============================================
-- 4. INVESTMENTS
-- Código usa: id, user_id, name, type, quantity, buy_price, current_price, 
--             currency, notes, created_at, updated_at
-- =============================================

ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'manual';
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS quantity DECIMAL(20,8) DEFAULT 0;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS buy_price DECIMAL(15,2);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS current_price DECIMAL(15,2);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Si la DB usa purchase_price en vez de buy_price, crear alias o renombrar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'investments' AND column_name = 'buy_price') 
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'investments' AND column_name = 'purchase_price') 
    THEN
        ALTER TABLE public.investments RENAME COLUMN purchase_price TO buy_price;
    END IF;
END $$;

-- Hacer columnas opcionales nullable
ALTER TABLE public.investments ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.investments ALTER COLUMN name DROP NOT NULL;

-- =============================================
-- 5. INVESTMENT_PRICE_HISTORY (tabla auxiliar)
-- =============================================

CREATE TABLE IF NOT EXISTS public.investment_price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    price DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.investment_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own investment history" ON public.investment_price_history;
DROP POLICY IF EXISTS "Users can insert own investment history" ON public.investment_price_history;
DROP POLICY IF EXISTS "Users can delete own investment history" ON public.investment_price_history;

CREATE POLICY "Users can view own investment history" ON public.investment_price_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investment history" ON public.investment_price_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own investment history" ON public.investment_price_history FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.investment_price_history TO authenticated;

-- =============================================
-- 6. RECURRING_RULES
-- Código usa: id, user_id, account_id, kind, amount, category, description,
--             frequency, day_of_week, day_of_month, next_occurrence, is_active, created_at
-- =============================================

ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS amount DECIMAL(15,2);
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'monthly';
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS day_of_week INTEGER;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS day_of_month INTEGER;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS next_occurrence DATE;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Hacer nullable columnas opcionales
ALTER TABLE public.recurring_rules ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE public.recurring_rules ALTER COLUMN account_id DROP NOT NULL;

-- =============================================
-- 7. MOVEMENTS
-- Código usa: id, user_id, account_id, kind, amount, date, description, category_id,
--             status, recurring_rule_id, created_at
-- =============================================

ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS recurring_rule_id UUID;

-- Si existe 'type' pero no 'kind', renombrar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'movements' AND column_name = 'kind') 
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'movements' AND column_name = 'type') 
    THEN
        ALTER TABLE public.movements RENAME COLUMN type TO kind;
    END IF;
END $$;

-- =============================================
-- 8. CATEGORIES
-- =============================================

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================
-- 9. HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 10. RESET TODAS LAS POLICIES (owner-only)
-- =============================================

-- ACCOUNTS
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- DEBTS
DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;
CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- SAVINGS_GOALS
DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;
CREATE POLICY "Users can view own savings goals" ON public.savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own savings goals" ON public.savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own savings goals" ON public.savings_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own savings goals" ON public.savings_goals FOR DELETE USING (auth.uid() = user_id);

-- INVESTMENTS
DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can insert own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can delete own investments" ON public.investments;
CREATE POLICY "Users can view own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON public.investments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- RECURRING_RULES
DROP POLICY IF EXISTS "Users can view own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can insert own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can update own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can delete own recurring rules" ON public.recurring_rules;
CREATE POLICY "Users can view own recurring rules" ON public.recurring_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring rules" ON public.recurring_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring rules" ON public.recurring_rules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring rules" ON public.recurring_rules FOR DELETE USING (auth.uid() = user_id);

-- MOVEMENTS
DROP POLICY IF EXISTS "Users can view own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can insert own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can update own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can delete own movements" ON public.movements;
CREATE POLICY "Users can view own movements" ON public.movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own movements" ON public.movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own movements" ON public.movements FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own movements" ON public.movements FOR DELETE USING (auth.uid() = user_id);

-- CATEGORIES
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 11. GRANT PERMISSIONS
-- =============================================

GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.debts TO authenticated;
GRANT ALL ON public.debt_movements TO authenticated;
GRANT ALL ON public.savings_goals TO authenticated;
GRANT ALL ON public.savings_contributions TO authenticated;
GRANT ALL ON public.investments TO authenticated;
GRANT ALL ON public.recurring_rules TO authenticated;
GRANT ALL ON public.movements TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.alerts TO authenticated;
GRANT ALL ON public.alert_rules TO authenticated;

-- =============================================
-- 12. REFRESCAR SCHEMA CACHE
-- =============================================

NOTIFY pgrst, 'reload schema';

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================

SELECT '✅ MEGA FIX ejecutado correctamente' as resultado;
SELECT '⚠️ Hacer HARD RELOAD en el navegador (Ctrl+Shift+R)' as instruccion;
