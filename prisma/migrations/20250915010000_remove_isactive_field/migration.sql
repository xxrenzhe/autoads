-- Remove isActive field from users table
-- This migration removes the redundant isActive field since we now use only the status field

-- First, verify data consistency
-- This should return 0 if all data is consistent
SELECT 
    COUNT(*) as inconsistent_count
FROM users 
WHERE 
    (status = 'ACTIVE' AND isActive = false) OR
    (status IN ('INACTIVE', 'SUSPENDED', 'BANNED') AND isActive = true);

-- Create a backup table before dropping the column
CREATE TABLE IF NOT EXISTS users_isactive_backup AS
SELECT id, email, status, isActive, NOW() as backup_time
FROM users;

-- Drop the isActive column
ALTER TABLE users DROP COLUMN IF EXISTS isActive;

-- Verify the column has been removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'isActive';