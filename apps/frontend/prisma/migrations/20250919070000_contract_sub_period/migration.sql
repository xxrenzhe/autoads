-- Contract step: remove legacy Prisma columns and switch index to ended_at
-- 1) Drop old composite index if present
DROP INDEX `idx_sub_user_status_end` ON `subscriptions`;

-- 2) Drop legacy columns
ALTER TABLE `subscriptions`
  DROP COLUMN `currentPeriodStart`,
  DROP COLUMN `currentPeriodEnd`;

-- 3) Create new composite index for ended_at
CREATE INDEX `idx_sub_user_status_ended` ON `subscriptions`(`userId`, `status`, `ended_at`);

