-- =============================================
-- MIGRACIÓN COMPLETA - MI PANEL FINANCIERO
-- =============================================
-- Este archivo crea TODAS las tablas necesarias
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ACCOUNTS (Cuentas bancarias/efectivo)
-- =============================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'checking', -- checking, savings, cash, credit, investment
    balance DECIMAL(15, 2) DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    color TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    parent_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 2. CATEGORIES (Categorías de movimientos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'expense', -- income, expense
    type TEXT, -- alias para kind
    color TEXT DEFAULT '#6366f1',
    icon TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 3. MOVEMENTS (Ingresos/Gastos/Inversiones)
-- =============================================
CREATE TABLE IF NOT EXISTS public.movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'investment')),
    amount DECIMAL(15, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_rule_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can insert own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can update own movements" ON public.movements;
DROP POLICY IF EXISTS "Users can delete own movements" ON public.movements;

CREATE POLICY "Users can view own movements" ON public.movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own movements" ON public.movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own movements" ON public.movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own movements" ON public.movements FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 4. DEBTS (Deudas - Yo debo / Me deben)
-- =============================================
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('i_owe', 'they_owe_me')),
    counterparty_name TEXT NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL CHECK (total_amount > 0),
    remaining_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    due_date DATE,
    description TEXT,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.debt_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('payment', 'increase')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;

CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own debt movements" ON public.debt_movements;
DROP POLICY IF EXISTS "Users can insert own debt movements" ON public.debt_movements;
DROP POLICY IF EXISTS "Users can delete own debt movements" ON public.debt_movements;

CREATE POLICY "Users can view own debt movements" ON public.debt_movements FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_movements.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can insert own debt movements" ON public.debt_movements FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_movements.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can delete own debt movements" ON public.debt_movements FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_movements.debt_id AND debts.user_id = auth.uid()));

-- =============================================
-- 5. SAVINGS_GOALS (Metas de ahorro)
-- =============================================
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(15, 2) DEFAULT 0,
    target_date DATE,
    color TEXT DEFAULT '#22c55e',
    icon TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.savings_contributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;

CREATE POLICY "Users can view own savings goals" ON public.savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own savings goals" ON public.savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own savings goals" ON public.savings_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own savings goals" ON public.savings_goals FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own contributions" ON public.savings_contributions;
DROP POLICY IF EXISTS "Users can insert own contributions" ON public.savings_contributions;
DROP POLICY IF EXISTS "Users can delete own contributions" ON public.savings_contributions;

CREATE POLICY "Users can view own contributions" ON public.savings_contributions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.savings_goals WHERE savings_goals.id = savings_contributions.goal_id AND savings_goals.user_id = auth.uid()));
CREATE POLICY "Users can insert own contributions" ON public.savings_contributions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.savings_goals WHERE savings_goals.id = savings_contributions.goal_id AND savings_goals.user_id = auth.uid()));
CREATE POLICY "Users can delete own contributions" ON public.savings_contributions FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.savings_goals WHERE savings_goals.id = savings_contributions.goal_id AND savings_goals.user_id = auth.uid()));

-- =============================================
-- 6. INVESTMENTS (Inversiones)
-- =============================================
CREATE TABLE IF NOT EXISTS public.investments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'stock', -- stock, crypto, fund, bond, real_estate, other
    symbol TEXT,
    quantity DECIMAL(20, 8) DEFAULT 0,
    purchase_price DECIMAL(15, 2),
    current_price DECIMAL(15, 2),
    currency TEXT DEFAULT 'EUR',
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can insert own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can delete own investments" ON public.investments;

CREATE POLICY "Users can view own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON public.investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 7. RECURRING_RULES (Reglas recurrentes)
-- =============================================
CREATE TABLE IF NOT EXISTS public.recurring_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15, 2) NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly', -- daily, weekly, monthly, yearly
    day_of_month INTEGER,
    day_of_week INTEGER,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    next_occurrence DATE,
    is_active BOOLEAN DEFAULT TRUE,
    auto_apply BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can insert own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can update own recurring rules" ON public.recurring_rules;
DROP POLICY IF EXISTS "Users can delete own recurring rules" ON public.recurring_rules;

CREATE POLICY "Users can view own recurring rules" ON public.recurring_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring rules" ON public.recurring_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring rules" ON public.recurring_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring rules" ON public.recurring_rules FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 8. ALERTS & ALERT_RULES
-- =============================================
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alert_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    condition JSONB NOT NULL DEFAULT '{}',
    severity TEXT DEFAULT 'warning',
    trigger_mode TEXT DEFAULT 'repeat',
    period TEXT DEFAULT 'current_month',
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON public.alerts;

CREATE POLICY "Users can view own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON public.alerts FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can insert own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can update own alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Users can delete own alert rules" ON public.alert_rules;

CREATE POLICY "Users can view own alert rules" ON public.alert_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alert rules" ON public.alert_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alert rules" ON public.alert_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alert rules" ON public.alert_rules FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 9. INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_movements_user_id ON public.movements(user_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON public.movements(date);
CREATE INDEX IF NOT EXISTS idx_movements_account ON public.movements(account_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON public.savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_user_id ON public.recurring_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON public.alert_rules(user_id);

-- =============================================
-- 10. GRANT PERMISSIONS
-- =============================================
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.movements TO authenticated;
GRANT ALL ON public.debts TO authenticated;
GRANT ALL ON public.debt_movements TO authenticated;
GRANT ALL ON public.savings_goals TO authenticated;
GRANT ALL ON public.savings_contributions TO authenticated;
GRANT ALL ON public.investments TO authenticated;
GRANT ALL ON public.recurring_rules TO authenticated;
GRANT ALL ON public.alerts TO authenticated;
GRANT ALL ON public.alert_rules TO authenticated;

-- =============================================
-- ✅ MIGRACIÓN COMPLETADA
-- =============================================
-- Ejecuta este SELECT para verificar que las tablas existen:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
