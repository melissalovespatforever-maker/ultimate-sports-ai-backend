-- ============================================
-- PAYPAL WEBHOOK INTEGRATION TABLES
-- Payment verification and subscription tracking
-- ============================================

-- ============================================
-- PAYMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- PayPal details
    paypal_subscription_id VARCHAR(255),
    payment_id VARCHAR(255) UNIQUE,
    order_id VARCHAR(255),
    
    -- Payment info
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    tier VARCHAR(10) CHECK (tier IN ('pro', 'vip')),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'completed', 'failed', 'refunded', 
        'disputed', 'processing', 'expired'
    )),
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Metadata
    description TEXT,
    custom_data JSONB,
    
    CONSTRAINT unique_payment_per_user_time UNIQUE (user_id, payment_id)
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_paypal_subscription ON payments(paypal_subscription_id);
CREATE INDEX idx_payments_created ON payments(created_at DESC);

-- ============================================
-- SUBSCRIPTION CHANGES LOG
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Change details
    from_tier VARCHAR(10),
    to_tier VARCHAR(10) NOT NULL,
    reason VARCHAR(100) NOT NULL CHECK (reason IN (
        'upgrade', 'downgrade', 'cancellation', 'expiration',
        'payment_failed', 'admin_action', 'refund'
    )),
    
    -- Subscription info
    paypal_subscription_id VARCHAR(255),
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    notes TEXT,
    admin_id UUID REFERENCES users(id)
);

CREATE INDEX idx_subscription_changes_user ON subscription_changes(user_id);
CREATE INDEX idx_subscription_changes_created ON subscription_changes(created_at DESC);

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- ADD COLUMNS TO USERS TABLE
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_paypal_subscription ON users(paypal_subscription_id);

-- ============================================
-- WEBHOOK EVENTS LOG (for debugging)
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) UNIQUE,
    
    -- Processing
    status VARCHAR(20) DEFAULT 'received' CHECK (status IN (
        'received', 'processing', 'processed', 'failed', 'ignored'
    )),
    
    -- Data
    payload JSONB,
    error_message TEXT,
    
    -- Dates
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP
);

CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_received ON webhook_events(received_at DESC);

-- ============================================
-- REFUNDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Payment reference
    payment_id UUID NOT NULL REFERENCES payments(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Refund details
    amount DECIMAL(10, 2) NOT NULL,
    refund_id VARCHAR(255) UNIQUE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'completed', 'failed', 'cancelled'
    )),
    
    -- Reason
    reason VARCHAR(100) NOT NULL,
    notes TEXT,
    requested_by UUID REFERENCES users(id),
    
    -- Dates
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refunds_user ON refunds(user_id);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_status ON refunds(status);

-- ============================================
-- UPDATE TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
