-- Enforce unique Razorpay payment IDs and avoid duplicate rows by same (user, gym, date, amount)

-- Unique on razorpay_payment_id if not null
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_razorpay_id
ON payments(razorpay_payment_id)
WHERE razorpay_payment_id IS NOT NULL;

-- Optional: prevent accidental duplicates for cash/card recorded on the same second
-- This is a conservative constraint; adjust as per business rules
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_user_gym_datetime_amount
ON payments(user_id, gym_id, payment_date, amount_inr)
WHERE razorpay_payment_id IS NULL;

-- Creating utility functions and triggers
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gyms_updated_at BEFORE UPDATE ON gyms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gym_plans_updated_at BEFORE UPDATE ON gym_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gym_wallets_updated_at BEFORE UPDATE ON gym_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nutrition_plans_updated_at BEFORE UPDATE ON nutrition_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean old data (3-month retention)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete check-ins older than 3 months
    DELETE FROM check_ins WHERE created_at < NOW() - INTERVAL '3 months';
    
    -- Delete coin transactions older than 3 months
    DELETE FROM coin_transactions WHERE created_at < NOW() - INTERVAL '3 months';
    
    -- Delete old calorie scans (keep 6 months for nutrition tracking)
    DELETE FROM calorie_scans WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;
