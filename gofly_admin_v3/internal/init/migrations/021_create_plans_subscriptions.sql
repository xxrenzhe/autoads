-- 创建 plans/ subscriptions 表（若不存在），用于订阅管理

CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10,2) DEFAULT 0,
    duration INT DEFAULT 30, -- 天数
    features TEXT,           -- JSON
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    plan_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    started_at DATETIME,
    ended_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
);

