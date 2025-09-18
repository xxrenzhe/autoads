-- Migrated from gofly_admin_v3/internal/init/migrations/091_ads_metrics_daily.sql

CREATE TABLE IF NOT EXISTS ads_metrics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  campaign_id VARCHAR(64) NOT NULL,
  ad_group_id VARCHAR(64) NOT NULL,
  device VARCHAR(32) NOT NULL,
  network VARCHAR(32) NOT NULL,
  clicks BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  cost_micros BIGINT NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  conv_value_micros BIGINT NOT NULL DEFAULT 0,
  vtc BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_ads_metrics_user (user_id),
  INDEX idx_ads_metrics_account (account_id),
  INDEX idx_ads_metrics_date (date),
  INDEX idx_ads_metrics_campaign (campaign_id),
  INDEX idx_ads_metrics_adgroup (ad_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
