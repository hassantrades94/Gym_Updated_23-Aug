-- Seeding sample data for testing
-- Insert sample gym owner
INSERT INTO users (phone_number, password_hash, user_type, full_name, date_of_birth, gender) VALUES
('9876543210', '$2a$10$example_hash_for_password_123456', 'gym_owner', 'Rajesh Kumar', '1985-05-15', 'Male');

-- Get the gym owner ID
DO $$
DECLARE
    owner_uuid UUID;
    gym_uuid UUID;
    plan_uuid UUID;
BEGIN
    -- Get owner ID
    SELECT id INTO owner_uuid FROM users WHERE phone_number = '9876543210';
    
    -- Insert sample gym
    INSERT INTO gyms (owner_id, gym_name, gym_code, location_latitude, location_longitude, coin_value)
    VALUES (owner_uuid, 'FitZone Downtown', 'FIT@12', 26.1445, 91.7362, 4.00)
    RETURNING id INTO gym_uuid;
    
    -- Create gym wallet
    INSERT INTO gym_wallets (gym_id, balance_inr) VALUES (gym_uuid, 500.00);
    
    -- Insert sample gym plans
    INSERT INTO gym_plans (gym_id, plan_name, price_inr, duration_months) VALUES
    (gym_uuid, 'Basic', 2900.00, 1),
    (gym_uuid, 'Standard', 4900.00, 1),
    (gym_uuid, 'Premium', 8900.00, 1);
    
    -- Insert sample members
    INSERT INTO users (phone_number, password_hash, user_type, full_name, date_of_birth, gender, height, weight) VALUES
    ('9876543211', '$2a$10$example_hash_for_password_123456', 'member', 'Priya Sharma', '1995-08-20', 'Female', 165, 58.5),
    ('9876543212', '$2a$10$example_hash_for_password_123456', 'member', 'Amit Singh', '1992-03-10', 'Male', 175, 70.0),
    ('9876543213', '$2a$10$example_hash_for_password_123456', 'member', 'Sneha Das', '1998-12-05', 'Female', 160, 55.0);
    
    -- Get plan ID for memberships
    SELECT id INTO plan_uuid FROM gym_plans WHERE gym_id = gym_uuid AND plan_name = 'Standard' LIMIT 1;
    
    -- Create sample memberships
    INSERT INTO memberships (user_id, gym_id, plan_id, start_date, expiry_date, payment_status, payment_mode)
    SELECT u.id, gym_uuid, plan_uuid, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'paid', 'online'
    FROM users u WHERE u.user_type = 'member';
    
END $$;
