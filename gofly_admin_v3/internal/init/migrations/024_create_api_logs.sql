-- Create API access logs table
CREATE TABLE IF NOT EXISTS `api_access_logs` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `endpoint` VARCHAR(255) NOT NULL,
  `method` VARCHAR(16) NOT NULL,
  `status_code` INT NOT NULL,
  `duration_ms` INT NOT NULL,
  `ip_address` VARCHAR(64) NOT NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_api_access_endpoint_created` (`endpoint`, `created_at`),
  INDEX `idx_api_access_user_created` (`user_id`, `created_at`),
  INDEX `idx_api_access_status_created` (`status_code`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

