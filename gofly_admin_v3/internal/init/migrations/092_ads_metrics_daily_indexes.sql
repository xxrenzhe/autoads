-- 在线创建复合索引，尽量减少锁（MySQL 8+）
-- 说明：使用 ALTER TABLE + ALGORITHM=INPLACE, LOCK=NONE，
-- 在大表上可显著降低阻塞（仍可能短暂等待元数据锁）。
ALTER TABLE ads_metrics_daily
  ADD INDEX idx_ads_metrics_account_date (account_id, date),
  ADD INDEX idx_ads_metrics_user_date (user_id, date),
  ADD INDEX idx_ads_metrics_account_date_campaign_adgroup (account_id, date, campaign_id, ad_group_id),
  ALGORITHM=INPLACE,
  LOCK=NONE;
