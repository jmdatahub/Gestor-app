-- =============================================
-- DB INSPECTOR RPC FUNCTION
-- =============================================
-- Execute this in Supabase SQL Editor ONCE
-- This creates a function to inspect table schemas
-- =============================================

-- Create function to get table columns (read-only, safe)
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name TEXT)
RETURNS TABLE (
    column_name TEXT,
    data_type TEXT,
    is_nullable TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.column_name::TEXT,
        c.data_type::TEXT,
        c.is_nullable::TEXT
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = get_table_columns.table_name
    ORDER BY c.ordinal_position;
END;
$$;

-- Grant execute to authenticated users (read-only, safe)
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;

-- =============================================
-- VERIFICATION: Test the function
-- =============================================
-- SELECT * FROM get_table_columns('movements');
-- SELECT * FROM get_table_columns('debts');
