-- Add missing columns to users table to align with Prisma schema
-- Safe, idempotent for MySQL 8+ (IF NOT EXISTS)

-- Add `name` column if missing
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'name'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `name` VARCHAR(191) NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add `avatar` column if missing
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `avatar` VARCHAR(191) NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
