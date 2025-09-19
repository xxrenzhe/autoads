-- Ensure users.emailVerified exists for NextAuth adapter compatibility
-- Use dynamic SQL to be compatible with MySQL versions that don't support IF NOT EXISTS

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'emailVerified'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT false',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
