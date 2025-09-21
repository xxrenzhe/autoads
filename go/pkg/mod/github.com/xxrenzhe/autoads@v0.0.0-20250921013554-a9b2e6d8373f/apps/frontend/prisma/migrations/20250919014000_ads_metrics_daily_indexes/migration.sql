-- Migrated from gofly_admin_v3/internal/init/migrations/092_ads_metrics_daily_indexes.sql

ALTER TABLE ads_metrics_daily
  ADD INDEX idx_ads_metrics_account_date (account_id, date),
  ADD INDEX idx_ads_metrics_user_date (user_id, date),
  ADD INDEX idx_ads_metrics_account_date_campaign_adgroup (account_id, date, campaign_id, ad_group_id),
  ALGORITHM=INPLACE,
  LOCK=NONE;
