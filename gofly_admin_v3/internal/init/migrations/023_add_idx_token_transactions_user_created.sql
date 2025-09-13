-- 组合索引：优化按用户+时间分页
ALTER TABLE token_transactions ADD INDEX idx_user_created (user_id, created_at);

