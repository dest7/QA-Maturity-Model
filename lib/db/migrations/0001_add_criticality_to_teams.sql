-- Add criticality column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS criticality TEXT NOT NULL DEFAULT 'BC';
