-- Add critical foreign keys for core relations
-- Preflight: ensure supporting indexes exist (idempotent creation relies on distinct names)
ALTER TABLE `payments`
  ADD INDEX `idx_payments_userId` (`userId`),
  ADD INDEX `idx_payments_subscriptionId` (`subscriptionId`);

-- Clean up orphans to avoid constraint failures
-- payments.subscriptionId -> subscriptions.id (nullable)
UPDATE `payments` p
LEFT JOIN `subscriptions` s ON s.id = p.`subscriptionId`
SET p.`subscriptionId` = NULL
WHERE p.`subscriptionId` IS NOT NULL AND s.id IS NULL;

-- payments.userId -> users.id (required)
DELETE p FROM `payments` p
LEFT JOIN `users` u ON u.id = p.`userId`
WHERE u.id IS NULL;

-- subscriptions.userId -> users.id (required)
DELETE s FROM `subscriptions` s
LEFT JOIN `users` u ON u.id = s.`userId`
WHERE u.id IS NULL;

-- subscriptions.planId -> plans.id (required)
DELETE s FROM `subscriptions` s
LEFT JOIN `plans` p ON p.id = s.`planId`
WHERE p.id IS NULL;

-- token_transactions.userId -> users.id (required)
DELETE tt FROM `token_transactions` tt
LEFT JOIN `users` u ON u.id = tt.`userId`
WHERE u.id IS NULL;

-- token_usage.userId -> users.id (required)
DELETE tu FROM `token_usage` tu
LEFT JOIN `users` u ON u.id = tu.`userId`
WHERE u.id IS NULL;

-- token_usage.planId -> plans.id (required)
DELETE tu FROM `token_usage` tu
LEFT JOIN `plans` p ON p.id = tu.`planId`
WHERE p.id IS NULL;

-- subscription_history: fix nullable plan refs; drop orphans for required refs
UPDATE `subscription_history` sh
LEFT JOIN `plans` p ON p.id = sh.`previousPlanId`
SET sh.`previousPlanId` = NULL
WHERE sh.`previousPlanId` IS NOT NULL AND p.id IS NULL;

UPDATE `subscription_history` sh
LEFT JOIN `plans` p ON p.id = sh.`newPlanId`
SET sh.`newPlanId` = NULL
WHERE sh.`newPlanId` IS NOT NULL AND p.id IS NULL;

DELETE sh FROM `subscription_history` sh
LEFT JOIN `subscriptions` s ON s.id = sh.`subscriptionId`
WHERE s.id IS NULL;

DELETE sh FROM `subscription_history` sh
LEFT JOIN `users` u ON u.id = sh.`changedBy`
WHERE u.id IS NULL;

-- Add foreign keys (MySQL 8.0)
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payments_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `subscriptions`
  ADD CONSTRAINT `subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `token_transactions`
  ADD CONSTRAINT `token_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `token_usage`
  ADD CONSTRAINT `token_usage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `token_usage_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `subscription_history`
  ADD CONSTRAINT `subscription_history_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `subscription_history_previousPlanId_fkey` FOREIGN KEY (`previousPlanId`) REFERENCES `plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `subscription_history_newPlanId_fkey` FOREIGN KEY (`newPlanId`) REFERENCES `plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `subscription_history_changedBy_fkey` FOREIGN KEY (`changedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

