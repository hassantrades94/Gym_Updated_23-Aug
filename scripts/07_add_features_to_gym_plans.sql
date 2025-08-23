-- Migration: Add features column to gym_plans table
-- This allows storing plan features as a comma-separated string

ALTER TABLE gym_plans 
ADD COLUMN features TEXT DEFAULT 'Gym Equipments';

-- Update existing plans to have the default fallback value
UPDATE gym_plans 
SET features = 'Gym Equipments' 
WHERE features IS NULL OR features = '';

-- Add a comment to document the column
COMMENT ON COLUMN gym_plans.features IS 'Comma-separated list of plan features. Defaults to "Gym Equipments" when empty.';