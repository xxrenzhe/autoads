-- AutoAds GoFly 数据库初始化脚本
-- 执行前请确保已创建数据库：CREATE DATABASE autoads_gofly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
    `id` varchar(36) NOT NULL,
    `email` varchar(255) NOT NULL,
    `password` varchar(255) DEFAULT NULL,
    `name` varchar(100) DEFAULT NULL,
    `role` varchar(20) DEFAULT 'USER',
    `status` varchar(20) DEFAULT 'active',
    `plan_id` varchar(36) DEFAULT NULL,
    `plan_name` varchar(20) DEFAULT 'FREE',
    `plan_expires_at` datetime DEFAULT NULL,
    `trial_started_at` datetime DEFAULT NULL,
    `trial_ends_at` datetime DEFAULT NULL,
    `google_id` varchar(100) DEFAULT NULL,
    `last_login_at` datetime DEFAULT NULL,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_email` (`email`),
    KEY `idx_google_id` (`google_id`),
    KEY `idx_status` (`status`),
    KEY `idx_plan_name` (`plan_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理员账户表
CREATE TABLE IF NOT EXISTS `admin_accounts` (
    `id` varchar(36) NOT NULL,
    `username` varchar(50) NOT NULL,
    `password_hash` varchar(255) NOT NULL,
    `email` varchar(255) DEFAULT NULL,
    `role` varchar(20) DEFAULT 'ADMIN',
    `status` varchar(20) DEFAULT 'ACTIVE',
    `last_login_at` datetime DEFAULT NULL,
    `login_count` int DEFAULT 0,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_username` (`username`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token余额表
CREATE TABLE IF NOT EXISTS `token_balances` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(36) NOT NULL,
    `balance` bigint DEFAULT 0,
    `frozen` bigint DEFAULT 0,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token交易记录表
CREATE TABLE IF NOT EXISTS `token_transactions` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(36) NOT NULL,
    `type` varchar(20) NOT NULL,
    `amount` bigint NOT NULL,
    `balance` bigint NOT NULL,
    `description` varchar(500) DEFAULT NULL,
    `feature` varchar(50) DEFAULT NULL,
    `task_id` varchar(36) DEFAULT NULL,
    `status` varchar(20) DEFAULT 'COMPLETED',
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_user_id` (`user_id`),
    KEY `idx_type` (`type`),
    KEY `idx_feature` (`feature`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token套餐表
CREATE TABLE IF NOT EXISTS `token_packages` (
    `id` varchar(36) NOT NULL,
    `name` varchar(100) NOT NULL,
    `description` text,
    `tokens` bigint NOT NULL,
    `price` decimal(10,2) NOT NULL,
    `currency` varchar(3) DEFAULT 'CNY',
    `discount` decimal(3,2) DEFAULT 1.00,
    `is_popular` boolean DEFAULT FALSE,
    `is_active` boolean DEFAULT TRUE,
    `sort_order` int DEFAULT 0,
    `expires_in` int DEFAULT 0,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_is_active` (`is_active`),
    KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token订单表
CREATE TABLE IF NOT EXISTS `token_orders` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(36) NOT NULL,
    `package_id` varchar(36) NOT NULL,
    `tokens` bigint NOT NULL,
    `amount` decimal(10,2) NOT NULL,
    `currency` varchar(3) DEFAULT 'CNY',
    `payment_method` varchar(50) DEFAULT NULL,
    `status` varchar(20) DEFAULT 'PENDING',
    `transaction_id` varchar(100) DEFAULT NULL,
    `paid_at` datetime DEFAULT NULL,
    `expires_at` datetime NOT NULL,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_package_id` (`package_id`),
    KEY `idx_status` (`status`),
    KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token预扣记录表
CREATE TABLE IF NOT EXISTS `token_pre_deductions` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(36) NOT NULL,
    `feature` varchar(50) DEFAULT NULL,
    `task_id` varchar(36) NOT NULL,
    `amount` bigint NOT NULL,
    `status` varchar(20) DEFAULT 'PENDING',
    `confirmed_amount` bigint DEFAULT 0,
    `expires_at` datetime NOT NULL,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_user_id` (`user_id`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_status` (`status`),
    KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BatchGo任务表
CREATE TABLE IF NOT EXISTS `batchgo_tasks` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(36) NOT NULL,
    `name` varchar(200) NOT NULL,
    `type` varchar(50) NOT NULL,
    `config` json DEFAULT NULL,
    `status` varchar(20) DEFAULT 'pending',
    `progress` int DEFAULT 0,
    `started_at` datetime DEFAULT NULL,
    `completed_at` datetime DEFAULT NULL,
    `duration` bigint DEFAULT NULL,
    `results` json DEFAULT NULL,
    `error` text DEFAULT NULL,
    `token_cost` int DEFAULT 0,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_type` (`type`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SiteRankGo查询表
CREATE TABLE IF NOT EXISTS `siterank_queries` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(36) NOT NULL,
    `name` varchar(200) NOT NULL,
    `urls` json NOT NULL,
    `keywords` json NOT NULL,
    `search_engine` varchar(50) DEFAULT 'google',
    `region` varchar(10) DEFAULT 'us',
    `language` varchar(10) DEFAULT 'en',
    `device_type` varchar(20) DEFAULT 'desktop',
    `is_batch` boolean DEFAULT FALSE,
    `batch_size` int DEFAULT 0,
    `query_depth` int DEFAULT 10,
    `proxy_enabled` boolean DEFAULT FALSE,
    `proxy_list` json DEFAULT NULL,
    `delay_range` json DEFAULT NULL,
    `user_agents` json DEFAULT NULL,
    `status` varchar(20) DEFAULT 'pending',
    `total_queries` int DEFAULT 0,
    `success_queries` int DEFAULT 0,
    `failed_queries` int DEFAULT 0,
    `token_cost` int DEFAULT 0,
    `started_at` datetime DEFAULT NULL,
    `completed_at` datetime DEFAULT NULL,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SiteRankGo查询结果表
CREATE TABLE IF NOT EXISTS `siterank_results` (
    `id` varchar(36) NOT NULL,
    `query_id` varchar(36) NOT NULL,
    `url` varchar(500) NOT NULL,
    `keyword` varchar(200) NOT NULL,
    `engine` varchar(50) DEFAULT 'google',
    `region` varchar(10) DEFAULT 'us',
    `language` varchar(10) DEFAULT 'en',
    `device` varchar(20) DEFAULT 'desktop',
    `position` int DEFAULT 0,
    `status` varchar(20) DEFAULT 'pending',
    `start_time` datetime DEFAULT NULL,
    `end_time` datetime DEFAULT NULL,
    `duration` bigint DEFAULT NULL,
    `proxy_used` varchar(200) DEFAULT NULL,
    `error` text DEFAULT NULL,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_query_id` (`query_id`),
    KEY `idx_url` (`url`(255)),
    KEY `idx_keyword` (`keyword`(100)),
    KEY `idx_position` (`position`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 广告账户表
CREATE TABLE IF NOT EXISTS `ads_accounts` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(36) NOT NULL,
    `platform` varchar(50) NOT NULL,
    `account_id` varchar(100) NOT NULL,
    `account_name` varchar(200) DEFAULT NULL,
    `email` varchar(255) DEFAULT NULL,
    `currency` varchar(3) DEFAULT 'USD',
    `timezone` varchar(50) DEFAULT 'UTC',
    `access_token` text DEFAULT NULL,
    `refresh_token` text DEFAULT NULL,
    `client_id` varchar(200) DEFAULT NULL,
    `client_secret` varchar(200) DEFAULT NULL,
    `developer_token` varchar(200) DEFAULT NULL,
    `status` varchar(20) DEFAULT 'pending',
    `is_active` boolean DEFAULT FALSE,
    `last_sync_at` datetime DEFAULT NULL,
    `expires_at` datetime DEFAULT NULL,
    `error_code` varchar(50) DEFAULT NULL,
    `error_message` text DEFAULT NULL,
    `campaign_count` int DEFAULT 0,
    `total_spend` decimal(20,2) DEFAULT 0.00,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` datetime DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_platform` (`platform`),
    KEY `idx_account_id` (`account_id`),
    KEY `idx_status` (`status`),
    UNIQUE KEY `uk_user_platform_account` (`user_id`, `platform`, `account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 广告系列表
CREATE TABLE IF NOT EXISTS `ads_campaigns` (
    `id` varchar(36) NOT NULL,
    `account_id` varchar(36) NOT NULL,
    `platform` varchar(50) DEFAULT NULL,
    `campaign_id` varchar(100) NOT NULL,
    `name` varchar(200) DEFAULT NULL,
    `status` varchar(50) DEFAULT NULL,
    `budget_type` varchar(50) DEFAULT NULL,
    `budget_amount` decimal(20,2) DEFAULT 0.00,
    `start_date` datetime DEFAULT NULL,
    `end_date` datetime DEFAULT NULL,
    `impressions` bigint DEFAULT 0,
    `clicks` bigint DEFAULT 0,
    `cost` decimal(20,2) DEFAULT 0.00,
    `conversions` bigint DEFAULT 0,
    `ctr` decimal(10,4) DEFAULT 0.0000,
    `cpc` decimal(20,2) DEFAULT 0.00,
    `cpa` decimal(20,2) DEFAULT 0.00,
    `last_sync_at` datetime DEFAULT NULL,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_account_id` (`account_id`),
    KEY `idx_campaign_id` (`campaign_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 广告组表
CREATE TABLE IF NOT EXISTS `ads_adgroups` (
    `id` varchar(36) NOT NULL,
    `campaign_id` varchar(36) NOT NULL,
    `platform` varchar(50) DEFAULT NULL,
    `ad_group_id` varchar(100) NOT NULL,
    `name` varchar(200) DEFAULT NULL,
    `status` varchar(50) DEFAULT NULL,
    `type` varchar(50) DEFAULT NULL,
    `impressions` bigint DEFAULT 0,
    `clicks` bigint DEFAULT 0,
    `cost` decimal(20,2) DEFAULT 0.00,
    `conversions` bigint DEFAULT 0,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_campaign_id` (`campaign_id`),
    KEY `idx_ad_group_id` (`ad_group_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 广告表
CREATE TABLE IF NOT EXISTS `ads_ads` (
    `id` varchar(36) NOT NULL,
    `ad_group_id` varchar(36) NOT NULL,
    `platform` varchar(50) DEFAULT NULL,
    `ad_id` varchar(100) NOT NULL,
    `name` varchar(200) DEFAULT NULL,
    `status` varchar(50) DEFAULT NULL,
    `type` varchar(50) DEFAULT NULL,
    `headlines` json DEFAULT NULL,
    `descriptions` json DEFAULT NULL,
    `final_url` text DEFAULT NULL,
    `display_path` varchar(200) DEFAULT NULL,
    `impressions` bigint DEFAULT 0,
    `clicks` bigint DEFAULT 0,
    `cost` decimal(20,2) DEFAULT 0.00,
    `conversions` bigint DEFAULT 0,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_ad_group_id` (`ad_group_id`),
    KEY `idx_ad_id` (`ad_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 关键词表
CREATE TABLE IF NOT EXISTS `ads_keywords` (
    `id` varchar(36) NOT NULL,
    `ad_group_id` varchar(36) NOT NULL,
    `platform` varchar(50) DEFAULT NULL,
    `keyword_id` varchar(100) NOT NULL,
    `text` varchar(200) NOT NULL,
    `match_type` varchar(20) DEFAULT NULL,
    `status` varchar(50) DEFAULT NULL,
    `max_cpc` decimal(20,2) DEFAULT 0.00,
    `quality_score` int DEFAULT 0,
    `impressions` bigint DEFAULT 0,
    `clicks` bigint DEFAULT 0,
    `cost` decimal(20,2) DEFAULT 0.00,
    `conversions` bigint DEFAULT 0,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_ad_group_id` (`ad_group_id`),
    KEY `idx_keyword_id` (`keyword_id`),
    KEY `idx_text` (`text`(100)),
    KEY `idx_match_type` (`match_type`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 广告同步任务表
CREATE TABLE IF NOT EXISTS `ads_sync_tasks` (
    `id` varchar(36) NOT NULL,
    `account_id` varchar(36) NOT NULL,
    `task_type` varchar(20) DEFAULT 'incremental',
    `date_range` json DEFAULT NULL,
    `include_stats` boolean DEFAULT TRUE,
    `status` varchar(20) DEFAULT 'pending',
    `progress` int DEFAULT 0,
    `started_at` datetime DEFAULT NULL,
    `completed_at` datetime DEFAULT NULL,
    `duration` bigint DEFAULT NULL,
    `records_synced` int DEFAULT 0,
    `records_failed` int DEFAULT 0,
    `error_code` varchar(50) DEFAULT NULL,
    `error_message` text DEFAULT NULL,
    `token_cost` int DEFAULT 0,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_account_id` (`account_id`),
    KEY `idx_status` (`status`),
    KEY `idx_task_type` (`task_type`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认管理员账户（密码：admin123）
INSERT INTO `admin_accounts` (`id`, `username`, `password_hash`, `email`, `role`, `status`) 
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'd82494f05d691a560e01dec21c9c90d6', 'admin@example.com', 'SUPER_ADMIN', 'ACTIVE')
ON DUPLICATE KEY UPDATE `username` = `username`;

-- 插入默认Token套餐
INSERT INTO `token_packages` (`id`, `name`, `description`, `tokens`, `price`, `currency`, `sort_order`, `is_popular`) VALUES
('10000000-0000-0000-0000-000000000001', '入门套餐', '适合新手用户体验', 1000, 10.00, 'CNY', 1, FALSE),
('10000000-0000-0000-0000-000000000002', '标准套餐', '适合小型企业使用', 5000, 45.00, 'CNY', 2, TRUE),
('10000000-0000-0000-0000-000000000003', '专业套餐', '适合中大型企业', 10000, 80.00, 'CNY', 3, FALSE),
('10000000-0000-0000-0000-000000000004', '企业套餐', '适合高频使用用户', 50000, 350.00, 'CNY', 4, FALSE)
ON DUPLICATE KEY UPDATE `name` = `name`;