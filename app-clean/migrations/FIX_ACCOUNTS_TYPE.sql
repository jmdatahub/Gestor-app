-- =============================================
-- FIX_ACCOUNTS_TYPE_CONSTRAINT
-- =============================================
-- El código usa: general, savings, cash, bank, broker, other
-- La DB tenía: checking, savings, cash, credit, investment
-- Este script actualiza el constraint para aceptar los del código
-- =============================================

-- 1. Eliminar el constraint antiguo
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_type_check;

-- 2. Crear nuevo constraint con los valores correctos
ALTER TABLE public.accounts 
ADD CONSTRAINT accounts_type_check 
CHECK (type IN ('general', 'savings', 'cash', 'bank', 'broker', 'other', 'checking', 'credit', 'investment'));

-- También actualizar cualquier valor antiguo a los nuevos
UPDATE public.accounts SET type = 'bank' WHERE type = 'checking';
UPDATE public.accounts SET type = 'broker' WHERE type = 'investment';
UPDATE public.accounts SET type = 'other' WHERE type = 'credit';

-- Refrescar cache
NOTIFY pgrst, 'reload schema';

SELECT 'Constraint actualizado. Hacer Hard Reload.' as resultado;
