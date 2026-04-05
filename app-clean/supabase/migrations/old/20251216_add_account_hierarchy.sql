-- Add parent_id to accounts table
ALTER TABLE accounts 
ADD COLUMN parent_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_accounts_parent_id ON accounts(parent_id);

-- Optional: Constraint to ensure parent belongs to same user
-- (This usually requires a function + trigger, keeping it simple for now as requested, 
--  but relying on RLS and app logic is often sufficient for MVP)
