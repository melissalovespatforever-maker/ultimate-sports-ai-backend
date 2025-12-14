-- ============================================
-- ANNUAL SUBSCRIPTION PLANS
-- Support for monthly & annual billing cycles
-- ============================================

-- ============================================
-- ADD COLUMNS TO USERS TABLE
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly' 
    CHECK (billing_cycle IN ('monthly', 'annual'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS annual_renewal_date TIMESTAMP;

ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_discount_percentage INTEGER DEFAULT 0;

-- ============================================
-- UPDATE USERS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_billing_cycle ON users(billing_cycle);

-- ============================================
-- UPDATE PAYMENTS TABLE FOR BILLING CYCLES
-- ============================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly' 
    CHECK (billing_cycle IN ('monthly', 'annual'));

ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0;

-- ============================================
-- SUBSCRIPTION PLANS TABLE
-- Pricing configuration for different tiers
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Plan info
    tier VARCHAR(10) NOT NULL UNIQUE CHECK (tier IN ('pro', 'vip')),
    plan_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Monthly pricing
    monthly_price DECIMAL(10, 2) NOT NULL,
    
    -- Annual pricing with discount
    annual_price DECIMAL(10, 2) NOT NULL,
    annual_discount_percentage INTEGER DEFAULT 20 CHECK (annual_discount_percentage BETWEEN 0 AND 100),
    
    -- Features
    features JSONB DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON subscription_plans(tier);

-- ============================================
-- BILLING HISTORY TABLE
-- Track all billing cycles and adjustments
-- ============================================

CREATE TABLE IF NOT EXISTS billing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Billing info
    tier VARCHAR(10) NOT NULL CHECK (tier IN ('pro', 'vip')),
    billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    
    -- Pricing
    price_charged DECIMAL(10, 2) NOT NULL,
    regular_price DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    discount_percentage INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
        'pending', 'completed', 'failed', 'refunded', 'cancelled'
    )),
    
    -- Renewal info
    billing_start_date TIMESTAMP NOT NULL,
    billing_end_date TIMESTAMP NOT NULL,
    next_renewal_date TIMESTAMP,
    
    -- Payment reference
    payment_id UUID REFERENCES payments(id),
    paypal_transaction_id VARCHAR(255),
    
    -- Metadata
    notes TEXT,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_history_user ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_tier ON billing_history(tier);
CREATE INDEX IF NOT EXISTS idx_billing_history_billing_cycle ON billing_history(billing_cycle);
CREATE INDEX IF NOT EXISTS idx_billing_history_status ON billing_history(status);
CREATE INDEX IF NOT EXISTS idx_billing_history_renewal ON billing_history(next_renewal_date);

-- ============================================
-- ANNUAL PLAN CONVERSIONS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS plan_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Conversion details
    from_billing_cycle VARCHAR(20) NOT NULL CHECK (from_billing_cycle IN ('monthly', 'annual')),
    to_billing_cycle VARCHAR(20) NOT NULL CHECK (to_billing_cycle IN ('monthly', 'annual')),
    from_tier VARCHAR(10) NOT NULL,
    to_tier VARCHAR(10) NOT NULL,
    
    -- Financial impact
    savings_amount DECIMAL(10, 2) DEFAULT 0,
    credit_applied DECIMAL(10, 2) DEFAULT 0,
    
    -- Renewal dates
    old_renewal_date TIMESTAMP,
    new_renewal_date TIMESTAMP,
    
    -- Reasons for conversion
    conversion_reason VARCHAR(100) CHECK (conversion_reason IN (
        'user_initiated', 'promotion', 'trial_ended', 'upgrade', 'downgrade', 'admin_change'
    )),
    
    -- Dates
    converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plan_conversions_user ON plan_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_conversions_from_to ON plan_conversions(from_billing_cycle, to_billing_cycle);

-- ============================================
-- ANNUAL PLAN PROMOTIONS TABLE
-- Track promotional offers for annual plans
-- ============================================

CREATE TABLE IF NOT EXISTS annual_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Promotion info
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    
    -- Discount details
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL,
    max_discount_amount DECIMAL(10, 2),
    
    -- Applicable tiers
    applicable_tiers VARCHAR[] DEFAULT ARRAY['pro', 'vip'],
    
    -- Date range
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    
    -- Usage limits
    max_uses INTEGER,
    usage_count INTEGER DEFAULT 0,
    max_per_user INTEGER DEFAULT 1,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_by VARCHAR(100),
    notes TEXT,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_annual_promotions_code ON annual_promotions(code);
CREATE INDEX IF NOT EXISTS idx_annual_promotions_active ON annual_promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_annual_promotions_dates ON annual_promotions(start_date, end_date);

-- ============================================
-- PROMOTION USAGE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS promotion_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    promotion_id UUID NOT NULL REFERENCES annual_promotions(id) ON DELETE CASCADE,
    
    -- Usage details
    tier VARCHAR(10) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL,
    discount_amount DECIMAL(10, 2),
    
    -- Payment reference
    payment_id UUID REFERENCES payments(id),
    
    -- Dates
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_user ON promotion_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON promotion_usage(promotion_id);

-- ============================================
-- ANNUAL PLAN STATISTICS
-- ============================================

CREATE TABLE IF NOT EXISTS annual_plan_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Period
    period_date DATE UNIQUE NOT NULL,
    
    -- Conversion metrics
    monthly_to_annual_conversions INTEGER DEFAULT 0,
    annual_to_monthly_conversions INTEGER DEFAULT 0,
    new_annual_subscriptions INTEGER DEFAULT 0,
    
    -- Revenue metrics
    annual_revenue DECIMAL(15, 2) DEFAULT 0,
    monthly_revenue DECIMAL(15, 2) DEFAULT 0,
    total_savings_given DECIMAL(15, 2) DEFAULT 0,
    
    -- Tier metrics
    pro_annual_count INTEGER DEFAULT 0,
    vip_annual_count INTEGER DEFAULT 0,
    pro_monthly_count INTEGER DEFAULT 0,
    vip_monthly_count INTEGER DEFAULT 0,
    
    -- Retention
    annual_plan_retention_rate DECIMAL(5, 2) DEFAULT 0,
    monthly_plan_churn_rate DECIMAL(5, 2) DEFAULT 0,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_annual_plan_stats_date ON annual_plan_stats(period_date DESC);

-- ============================================
-- INSERT DEFAULT SUBSCRIPTION PLANS
-- ============================================

INSERT INTO subscription_plans (tier, plan_name, description, monthly_price, annual_price, annual_discount_percentage, features, is_active)
VALUES 
    (
        'pro',
        'PRO',
        'Advanced Analytics & Tools',
        49.99,
        479.92,  -- 12 * 49.99 * 0.8 = $479.92
        20,
        '[
            "10+ AI Coaches",
            "Advanced Analytics",
            "Live Odds from 30+ Sportsbooks",
            "Priority Support",
            "Export Reports",
            "Custom Alerts",
            "Bet History & Tracking",
            "Parlay Builder Tool"
        ]'::jsonb,
        TRUE
    ),
    (
        'vip',
        'VIP',
        'Premium AI & Exclusive Tools',
        99.99,
        959.92,  -- 12 * 99.99 * 0.8 = $959.92
        20,
        '[
            "Everything in PRO",
            "Exclusive AI Models",
            "Real-time Arbitrage Alerts",
            "VIP Discord Access",
            "Personal Strategy Sessions",
            "Early Feature Access",
            "Advanced Line Movement",
            "Injury Impact Reports",
            "Model Performance History"
        ]'::jsonb,
        TRUE
    )
ON CONFLICT (tier) DO NOTHING;

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_history_updated_at ON billing_history;
CREATE TRIGGER update_billing_history_updated_at
    BEFORE UPDATE ON billing_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_annual_promotions_updated_at ON annual_promotions;
CREATE TRIGGER update_annual_promotions_updated_at
    BEFORE UPDATE ON annual_promotions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_annual_plan_stats_updated_at ON annual_plan_stats;
CREATE TRIGGER update_annual_plan_stats_updated_at
    BEFORE UPDATE ON annual_plan_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- USEFUL QUERIES FOR ANALYSIS
-- ============================================

-- Get monthly vs annual subscription breakdown
-- SELECT 
--     billing_cycle,
--     tier,
--     COUNT(*) as count,
--     SUM(CASE WHEN subscription_status = 'active' THEN 1 ELSE 0 END) as active_count
-- FROM users
-- GROUP BY billing_cycle, tier;

-- Get annual savings given
-- SELECT 
--     SUM(subscription_discount_percentage) as total_discount,
--     AVG(subscription_discount_percentage) as avg_discount
-- FROM users
-- WHERE billing_cycle = 'annual' AND subscription_status = 'active';

-- Get conversion trends
-- SELECT 
--     DATE(converted_at) as date,
--     conversion_reason,
--     COUNT(*) as count,
--     SUM(savings_amount) as total_savings
-- FROM plan_conversions
-- GROUP BY DATE(converted_at), conversion_reason
-- ORDER BY date DESC;
