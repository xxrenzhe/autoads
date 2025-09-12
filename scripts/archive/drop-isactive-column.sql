-- 直接执行SQL来移除isActive字段
-- 首先检查数据一致性

-- 验证没有不一致的数据
SELECT 
    COUNT(*) as inconsistent_count
FROM users 
WHERE 
    (status = 'ACTIVE' AND isActive = false) OR
    (status IN ('INACTIVE', 'SUSPENDED', 'BANNED') AND isActive = true);

-- 如果结果为0，则可以安全移除isActive字段

-- 创建备份
CREATE TABLE IF NOT EXISTS users_isactive_backup AS
SELECT id, email, status, isActive, NOW() as backup_time
FROM users;

-- 移除isActive字段
ALTER TABLE users DROP COLUMN IF EXISTS isActive;

-- 验证结果
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'isActive';

-- 应该返回空结果，表示字段已移除