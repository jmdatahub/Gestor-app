DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounts' AND column_name = 'parent_id'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounts' AND column_name = 'parent_account_id'
    ) THEN 
        ALTER TABLE accounts RENAME COLUMN parent_id TO parent_account_id; 
    ELSIF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounts' AND column_name = 'parent_account_id'
    ) THEN 
        ALTER TABLE accounts ADD COLUMN parent_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL; 
    END IF; 
END $$;
