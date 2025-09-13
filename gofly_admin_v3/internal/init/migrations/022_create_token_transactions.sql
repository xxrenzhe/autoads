-- Token流水表，用于记录消费/充值/调整
CREATE TABLE IF NOT EXISTS token_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    user_id VARCHAR(100) NOT NULL,
    amount INT NOT NULL,            -- 正为增加，负为消费
    type VARCHAR(20) NOT NULL,      -- consume/purchase/refund/adjust
    service VARCHAR(50),
    action VARCHAR(50),
    ref_id VARCHAR(100),
    details TEXT,
    
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_created (created_at)
);

