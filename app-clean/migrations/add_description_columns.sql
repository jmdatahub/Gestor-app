-- =============================================
-- ADD DESCRIPTION TO ALL MAIN TABLES
-- =============================================
-- Ejecutar en Supabase SQL Editor
-- Añade columna 'description' a tablas que faltan
-- =============================================

-- 1. Savings Goals: añadir descripción
ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Accounts: añadir descripción  
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Categories: añadir descripción
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Reload schema cache para que Supabase reconozca los cambios
NOTIFY pgrst, 'reload schema';

-- =============================================
-- VERIFICACIÓN
-- =============================================
-- Ejecuta estos para confirmar que las columnas existen:

SELECT 'savings_goals' as tabla, column_name 
FROM information_schema.columns 
WHERE table_name = 'savings_goals' AND column_name = 'description';

SELECT 'accounts' as tabla, column_name 
FROM information_schema.columns 
WHERE table_name = 'accounts' AND column_name = 'description';

SELECT 'categories' as tabla, column_name 
FROM information_schema.columns 
WHERE table_name = 'categories' AND column_name = 'description';
