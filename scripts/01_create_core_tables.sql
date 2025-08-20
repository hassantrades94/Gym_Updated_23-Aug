-- Creating core tables for users, gyms, and plans
-- Users table - stores both members and gym owners
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('member', 'gym_owner')),
    full_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Others')),
    height INTEGER, -- in cm
    weight DECIMAL(5,2), -- in kg
    profile_picture_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gyms table - stores gym information
CREATE TABLE gyms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gym_name VARCHAR(100) NOT NULL,
    gym_code VARCHAR(6) UNIQUE NOT NULL,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    coin_value DECIMAL(8,2) DEFAULT 4.00, -- how much 1 coin is worth in INR
    free_member_count INTEGER DEFAULT 0, -- tracks first 5 free members
    total_active_members INTEGER DEFAULT 0,
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gym Plans table - stores membership plans for each gym
CREATE TABLE gym_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL,
    price_inr DECIMAL(10,2) NOT NULL,
    duration_months INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_gyms_code ON gyms(gym_code);
CREATE INDEX idx_gyms_owner ON gyms(owner_id);
CREATE INDEX idx_gym_plans_gym ON gym_plans(gym_id);
