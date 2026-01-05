-- =============================================
-- RECREAR TABLA DEBTS CON SCHEMA CORRECTO
-- =============================================
-- La tabla actual tiene columnas incorrectas (person, amount_initial, amount_pending)
-- El código espera: direction, counterparty_name, total_amount, remaining_amount
-- 
-- ADVERTENCIA: Esto borrará datos existentes en la tabla debts
-- =============================================

-- 1. Eliminar tablas dependientes primero
DROP TABLE IF EXISTS public.debt_movements CASCADE;
DROP TABLE IF EXISTS public.debts CASCADE;

-- 2. Crear tabla debts con schema correcto
CREATE TABLE public.debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    direction TEXT NOT NULL DEFAULT 'i_owe' CHECK (direction IN ('i_owe', 'they_owe_me')),
    counterparty_name TEXT NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL CHECK (total_amount > 0),
    remaining_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    due_date DATE,
    description TEXT,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear tabla debt_movements
CREATE TABLE public.debt_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('payment', 'increase')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_movements ENABLE ROW LEVEL SECURITY;

-- 5. Policies para debts
CREATE POLICY "Users can view own debts" ON public.debts 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debts" ON public.debts 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debts" ON public.debts 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own debts" ON public.debts 
FOR DELETE USING (auth.uid() = user_id);

-- 6. Policies para debt_movements (heredan de debts via debt_id)
CREATE POLICY "Users can view own debt movements" ON public.debt_movements 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.debts WHERE id = debt_id AND user_id = auth.uid())
);

CREATE POLICY "Users can insert own debt movements" ON public.debt_movements 
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.debts WHERE id = debt_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update own debt movements" ON public.debt_movements 
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.debts WHERE id = debt_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete own debt movements" ON public.debt_movements 
FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.debts WHERE id = debt_id AND user_id = auth.uid())
);

-- 7. Permisos
GRANT ALL ON public.debts TO authenticated;
GRANT ALL ON public.debt_movements TO authenticated;

-- 8. Refrescar cache
NOTIFY pgrst, 'reload schema';

SELECT '✅ Tabla debts recreada correctamente' as resultado;
