-- ============================================
-- PUSH NOTIFICATIONS TABLES
-- Native iOS/Android and Web Push support
-- ============================================

-- Create push_notification_devices table (iOS/Android native apps)
CREATE TABLE IF NOT EXISTS push_notification_devices (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token VARCHAR(500) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android')),
    device_info JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(user_id, device_token)
);

-- Create web_push_subscriptions table (Web Push API)
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    subscription JSONB NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(user_id, endpoint)
);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- Notification type preferences
    new_picks BOOLEAN DEFAULT true,
    game_results BOOLEAN DEFAULT true,
    tournament_updates BOOLEAN DEFAULT true,
    achievements BOOLEAN DEFAULT true,
    daily_deals BOOLEAN DEFAULT true,
    friend_requests BOOLEAN DEFAULT true,
    challenge_invites BOOLEAN DEFAULT true,
    marketing BOOLEAN DEFAULT false,
    
    -- System preferences
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    
    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create push_notification_log table (track sent notifications)
CREATE TABLE IF NOT EXISTS push_notification_log (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    type VARCHAR(50),
    device_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Delivery tracking
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON push_notification_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_active ON push_notification_devices(active);
CREATE INDEX IF NOT EXISTS idx_push_devices_platform ON push_notification_devices(platform);
CREATE INDEX IF NOT EXISTS idx_web_push_user_id ON web_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_web_push_active ON web_push_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON push_notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON push_notification_log(type);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON push_notification_log(sent_at DESC);

-- Update trigger for push_notification_devices
CREATE OR REPLACE FUNCTION update_push_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_devices_updated_at
    BEFORE UPDATE ON push_notification_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_push_devices_updated_at();

-- Update trigger for web_push_subscriptions
CREATE OR REPLACE FUNCTION update_web_push_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER web_push_updated_at
    BEFORE UPDATE ON web_push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_web_push_updated_at();

-- Update trigger for notification_preferences
CREATE OR REPLACE FUNCTION update_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_prefs_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_prefs_updated_at();

-- Function to cleanup old inactive devices (run periodically)
CREATE OR REPLACE FUNCTION cleanup_inactive_devices()
RETURNS void AS $$
BEGIN
    -- Deactivate devices not updated in 90 days
    UPDATE push_notification_devices
    SET active = false
    WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    AND active = true;
    
    UPDATE web_push_subscriptions
    SET active = false
    WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    AND active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's active notification channels
CREATE OR REPLACE FUNCTION get_user_notification_channels(p_user_id UUID)
RETURNS TABLE(
    has_push BOOLEAN,
    has_web_push BOOLEAN,
    device_count INTEGER,
    web_push_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM push_notification_devices WHERE user_id = p_user_id AND active = true) as has_push,
        EXISTS(SELECT 1 FROM web_push_subscriptions WHERE user_id = p_user_id AND active = true) as has_web_push,
        (SELECT COUNT(*)::INTEGER FROM push_notification_devices WHERE user_id = p_user_id AND active = true) as device_count,
        (SELECT COUNT(*)::INTEGER FROM web_push_subscriptions WHERE user_id = p_user_id AND active = true) as web_push_count;
END;
$$ LANGUAGE plpgsql;

-- Insert migration record
INSERT INTO schema_migrations (version, description) 
VALUES ('009', 'Add push notifications support (iOS/Android/Web)')
ON CONFLICT (version) DO NOTHING;

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;
