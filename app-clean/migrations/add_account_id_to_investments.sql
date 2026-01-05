-- Add account_id to investments table to link investment to a holding account (e.g. Broker)
ALTER TABLE investments 
ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
