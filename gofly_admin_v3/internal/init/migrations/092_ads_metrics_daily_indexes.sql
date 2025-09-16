-- Composite indexes for ads_metrics_daily to accelerate common queries

-- 按账号+日期范围的查询
CREATE INDEX idx_ads_metrics_account_date
ON ads_metrics_daily (account_id, date);

-- 按用户+日期范围的查询
CREATE INDEX idx_ads_metrics_user_date
ON ads_metrics_daily (user_id, date);

-- 按账号+日期+活动+广告组的明细查询/聚合
CREATE INDEX idx_ads_metrics_account_date_campaign_adgroup
ON ads_metrics_daily (account_id, date, campaign_id, ad_group_id);
