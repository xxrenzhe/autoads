-- Contract step: remove legacy Prisma columns and switch index to ended_at
-- NOTE: MySQL requires a supporting index for foreign keys on `subscriptions.userId`.
-- To avoid error 1553 (cannot drop index needed by a foreign key), create the
-- replacement index FIRST, then drop the old one, then drop legacy columns.

-- 1) Create new composite index for ended_at (covers `userId` leading column)
CREATE INDEX `idx_sub_user_status_ended` ON `subscriptions`(`userId`, `status`, `ended_at`);

-- 2) Drop old composite index
DROP INDEX `idx_sub_user_status_end` ON `subscriptions`;

-- 3) Drop legacy columns no longer needed
ALTER TABLE `subscriptions`
  DROP COLUMN `currentPeriodStart`,
  DROP COLUMN `currentPeriodEnd`;
