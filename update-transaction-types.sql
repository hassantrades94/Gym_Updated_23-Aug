-- Update wallet_transactions table to allow all required transaction types
-- This script should be run in the Supabase Dashboard SQL Editor

-- First, drop the existing check constraint
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_type_check;

-- Add the updated check constraint with all required transaction types
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_transaction_type_check 
CHECK (transaction_type IN (
    'recharge',           -- Wallet top-up by gym owner
    'deduction',          -- Manual deduction by system admin
    'monthly_billing',    -- Automatic monthly billing for paid members
    'refund',            -- Refund transactions
    'adjustment'         -- Manual balance adjustments
));

-- Verify the constraint was added successfully
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'wallet_transactions'
AND contype = 'c'
AND conname LIKE '%transaction_type%';