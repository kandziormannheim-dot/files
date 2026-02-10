-- ================================================
-- Affiliate Business Automation Database Schema
-- PostgreSQL Setup
-- ================================================

-- Create database
CREATE DATABASE affiliate_db;

-- Connect to the database
\c affiliate_db

-- ===== AFFILIATES TABLE =====
CREATE TABLE affiliates (
    id SERIAL PRIMARY KEY,
    program_name VARCHAR(255) NOT NULL UNIQUE,
    niche VARCHAR(100) NOT NULL,
    commission_type VARCHAR(50), -- percentage, fixed, recurring
    commission_value DECIMAL(10, 2),
    affiliate_link TEXT,
    tracking_id VARCHAR(255),
    network VARCHAR(100), -- awin, shareasale, cj, direct
    status VARCHAR(20), -- active, inactive, pending
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'pending'))
);

-- ===== AFFILIATE LINKS TABLE =====
CREATE TABLE affiliate_links (
    id SERIAL PRIMARY KEY,
    affiliate_id INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    short_url VARCHAR(255),
    long_url TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    clicks_count INTEGER DEFAULT 0,
    conversions_count INTEGER DEFAULT 0,
    last_clicked TIMESTAMP
);

-- ===== CONTENT TABLE =====
CREATE TABLE content (
    id SERIAL PRIMARY KEY,
    niche VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL UNIQUE,
    content_type VARCHAR(50), -- blog_post, review, guide, comparison, listicle
    wordpress_post_id INTEGER,
    wordpress_url TEXT,
    word_count INTEGER,
    seo_keywords TEXT, -- JSON or comma-separated
    include_affiliate_links BOOLEAN DEFAULT true,
    published_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20), -- published, scheduled, draft
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by VARCHAR(50), -- openclaw, manual
    CONSTRAINT valid_status CHECK (status IN ('published', 'scheduled', 'draft'))
);

-- ===== CONTENT AFFILIATE LINKS JUNCTION TABLE =====
CREATE TABLE content_affiliate_links (
    id SERIAL PRIMARY KEY,
    content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    affiliate_link_id INTEGER NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
    link_position VARCHAR(50), -- beginning, middle, end, cta
    anchor_text VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== TRAFFIC TABLE =====
CREATE TABLE traffic (
    id SERIAL PRIMARY KEY,
    niche VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    visitors INTEGER,
    page_views INTEGER,
    bounce_rate DECIMAL(5, 2),
    avg_session_duration INTEGER,
    traffic_source VARCHAR(100), -- organic, social, direct, referral
    source_detail VARCHAR(255), -- specific social platform, referrer domain
    device_type VARCHAR(50), -- mobile, desktop, tablet
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (niche, date, traffic_source)
);

-- ===== AFFILIATE CLICKS TABLE =====
CREATE TABLE affiliate_clicks (
    id SERIAL PRIMARY KEY,
    affiliate_link_id INTEGER NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
    niche VARCHAR(100) NOT NULL,
    content_id INTEGER REFERENCES content(id) ON DELETE SET NULL,
    traffic_source VARCHAR(100),
    device_type VARCHAR(50),
    country VARCHAR(2),
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== CONVERSIONS TABLE =====
CREATE TABLE conversions (
    id SERIAL PRIMARY KEY,
    affiliate_id INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    affiliate_link_id INTEGER NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
    niche VARCHAR(100) NOT NULL,
    content_id INTEGER REFERENCES content(id) ON DELETE SET NULL,
    conversion_value DECIMAL(10, 2),
    commission_earned DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'EUR',
    order_id VARCHAR(255),
    converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20), -- pending, approved, rejected, paid
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'paid'))
);

-- ===== DAILY METRICS TABLE =====
CREATE TABLE daily_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    niche VARCHAR(100),
    visitors INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue DECIMAL(10, 2) DEFAULT 0,
    commission_earned DECIMAL(10, 2) DEFAULT 0,
    affiliate_program VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (date, niche, affiliate_program)
);

-- ===== SOCIAL MEDIA POSTS TABLE =====
CREATE TABLE social_media_posts (
    id SERIAL PRIMARY KEY,
    niche VARCHAR(100) NOT NULL,
    content_id INTEGER REFERENCES content(id) ON DELETE SET NULL,
    platform VARCHAR(50), -- linkedin, reddit, facebook, twitter, pinterest
    post_id VARCHAR(255),
    post_url TEXT,
    post_text TEXT,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== EMAIL SUBSCRIBERS TABLE =====
CREATE TABLE email_subscribers (
    id SERIAL PRIMARY KEY,
    niche VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    status VARCHAR(20), -- active, unsubscribed, bounced
    source VARCHAR(100), -- website, social, referral
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_email_sent TIMESTAMP,
    email_count INTEGER DEFAULT 0,
    UNIQUE (niche, email),
    CONSTRAINT valid_status CHECK (status IN ('active', 'unsubscribed', 'bounced'))
);

-- ===== EMAIL CAMPAIGNS TABLE =====
CREATE TABLE email_campaigns (
    id SERIAL PRIMARY KEY,
    niche VARCHAR(100) NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    subject_line VARCHAR(255),
    content_id INTEGER REFERENCES content(id) ON DELETE SET NULL,
    sent_date TIMESTAMP,
    recipient_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    unsubscribe_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== WORKFLOW EXECUTION LOG TABLE =====
CREATE TABLE workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_name VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(100), -- wordpress_publisher, social_distributor, affiliate_tracker
    status VARCHAR(20), -- success, failure, partial
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    articles_processed INTEGER DEFAULT 0,
    articles_published INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_message TEXT,
    log_data JSONB,
    CONSTRAINT valid_status CHECK (status IN ('success', 'failure', 'partial'))
);

-- ===== SEO RANKINGS TABLE =====
CREATE TABLE seo_rankings (
    id SERIAL PRIMARY KEY,
    niche VARCHAR(100) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    rank_position INTEGER,
    search_volume INTEGER,
    difficulty_score DECIMAL(5, 2),
    url TEXT,
    checked_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (niche, keyword, checked_date)
);

-- ===== SYSTEM HEALTH TABLE =====
CREATE TABLE system_health (
    id SERIAL PRIMARY KEY,
    check_name VARCHAR(255) NOT NULL,
    status VARCHAR(20), -- healthy, warning, critical
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB,
    CONSTRAINT valid_status CHECK (status IN ('healthy', 'warning', 'critical'))
);

-- ===== BACKUP LOG TABLE =====
CREATE TABLE backup_logs (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(50), -- database, wordpress, full
    backup_location VARCHAR(255),
    backup_size_bytes BIGINT,
    status VARCHAR(20), -- success, failure, partial
    backed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    restored_at TIMESTAMP,
    error_message TEXT,
    CONSTRAINT valid_status CHECK (status IN ('success', 'failure', 'partial'))
);

-- ===== INDEXES FOR PERFORMANCE =====
CREATE INDEX idx_affiliates_niche ON affiliates(niche);
CREATE INDEX idx_affiliates_status ON affiliates(status);
CREATE INDEX idx_affiliate_links_affiliate_id ON affiliate_links(affiliate_id);
CREATE INDEX idx_content_niche ON content(niche);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_published_date ON content(published_date);
CREATE INDEX idx_traffic_niche_date ON traffic(niche, date);
CREATE INDEX idx_traffic_source ON traffic(traffic_source);
CREATE INDEX idx_clicks_affiliate_link_id ON affiliate_clicks(affiliate_link_id);
CREATE INDEX idx_clicks_content_id ON affiliate_clicks(content_id);
CREATE INDEX idx_clicks_clicked_at ON affiliate_clicks(clicked_at);
CREATE INDEX idx_conversions_affiliate_id ON conversions(affiliate_id);
CREATE INDEX idx_conversions_converted_at ON conversions(converted_at);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_niche ON daily_metrics(niche);
CREATE INDEX idx_social_posts_platform ON social_media_posts(platform);
CREATE INDEX idx_social_posts_niche ON social_media_posts(niche);
CREATE INDEX idx_subscribers_email ON email_subscribers(email);
CREATE INDEX idx_subscribers_niche ON email_subscribers(niche);
CREATE INDEX idx_workflow_exec_type ON workflow_executions(workflow_type);
CREATE INDEX idx_workflow_exec_status ON workflow_executions(status);
CREATE INDEX idx_seo_rankings_niche_keyword ON seo_rankings(niche, keyword);
CREATE INDEX idx_backup_logs_date ON backup_logs(backed_up_at);

-- ===== VIEWS FOR REPORTING =====

-- Monthly Revenue by Affiliate
CREATE VIEW monthly_revenue AS
SELECT 
    DATE_TRUNC('month', converted_at)::DATE as month,
    affiliate_id,
    a.program_name,
    SUM(commission_earned) as total_commission,
    COUNT(*) as conversion_count
FROM conversions c
JOIN affiliates a ON c.affiliate_id = a.id
WHERE status = 'approved' OR status = 'paid'
GROUP BY DATE_TRUNC('month', converted_at), affiliate_id, a.program_name
ORDER BY month DESC;

-- Daily Summary
CREATE VIEW daily_summary AS
SELECT 
    d.date,
    d.niche,
    SUM(d.visitors) as total_visitors,
    SUM(d.clicks) as total_clicks,
    SUM(d.conversions) as total_conversions,
    SUM(d.commission_earned) as total_commission,
    ROUND(CAST(SUM(d.conversions) AS NUMERIC) / NULLIF(SUM(d.clicks), 0) * 100, 2) as conversion_rate
FROM daily_metrics d
GROUP BY d.date, d.niche
ORDER BY d.date DESC;

-- Content Performance
CREATE VIEW content_performance AS
SELECT 
    c.id,
    c.title,
    c.niche,
    COUNT(DISTINCT ac.affiliate_clicks.id) as total_clicks,
    COUNT(DISTINCT conv.id) as total_conversions,
    SUM(conv.commission_earned) as total_commission,
    c.published_date
FROM content c
LEFT JOIN affiliate_clicks ac ON c.id = ac.content_id
LEFT JOIN conversions conv ON c.id = conv.content_id
WHERE c.status = 'published'
GROUP BY c.id, c.title, c.niche, c.published_date
ORDER BY total_conversions DESC;

-- ===== CREATE USER =====
CREATE ROLE affiliate_user WITH LOGIN PASSWORD 'change_me_password';
GRANT CONNECT ON DATABASE affiliate_db TO affiliate_user;
GRANT USAGE ON SCHEMA public TO affiliate_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO affiliate_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO affiliate_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO affiliate_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO affiliate_user;

-- ===== SETUP COMPLETE =====
-- Use these commands to connect:
-- psql -U affiliate_user -d affiliate_db -h localhost
-- Password: (see above)

