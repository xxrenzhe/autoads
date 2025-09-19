-- Guard index to satisfy FKs on subscriptions.userId during index switch
-- This index is created prior to 20250919070000 to avoid MySQL 1553 errors
-- on environments that do not auto-create a separate index for the FK.
CREATE INDEX `idx_sub_userId_guard` ON `subscriptions`(`userId`);

