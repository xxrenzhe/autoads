-- 确保 users.email 唯一索引
ALTER TABLE users ADD UNIQUE INDEX idx_users_email_unique (email);

