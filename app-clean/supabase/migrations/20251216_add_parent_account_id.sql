-- Add parent_account_id column to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_accounts_parent_id ON accounts(parent_account_id);

-- Add constraint to prevent self-parenting
ALTER TABLE accounts 
ADD CONSTRAINT check_parent_not_self CHECK (parent_account_id != id);
