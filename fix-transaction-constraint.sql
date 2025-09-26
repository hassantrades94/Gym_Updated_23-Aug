-- Fix wallet_transactions table constraint to allow 'deduction' transaction type
-- This script should be run in the Supabase Dashboard SQL Editor

-- First, check current constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'wallet_transactions'
AND contype = 'c'
AND conname LIKE '%transaction_type%';

-- Drop the existing check constraint if it exists
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_type_check;

-- Add the updated check constraint with all required transaction types
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_transaction_type_check 
CHECK (transaction_type IN (
    'recharge',           -- Wallet top-up by gym owner
    'deduction',          -- Automatic deduction for unhiding members
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

-- Test the constraint by attempting to insert a deduction transaction
-- (This will be rolled back, just for testing)
BEGIN;

INSERT INTO wallet_transactions (
    gym_id,
    transaction_type,
    amount_inr,
    balance_before_inr,
    balance_after_inr,
    description
) VALUES (
    '1d86e66e-d5b4-4efb-a69f-e53f2b9e6c38',
    'deduction',
    -10.00,
    100.00,
    90.00,
    'Test deduction transaction'
);

SELECT 'Deduction transaction test successful!' as test_result;

ROLLBACK; -- Roll back the test transaction

SELECT 'Constraint update completed successfully!' as status;