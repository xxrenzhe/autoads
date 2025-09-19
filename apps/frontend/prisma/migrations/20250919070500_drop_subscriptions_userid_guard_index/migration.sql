-- Cleanup: remove guard index added before the contract migration
DROP INDEX `idx_sub_userId_guard` ON `subscriptions`;

