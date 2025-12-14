-- ============================================
-- EMAIL RECEIPTS & INVOICING TABLES
-- Complete email and invoice management system
-- ============================================

-- ============================================
-- EMAIL RECEIPTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    
    -- Receipt details
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_number VARCHAR(50),
    
    -- Email info
    recipient_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    
    -- Content
    html_body TEXT,
    text_body TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sending', 'sent', 'bounced', 'failed', 'delivered'
    )),
    
    -- Delivery tracking
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    -- Metadata
    email_provider VARCHAR(50) DEFAULT 'sendgrid',
    provider_message_id VARCHAR(255),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_receipts_user ON email_receipts(user_id);
CREATE INDEX idx_email_receipts_payment ON email_receipts(payment_id);
CREATE INDEX idx_email_receipts_status ON email_receipts(status);
CREATE INDEX idx_email_receipts_sent ON email_receipts(sent_at DESC);
CREATE INDEX idx_email_receipts_number ON email_receipts(receipt_number);

-- ============================================
-- INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    
    -- Invoice details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date TIMESTAMP NOT NULL,
    due_date TIMESTAMP,
    
    -- Billing information
    bill_to_name VARCHAR(255) NOT NULL,
    bill_to_email VARCHAR(255) NOT NULL,
    bill_to_address TEXT,
    bill_to_city VARCHAR(100),
    bill_to_state VARCHAR(50),
    bill_to_zip VARCHAR(20),
    bill_to_country VARCHAR(100),
    
    -- Line items (stored as JSONB for flexibility)
    line_items JSONB NOT NULL,
    
    -- Totals
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Payment terms
    payment_method VARCHAR(50) NOT NULL,
    subscription_tier VARCHAR(10),
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')),
    
    -- Status
    invoice_status VARCHAR(20) DEFAULT 'issued' CHECK (invoice_status IN (
        'draft', 'issued', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled', 'refunded'
    )),
    
    -- Metadata
    currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    custom_data JSONB,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_payment ON invoices(payment_id);
CREATE INDEX idx_invoices_status ON invoices(invoice_status);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);

-- ============================================
-- INVOICE TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Template info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Company info
    company_name VARCHAR(255),
    company_logo_url TEXT,
    company_address TEXT,
    company_phone VARCHAR(20),
    company_email VARCHAR(255),
    company_website VARCHAR(255),
    
    -- Legal info
    tax_id VARCHAR(50),
    tax_label VARCHAR(50),
    
    -- Payment info
    payment_instructions TEXT,
    accepted_payment_methods TEXT,
    
    -- Styling
    color_scheme VARCHAR(50),
    custom_css TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- RECEIPT ATTACHMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS receipt_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES email_receipts(id) ON DELETE CASCADE,
    
    -- File info
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    file_url TEXT,
    
    -- Attachment type
    attachment_type VARCHAR(50) CHECK (attachment_type IN ('invoice', 'receipt', 'proforma', 'refund_slip')),
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_receipt_attachments_receipt ON receipt_attachments(receipt_id);

-- ============================================
-- RECEIPT LOGS TABLE (for auditing)
-- ============================================

CREATE TABLE IF NOT EXISTS receipt_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_receipt_id UUID NOT NULL REFERENCES email_receipts(id) ON DELETE CASCADE,
    
    -- Log details
    action VARCHAR(100) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    
    -- Event details
    event_data JSONB,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_receipt_logs_receipt ON receipt_logs(email_receipt_id);
CREATE INDEX idx_receipt_logs_action ON receipt_logs(action);

-- ============================================
-- BILLING HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS billing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Billing cycle info
    billing_cycle_start TIMESTAMP NOT NULL,
    billing_cycle_end TIMESTAMP NOT NULL,
    
    -- Amounts
    amount_charged DECIMAL(10, 2) NOT NULL,
    amount_refunded DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(10, 2),
    
    -- Items
    items_description TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),
    
    -- Links
    invoice_id UUID REFERENCES invoices(id),
    payment_id UUID REFERENCES payments(id),
    
    -- Metadata
    notes TEXT,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_history_user ON billing_history(user_id);
CREATE INDEX idx_billing_history_invoice ON billing_history(invoice_id);
CREATE INDEX idx_billing_history_cycle ON billing_history(billing_cycle_start DESC);

-- ============================================
-- ADD COLUMNS TO PAYMENTS TABLE
-- ============================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_email_status VARCHAR(20);

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_email_receipts_updated_at ON email_receipts;
CREATE TRIGGER update_email_receipts_updated_at
    BEFORE UPDATE ON email_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoice_templates_updated_at ON invoice_templates;
CREATE TRIGGER update_invoice_templates_updated_at
    BEFORE UPDATE ON invoice_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DEFAULT INVOICE TEMPLATE
-- ============================================

INSERT INTO invoice_templates (
    name,
    description,
    is_default,
    company_name,
    company_email,
    color_scheme,
    is_active
) VALUES (
    'Default Template',
    'Default invoice template for all transactions',
    TRUE,
    'Ultimate Sports AI',
    'billing@ultimatesportsai.com',
    'green',
    TRUE
) ON CONFLICT DO NOTHING;
