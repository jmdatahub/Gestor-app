-- =============================================
-- SQL para crear las tablas necesarias en Supabase
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- Tabla de Movimientos (con soporte para recurrentes)
CREATE TABLE IF NOT EXISTS movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'investment')),
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  category text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  recurring_rule_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para movements
CREATE INDEX IF NOT EXISTS idx_movements_user_id ON movements(user_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_account_id ON movements(account_id);
CREATE INDEX IF NOT EXISTS idx_movements_status ON movements(status);
CREATE INDEX IF NOT EXISTS idx_movements_recurring ON movements(recurring_rule_id);

-- RLS para movements
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own movements" ON movements;
DROP POLICY IF EXISTS "Users can insert own movements" ON movements;
DROP POLICY IF EXISTS "Users can update own movements" ON movements;
DROP POLICY IF EXISTS "Users can delete own movements" ON movements;

CREATE POLICY "Users can view own movements" ON movements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movements" ON movements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movements" ON movements
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own movements" ON movements
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================

-- Tabla de Reglas Recurrentes
CREATE TABLE IF NOT EXISTS recurring_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  amount numeric NOT NULL CHECK (amount > 0),
  category text,
  description text,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_week int CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month int CHECK (day_of_month >= 1 AND day_of_month <= 31),
  next_occurrence date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para recurring_rules
CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_rules(next_occurrence);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_rules(is_active);

-- RLS para recurring_rules
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring rules" ON recurring_rules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring rules" ON recurring_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring rules" ON recurring_rules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring rules" ON recurring_rules
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================

-- Tabla de Objetivos de Ahorro
CREATE TABLE IF NOT EXISTS savings_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_amount numeric NOT NULL DEFAULT 0,
  description text,
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para savings_goals
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);

-- RLS para savings_goals
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own savings goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can insert own savings goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can update own savings goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can delete own savings goals" ON savings_goals;

CREATE POLICY "Users can view own savings goals" ON savings_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings goals" ON savings_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals" ON savings_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals" ON savings_goals
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================

-- Tabla de Contribuciones a Objetivos de Ahorro
CREATE TABLE IF NOT EXISTS savings_goal_contributions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id uuid REFERENCES savings_goals(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para savings_goal_contributions
CREATE INDEX IF NOT EXISTS idx_contributions_goal_id ON savings_goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON savings_goal_contributions(user_id);

-- RLS para savings_goal_contributions
ALTER TABLE savings_goal_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own contributions" ON savings_goal_contributions;
DROP POLICY IF EXISTS "Users can insert own contributions" ON savings_goal_contributions;
DROP POLICY IF EXISTS "Users can update own contributions" ON savings_goal_contributions;
DROP POLICY IF EXISTS "Users can delete own contributions" ON savings_goal_contributions;

CREATE POLICY "Users can view own contributions" ON savings_goal_contributions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contributions" ON savings_goal_contributions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contributions" ON savings_goal_contributions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contributions" ON savings_goal_contributions
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- MIGRACIONES (ejecutar si las tablas ya existen)
-- =============================================

-- Si la tabla movements ya existe, añadir columnas:
-- ALTER TABLE movements ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled'));
-- ALTER TABLE movements ADD COLUMN IF NOT EXISTS recurring_rule_id uuid;

