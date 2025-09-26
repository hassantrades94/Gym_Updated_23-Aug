-- Creating comprehensive wallet management tables with audit trail
-- This script addresses the missing wallet infrastructure referenced in the application code

-- Gym Wallets table - tracks wallet balance and billing information for each gym
CREATE TABLE IF NOT EXISTS gym_wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    balance_inr DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    last_billing_date TIMESTAMP WITH TIME ZONE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gym_id), -- Ensures one wallet per gym
    CONSTRAINT positive_balance CHECK (balance_inr >= 0)
);

-- Wallet Transactions table - comprehensive audit trail for all wallet activities
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'recharge',           -- Wallet top-up by gym owner
        'deduction',          -- Manual deduction by system admin
        'monthly_billing',    -- Automatic monthly billing for paid members
        'refund',            -- Refund transactions
        'adjustment'         -- Manual balance adjustments
    )),
    amount_inr DECIMAL(12,2) NOT NULL,
    balance_before_inr DECIMAL(12,2) NOT NULL,
    balance_after_inr DECIMAL(12,2) NOT NULL,
    reference_id VARCHAR(100), -- Unique reference for traceability (e.g., Razorpay payment ID)
    razorpay_payment_id VARCHAR(100), -- Specific field for Razorpay integration
    description TEXT,
    metadata JSONB, -- Additional transaction metadata (member count, billing period, etc.)
    processed_by UUID REFERENCES users(id), -- User who initiated the transaction
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints for data integrity
    CONSTRAINT valid_amount CHECK (
        (transaction_type IN ('recharge', 'refund', 'adjustment') AND amount_inr > 0) OR
        (transaction_type IN ('deduction', 'monthly_billing') AND amount_inr < 0)
    ),
    CONSTRAINT valid_balance_calculation CHECK (
        balance_after_inr = balance_before_inr + amount_inr
    )
);

-- Wallet Transaction History table - for maintaining historical records beyond active period
CREATE TABLE IF NOT EXISTS wallet_transaction_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_transaction_id UUID NOT NULL,
    gym_id UUID NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    amount_inr DECIMAL(12,2) NOT NULL,
    balance_before_inr DECIMAL(12,2) NOT NULL,
    balance_after_inr DECIMAL(12,2) NOT NULL,
    reference_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    description TEXT,
    metadata JSONB,
    processed_by UUID,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for optimal performance
CREATE INDEX idx_gym_wallets_gym_id ON gym_wallets(gym_id);
CREATE INDEX idx_wallet_transactions_gym_id ON wallet_transactions(gym_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_date ON wallet_transactions(transaction_date);
CREATE INDEX idx_wallet_transactions_reference ON wallet_transactions(reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX idx_wallet_transactions_razorpay ON wallet_transactions(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX idx_wallet_transaction_history_gym_date ON wallet_transaction_history(gym_id, transaction_date);
CREATE INDEX idx_wallet_transaction_history_original_id ON wallet_transaction_history(original_transaction_id);

-- Unique constraints for preventing duplicate transactions
CREATE UNIQUE INDEX uq_wallet_transactions_razorpay_id 
ON wallet_transactions(razorpay_payment_id) 
WHERE razorpay_payment_id IS NOT NULL;

CREATE UNIQUE INDEX uq_wallet_transactions_reference_id 
ON wallet_transactions(reference_id) 
WHERE reference_id IS NOT NULL;

-- Function to automatically update wallet balance after transaction
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the gym wallet balance
    UPDATE gym_wallets 
    SET 
        balance_inr = NEW.balance_after_inr,
        updated_at = NOW()
    WHERE gym_id = NEW.gym_id;
    
    -- If no wallet exists, create one
    IF NOT FOUND THEN
        INSERT INTO gym_wallets (gym_id, balance_inr)
        VALUES (NEW.gym_id, NEW.balance_after_inr);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate balance before transaction
CREATE OR REPLACE FUNCTION validate_wallet_transaction()
RETURNS TRIGGER AS $$
DECLARE
    current_balance DECIMAL(12,2);
BEGIN
    -- Get current wallet balance
    SELECT COALESCE(balance_inr, 0) INTO current_balance
    FROM gym_wallets
    WHERE gym_id = NEW.gym_id;
    
    -- If no wallet exists, assume 0 balance
    IF current_balance IS NULL THEN
        current_balance := 0;
    END IF;
    
    -- Set balance_before_inr if not provided
    IF NEW.balance_before_inr IS NULL THEN
        NEW.balance_before_inr := current_balance;
    END IF;
    
    -- Calculate balance_after_inr if not provided
    IF NEW.balance_after_inr IS NULL THEN
        NEW.balance_after_inr := NEW.balance_before_inr + NEW.amount_inr;
    END IF;
    
    -- Validate that balance_before matches current balance
    IF NEW.balance_before_inr != current_balance THEN
        RAISE EXCEPTION 'Balance mismatch: expected %, got %', current_balance, NEW.balance_before_inr;
    END IF;
    
    -- Prevent negative balance for deduction transactions
    IF NEW.balance_after_inr < 0 AND NEW.transaction_type IN ('deduction', 'monthly_billing') THEN
        RAISE EXCEPTION 'Insufficient wallet balance: current %, required %', current_balance, ABS(NEW.amount_inr);
    END IF;
    
    -- Generate reference_id if not provided
    IF NEW.reference_id IS NULL THEN
        NEW.reference_id := 'TXN_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old transactions (for data retention)
-- Note: This function will be created after all tables are established
-- CREATE OR REPLACE FUNCTION archive_old_wallet_transactions()
-- RETURNS INTEGER AS $$
-- DECLARE
--     archived_count INTEGER := 0;
-- BEGIN
--     -- Move transactions older than 2 years to history table
--     INSERT INTO wallet_transaction_history (
--         original_transaction_id, gym_id, transaction_type, amount_inr,
--         balance_before_inr, balance_after_inr, reference_id, razorpay_payment_id,
--         description, metadata, processed_by, transaction_date, created_at
--     )
--     SELECT 
--         id, gym_id, transaction_type, amount_inr,
--         balance_before_inr, balance_after_inr, reference_id, razorpay_payment_id,
--         description, metadata, processed_by, transaction_date, created_at
--     FROM wallet_transactions
--     WHERE transaction_date < NOW() - INTERVAL '2 years';
--     
--     GET DIAGNOSTICS archived_count = ROW_COUNT;
--     
--     -- Delete archived transactions from main table
--     DELETE FROM wallet_transactions
--     WHERE transaction_date < NOW() - INTERVAL '2 years';
--     
--     RETURN archived_count;
-- END;
-- $$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER validate_wallet_transaction_trigger
    BEFORE INSERT ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION validate_wallet_transaction();

CREATE TRIGGER update_wallet_balance_trigger
    AFTER INSERT ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_balance();

-- Ensure the update_updated_at_column function exists (from script 05)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gym_wallets_updated_at
    BEFORE UPDATE ON gym_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert wallet records for existing gyms
INSERT INTO gym_wallets (gym_id, balance_inr)
SELECT id, 0.00
FROM gyms
WHERE id NOT IN (SELECT gym_id FROM gym_wallets);

-- Add helpful comments
COMMENT ON TABLE gym_wallets IS 'Stores current wallet balance and billing information for each gym';
COMMENT ON TABLE wallet_transactions IS 'Complete audit trail of all wallet transactions with balance tracking';
COMMENT ON TABLE wallet_transaction_history IS 'Historical archive of wallet transactions for long-term retention';
COMMENT ON COLUMN wallet_transactions.amount_inr IS 'Transaction amount: positive for credits (recharge, refund), negative for debits (deduction, billing)';
COMMENT ON COLUMN wallet_transactions.balance_before_inr IS 'Wallet balance before this transaction';
COMMENT ON COLUMN wallet_transactions.balance_after_inr IS 'Wallet balance after this transaction';
COMMENT ON COLUMN wallet_transactions.reference_id IS 'Unique reference ID for transaction traceability';
COMMENT ON COLUMN wallet_transactions.metadata IS 'Additional transaction context (member count, billing period, etc.)';

-- Archive function - removed to prevent execution order issues
-- This function can be created separately after the main script has been executed successfully:
--
-- CREATE OR REPLACE FUNCTION archive_old_wallet_transactions()
-- RETURNS INTEGER AS $$
-- DECLARE
--     archived_count INTEGER := 0;
-- BEGIN
--     INSERT INTO wallet_transaction_history (
--         original_transaction_id, gym_id, transaction_type, amount_inr,
--         balance_before_inr, balance_after_inr, reference_id, razorpay_payment_id,
--         description, metadata, processed_by, transaction_date, created_at
--     )
--     SELECT 
--         id, gym_id, transaction_type, amount_inr,
--         balance_before_inr, balance_after_inr, reference_id, razorpay_payment_id,
--         description, metadata, processed_by, transaction_date, created_at
--     FROM wallet_transactions
--     WHERE transaction_date < NOW() - INTERVAL '2 years';
--     
--     GET DIAGNOSTICS archived_count = ROW_COUNT;
--     
--     DELETE FROM wallet_transactions
--     WHERE transaction_date < NOW() - INTERVAL '2 years';
--     
--     RETURN archived_count;
-- END;
-- $$ LANGUAGE plpgsql;