-- Create user_profiles table for personal information
CREATE TABLE user_profiles (
    id VARCHAR(191) PRIMARY KEY DEFAULT (GENERATE_UUID()),
    user_id VARCHAR(191) NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'zh-CN',
    theme VARCHAR(20) DEFAULT 'light',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create user_preferences table for user settings
CREATE TABLE user_preferences (
    id VARCHAR(191) PRIMARY KEY DEFAULT (GENERATE_UUID()),
    user_id VARCHAR(191) NOT NULL UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    marketing_emails BOOLEAN DEFAULT false,
    security_alerts BOOLEAN DEFAULT true,
    weekly_reports BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create user_statistics table for user metrics
CREATE TABLE user_statistics (
    id VARCHAR(191) PRIMARY KEY DEFAULT (GENERATE_UUID()),
    user_id VARCHAR(191) NOT NULL UNIQUE,
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    current_session_id VARCHAR(191),
    total_tokens_used INTEGER DEFAULT 0,
    monthly_tokens_used INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    feature_usage_stats JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Move data from users table to new tables
INSERT INTO user_profiles (user_id, first_name, last_name, avatar_url, created_at, updated_at)
SELECT 
    id,
    CASE 
        WHEN name IS NOT NULL THEN SUBSTRING(name FROM 1 FOR POSITION(' ' IN name) - 1)
        ELSE NULL
    END as first_name,
    CASE 
        WHEN name IS NOT NULL AND POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
        ELSE name
    END as last_name,
    avatar,
    created_at,
    updated_at
FROM users 
WHERE id IN (SELECT id FROM users WHERE name IS NOT NULL OR avatar IS NOT NULL);

INSERT INTO user_preferences (user_id, preferences, created_at, updated_at)
SELECT 
    id,
    COALESCE(preferences, '{}'),
    created_at,
    updated_at
FROM users 
WHERE preferences IS NOT NULL;

INSERT INTO user_statistics (user_id, login_count, last_login_at, created_at, updated_at)
SELECT 
    id,
    login_count,
    last_login_at,
    created_at,
    updated_at
FROM users 
WHERE login_count > 0 OR last_login_at IS NOT NULL;

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_statistics_user_id ON user_statistics(user_id);

-- Create a view for easy user data retrieval
CREATE VIEW user_full_view AS
SELECT 
    u.id,
    u.email,
    u.role,
    u.status,
    u.email_verified,
    u.is_active,
    u.created_at,
    u.updated_at,
    up.first_name,
    up.last_name,
    CONCAT(up.first_name, ' ', up.last_name) as full_name,
    up.bio,
    up.avatar_url as avatar,
    up.timezone,
    up.language,
    up.theme,
    uprefs.email_notifications,
    uprefs.push_notifications,
    uprefs.marketing_emails,
    uprefs.security_alerts,
    uprefs.weekly_reports,
    uprefs.preferences as custom_preferences,
    us.login_count,
    us.last_login_at,
    us.current_session_id,
    us.total_tokens_used,
    us.monthly_tokens_used,
    us.api_calls_count,
    us.feature_usage_stats
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN user_preferences uprefs ON u.id = uprefs.user_id
LEFT JOIN user_statistics us ON u.id = us.user_id;

-- Create function to update user statistics on login
CREATE OR REPLACE FUNCTION update_user_login_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_statistics (user_id, login_count, last_login_at, current_session_id, updated_at)
    VALUES (
        NEW.id,
        COALESCE((SELECT login_count FROM user_statistics WHERE user_id = NEW.id), 0) + 1,
        NOW(),
        NULL, -- Will be set when session is created
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        login_count = user_statistics.login_count + 1,
        last_login_at = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stats update
DROP TRIGGER IF EXISTS update_user_stats ON users;
CREATE TRIGGER update_user_stats
    AFTER UPDATE OF last_login_at ON users
    FOR EACH ROW
    WHEN (OLD.last_login_at IS DISTINCT FROM NEW.last_login_at AND NEW.last_login_at IS NOT NULL)
    EXECUTE FUNCTION update_user_login_stats();

-- Add comments
COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON TABLE user_preferences IS 'User notification and preference settings';
COMMENT ON TABLE user_statistics IS 'User activity and usage statistics';