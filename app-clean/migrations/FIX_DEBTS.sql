-- =============================================
-- FIX DEBTS TABLE
-- =============================================
-- El código usa: counterparty_name
-- La DB tiene: person (NOT NULL)
-- Solución: Renombrar person a counterparty_name O hacer person nullable y añadir counterparty_name
-- =============================================

-- Opción 1: Renombrar la columna (más limpio)
ALTER TABLE public.debts RENAME COLUMN person TO counterparty_name;

-- Si falla porque ya existe counterparty_name, hacer person nullable
ALTER TABLE public.debts ALTER COLUMN person DROP NOT NULL;

-- Añadir counterparty_name si no existe
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS counterparty_name TEXT;

-- Copiar datos de person a counterparty_name si ambas existen
UPDATE public.debts SET counterparty_name = person WHERE counterparty_name IS NULL AND person IS NOT NULL;

-- Añadir otras columnas que el código necesita
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'i_owe';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Check constraint para direction
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_direction_check;
ALTER TABLE public.debts ADD CONSTRAINT debts_direction_check CHECK (direction IN ('i_owe', 'they_owe_me'));

-- Refrescar cache
NOTIFY pgrst, 'reload schema';

SELECT 'Debts table fixed. Hard reload browser.' as resultado;
