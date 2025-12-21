-- Ensure category_id column exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movements' AND column_name = 'category_id') THEN
        ALTER TABLE movements ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_movements_category_id ON movements(category_id);

-- Optional: If you want to drop the old 'category' column if it exists and is not used anymore
-- ALTER TABLE movements DROP COLUMN IF EXISTS category;
