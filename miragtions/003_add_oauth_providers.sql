-- ============================================
-- OAUTH PROVIDERS TABLE
-- Stores linked OAuth accounts (Google, Apple)
-- ============================================

-- Create oauth_providers table
CREATE TABLE IF NOT EXISTS oauth_providers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google' or 'apple'
    provider_id VARCHAR(255) NOT NULL, -- OAuth provider's user ID
    provider_email VARCHAR(255), -- Email from OAuth provider
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(user_id, provider), -- One provider per user
    UNIQUE(provider, provider_id) -- One provider ID per provider
);

-- Indexes for performance
CREATE INDEX idx_oauth_providers_user_id ON oauth_providers(user_id);
CREATE INDEX idx_oauth_providers_provider ON oauth_providers(provider);
CREATE INDEX idx_oauth_providers_provider_id ON oauth_providers(provider, provider_id);

-- Make password_hash nullable (OAuth users don't need password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add email_verified column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_oauth_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_providers_updated_at
    BEFORE UPDATE ON oauth_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_providers_updated_at();

-- Insert migration record
INSERT INTO schema_migrations (version, description) 
VALUES ('003', 'Add OAuth providers support')
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE oauth_providers IS 'Stores linked OAuth provider accounts (Google, Apple Sign-In)';
COMMENT ON COLUMN oauth_providers.provider IS 'OAuth provider name: google, apple';
COMMENT ON COLUMN oauth_providers.provider_id IS 'Unique user ID from OAuth provider';
COMMENT ON COLUMN oauth_providers.provider_email IS 'Email address from OAuth provider';
