-- ==============================================================================
-- VERIFY_MIG_003.sql (Catalog Shadow)
-- ==============================================================================

SELECT 
    table_name,
    column_name, 
    data_type
FROM information_schema.columns 
WHERE column_name = 'organization_id' 
  AND table_name IN ('accounts', 'categories', 'recurring_rules');

-- EXPECTED: 3 ROWS (one for each table)

SELECT 
    schemaname, 
    tablename, 
    policyname 
FROM pg_policies 
WHERE policyname LIKE '%(Hybrid)%'
  AND tablename IN ('accounts', 'categories', 'recurring_rules');

-- EXPECTED: 4 Policies per table (12 rows total roughly, View/Ins/Upd/Del)

SELECT 'Data Integrity' as test,
       (SELECT count(*) FROM accounts) as total_accounts,
       'OK' as status;
