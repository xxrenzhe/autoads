-- Add users.name column for compatibility with Prisma schema
-- Idempotent across MySQL versions that don't support IF NOT EXISTS on ADD COLUMN

-- Check if the column already exists
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'name'
);

-- Build dynamic SQL: only add the column when it does not exist
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `name` VARCHAR(191) NULL',
  'SELECT 1');

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
