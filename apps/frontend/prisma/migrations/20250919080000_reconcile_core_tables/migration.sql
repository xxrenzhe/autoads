-- Reconcile core tables missing due to earlier baseline inconsistencies
-- This migration is idempotent and only creates tables if they do not exist.

-- Create `subscriptions` table if missing (base shape, no FKs to avoid dependency issues)
CREATE TABLE IF NOT EXISTS `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'CANCELED', 'EXPIRED', 'PENDING', 'PAST_DUE') NOT NULL DEFAULT 'ACTIVE',
    `currentPeriodStart` DATETIME(3) NOT NULL,
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `canceledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'stripe',
    `providerSubscriptionId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `source` ENUM('STRIPE', 'MANUAL', 'SYSTEM', 'INVITATION') NOT NULL DEFAULT 'MANUAL',
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create `token_transactions` table if missing (base shape + essential index)
CREATE TABLE IF NOT EXISTS `token_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `balanceBefore` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `source` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `feature` ENUM('SITERANK', 'BATCHOPEN', 'CHANGELINK', 'AUTOCLICK', 'API', 'WEBHOOK', 'NOTIFICATION', 'REPORT', 'EXPORT', 'OTHER', 'ADMIN') NULL DEFAULT 'OTHER',
    PRIMARY KEY (`id`),
    INDEX `token_transactions_userId_createdAt_idx`(`userId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

