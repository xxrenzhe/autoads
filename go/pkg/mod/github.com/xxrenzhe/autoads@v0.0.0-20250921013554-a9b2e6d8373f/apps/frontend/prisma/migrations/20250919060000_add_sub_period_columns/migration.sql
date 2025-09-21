-- Expand-Contract step: add started_at / ended_at to align with Go writes
ALTER TABLE `subscriptions`
  ADD COLUMN `started_at` DATETIME NULL AFTER `currentPeriodStart`,
  ADD COLUMN `ended_at` DATETIME NULL AFTER `currentPeriodEnd`;

-- Backfill from Prisma columns if present
UPDATE `subscriptions`
  SET `started_at` = IFNULL(`started_at`, `currentPeriodStart`),
      `ended_at`   = IFNULL(`ended_at`, `currentPeriodEnd`)
  WHERE 1=1;

-- Optional: future step can drop old columns after all readers migrate.

