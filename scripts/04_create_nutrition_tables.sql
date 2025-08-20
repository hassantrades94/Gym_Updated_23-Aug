-- Creating nutrition and health tracking tables
-- Nutrition Plans table - stores AI-generated nutrition plans
CREATE TABLE nutrition_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_data JSONB NOT NULL, -- stores the complete nutrition plan
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calorie Scans table - tracks food image analysis
CREATE TABLE calorie_scans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT,
    analysis_result JSONB NOT NULL, -- stores nutrition analysis
    scan_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Food Log table - stores logged food entries
CREATE TABLE food_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name VARCHAR(100) NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
    meal_time TIME NOT NULL,
    meal_date DATE DEFAULT CURRENT_DATE,
    calories INTEGER,
    protein DECIMAL(5,2),
    carbs DECIMAL(5,2),
    fat DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table - system notifications
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for nutrition tables
CREATE INDEX idx_nutrition_plans_user ON nutrition_plans(user_id);
CREATE INDEX idx_calorie_scans_user ON calorie_scans(user_id);
CREATE INDEX idx_food_log_user ON food_log(user_id);
CREATE INDEX idx_food_log_date ON food_log(meal_date);
CREATE INDEX idx_notifications_user ON notifications(user_id);
