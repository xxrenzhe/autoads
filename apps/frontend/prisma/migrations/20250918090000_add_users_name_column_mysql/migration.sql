-- Add users.name column for compatibility with Prisma schema
-- Safe to run multiple times: uses IF NOT EXISTS

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `name` VARCHAR(191) NULL;

