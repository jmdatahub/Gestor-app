-- VERIFY_MIG_007.sql
-- Run this to verify the Debts module isolation (Shadow Columns + RLS)

-- 1. Check for organization_id column in debts and debt_movements
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE column_name = 'organization_id' 
  AND table_name IN ('debts', 'debt_movements');

-- EXPECTED RESULT:
-- Two rows: 
-- 1. debts | organization_id | uuid | YES
-- 2. debt_movements | organization_id | uuid | YES (if added, or inheritance check)
-- Note: In MIG_007 logic, we rely on debts having it. Let's check debts specifically.

-- 2. Check RLS Policies
SELECT 
    schemaname, 
    tablename, 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('debts', 'debt_movements')
  AND policyname LIKE '%(Hybrid)%';

-- EXPECTED RESULT:
-- Should see policies for SELECT, INSERT, UPDATE, DELETE with "(Hybrid)" in the name.
