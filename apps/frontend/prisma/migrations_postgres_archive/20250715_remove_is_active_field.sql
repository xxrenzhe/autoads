-- 数据库迁移：移除 isActive 字段，统一使用 status 字段
-- 
-- 这个迁移脚本将：
-- 1. 验证所有数据的 status 和 isActive 是否一致
-- 2. 移除 isActive 字段
-- 3. 更新所有相关的代码引用

-- 首先验证数据一致性
DO $$
DECLARE
    inconsistent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO inconsistent_count
    FROM users
    WHERE 
        (status = 'ACTIVE' AND isActive = false) OR
        (status IN ('INACTIVE', 'SUSPENDED', 'BANNED') AND isActive = true);
    
    IF inconsistent_count > 0 THEN
        RAISE EXCEPTION '发现 % 个状态不一致的用户，请先运行修复脚本', inconsistent_count;
    END IF;
    
    RAISE NOTICE '✅ 数据一致性验证通过';
END $$;

-- 创建备份表（可选）
CREATE TABLE users_backup_active_column AS
SELECT 
    id,
    status,
    isActive,
    NOW() as backup_created_at
FROM users;

-- 移除 isActive 字段
ALTER TABLE users DROP COLUMN IF EXISTS isActive;

-- 添加注释说明状态字段的含义
COMMENT ON COLUMN users.status IS '账户状态: ACTIVE(正常), INACTIVE(未激活), SUSPENDED(暂停), BANNED(封禁)';

-- 创建视图以向后兼容（如果需要）
CREATE OR REPLACE VIEW user_status_view AS
SELECT 
    u.*,
    CASE 
        WHEN u.status = 'ACTIVE' THEN true
        ELSE false 
    END as isActive
FROM users u;

-- 记录迁移完成
DO $$
BEGIN
    RAISE NOTICE '✅ 迁移完成：isActive 字段已移除';
    RAISE NOTICE 'ℹ️  请使用 status 字段判断账户状态';
    RAISE NOTICE 'ℹ️  可以使用 getAccountStatus() 函数统一处理状态逻辑';
END $$;