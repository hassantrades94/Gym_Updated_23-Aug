-- Add missing reference_id column to wallet_transactions table
-- This script resolves the SQL error in script 09_create_wallet_tables.sql

-- Step 1: Add the reference_id column
ALTER TABLE wallet_transactions 
ADD COLUMN reference_id VARCHAR(100);

-- Step 2: Update existing records with reference_id values
-- Generate unique reference IDs for existing transactions
UPDATE wallet_transactions 
SET reference_id = 'TXN_' || EXTRACT(EPOCH FROM created_at)::BIGINT || '_' || SUBSTRING(id::TEXT FROM 1 FOR 8)
WHERE reference_id IS NULL;

-- Step 3: Create the index that was failing in script 09
CREATE INDEX idx_wallet_transactions_reference 
ON wallet_transactions(reference_id) 
WHERE reference_id IS NOT NULL;

-- Step 4: Create unique constraint for reference_id (from script 09)
CREATE UNIQUE INDEX uq_wallet_transactions_reference_id 
ON wallet_transactions(reference_id) 
WHERE reference_id IS NOT NULL;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'wallet_transactions' 
    AND column_name = 'reference_id';

-- Show sample data to confirm reference_id values
SELECT 
    id,
    reference_id,
    transaction_type,
    amount_inr,
    created_at
FROM wallet_transactions 
LIMIT 5;