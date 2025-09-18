-- Add missing columns to users table to align with Prisma schema
-- Safe, idempotent for MySQL 8+ (IF NOT EXISTS)

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `name` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `avatar` VARCHAR(191) NULL;

