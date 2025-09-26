-- Fixed migration script to add columns in correct order
-- This addresses the ERROR: 42703: column "transaction_date" and "balance_before_inr" does not exist

-- Only work with wallet_transactions table (skip wallet_transaction_history for now)
DO $$
BEGIN
    -- Step 1: Add balance_before_inr column FIRST (required for balance_after_inr calculation)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wallet_transactions' 
        AND column_name = 'balance_before_inr'
    ) THEN
        ALTER TABLE wallet_transactions 
        ADD COLUMN balance_before_inr DECIMAL(12,2) DEFAULT 0;
        
        -- Set default values for existing records
        UPDATE wallet_transactions 
        SET balance_before_inr = 0 
        WHERE balance_before_inr IS NULL;
        
        -- Make the column NOT NULL after updating existing records
        ALTER TABLE wallet_transactions 
        ALTER COLUMN balance_before_inr SET NOT NULL;
    END IF;
    
    -- Step 2: Add balance_after_inr column (now balance_before_inr exists)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wallet_transactions' 
        AND column_name = 'balance_after_inr'
    ) THEN
        ALTER TABLE wallet_transactions 
        ADD COLUMN balance_after_inr DECIMAL(12,2) DEFAULT 0;
        
        -- Calculate balance_after_inr for existing records
        UPDATE wallet_transactions 
        SET balance_after_inr = COALESCE(balance_before_inr, 0) + amount_inr 
        WHERE balance_after_inr IS NULL OR balance_after_inr = 0;
        
        -- Make the column NOT NULL after updating existing records
        ALTER TABLE wallet_transactions 
        ALTER COLUMN balance_after_inr SET NOT NULL;
    END IF;
    
    -- Step 3: Add transaction_date column LAST
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wallet_transactions' 
        AND column_name = 'transaction_date'
    ) THEN
        ALTER TABLE wallet_transactions 
        ADD COLUMN transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Update existing records to have transaction_date = created_at
        UPDATE wallet_transactions 
        SET transaction_date = created_at 
        WHERE transaction_date IS NULL;
        
        -- Make the column NOT NULL after updating existing records
        ALTER TABLE wallet_transactions 
        ALTER COLUMN transaction_date SET NOT NULL;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_date ON wallet_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_gym_id ON wallet_transactions(gym_id);

-- Add comments
COMMENT ON COLUMN wallet_transactions.transaction_date IS 'Date and time when the transaction occurred';
COMMENT ON COLUMN wallet_transactions.balance_after_inr IS 'Wallet balance after this transaction';
COMMENT ON COLUMN wallet_transactions.balance_before_inr IS 'Wallet balance before this transaction';