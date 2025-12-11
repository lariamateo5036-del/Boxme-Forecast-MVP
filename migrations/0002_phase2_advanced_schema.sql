-- ============================================
-- PHASE 2: ADVANCED SCHEMA
-- ============================================
-- Migration: 0002_phase2_advanced_schema.sql
-- Created: 2025-12-11
-- Description: Add customer config, enhanced order model, platform SLA, priority queue

-- ============================================
-- 1. CUSTOMER CONFIGURATION SYSTEM
-- ============================================

-- Customer master config
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    account_manager_id TEXT,
    primary_platform TEXT,
    tier TEXT DEFAULT 'STANDARD', -- 'PREMIUM', 'STANDARD', 'BASIC'
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Customer product mix
CREATE TABLE IF NOT EXISTS customer_product_mix (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    category_code TEXT NOT NULL, -- 'COSMETICS', 'BABY', 'FASHION', 'ELECTRONICS', etc.
    category_name TEXT,
    percentage REAL DEFAULT 0, -- 0-100
    avg_processing_minutes REAL DEFAULT 2.5,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Customer operational config
CREATE TABLE IF NOT EXISTS customer_operations (
    id TEXT PRIMARY KEY,
    customer_id TEXT UNIQUE NOT NULL,
    
    -- Field Table config
    field_table_enabled INTEGER DEFAULT 0,
    field_table_max_sku INTEGER DEFAULT 1,
    field_table_max_items INTEGER DEFAULT 5,
    field_table_max_weight REAL DEFAULT 1.0,
    field_table_hero_skus TEXT, -- JSON array: ["SKU001", "SKU002"]
    
    -- Pre-pack config
    prepack_enabled INTEGER DEFAULT 0,
    prepack_categories TEXT, -- JSON array: ["COSMETICS", "BABY"]
    prepack_min_weight REAL DEFAULT 5.0,
    prepack_weekly_quota INTEGER DEFAULT 0,
    
    -- Standard packing
    requires_camera INTEGER DEFAULT 1,
    quality_check_level TEXT DEFAULT 'STANDARD', -- 'BASIC', 'STANDARD', 'PREMIUM'
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Customer SLA config
CREATE TABLE IF NOT EXISTS customer_sla (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'SHOPEE', 'LAZADA', 'TIKTOK', etc.
    tier TEXT DEFAULT 'STANDARD', -- 'MALL', 'STANDARD', 'BASIC', 'INSTANT'
    cutoff_time TEXT DEFAULT '21:00',
    internal_buffer_hours REAL DEFAULT 2,
    priority_level INTEGER DEFAULT 3, -- 1 (highest) to 5 (lowest)
    can_delay_non_urgent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================
-- 2. PLATFORM SLA CONFIGURATION
-- ============================================

-- Platform SLA master
CREATE TABLE IF NOT EXISTS platform_sla_config (
    id TEXT PRIMARY KEY,
    platform_code TEXT UNIQUE NOT NULL,
    platform_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Service tiers per platform
CREATE TABLE IF NOT EXISTS platform_service_tiers (
    id TEXT PRIMARY KEY,
    platform_id TEXT NOT NULL,
    tier_code TEXT NOT NULL,
    tier_name TEXT,
    cutoff_time TEXT,
    processing_deadline_type TEXT, -- 'SAME_DAY', 'NEXT_DAY', 'HOURS'
    processing_deadline_value INTEGER,
    internal_buffer_hours REAL DEFAULT 2,
    special_rules TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (platform_id) REFERENCES platform_sla_config(id) ON DELETE CASCADE,
    UNIQUE(platform_id, tier_code)
);

-- Platform quality metrics
CREATE TABLE IF NOT EXISTS platform_quality_requirements (
    id TEXT PRIMARY KEY,
    platform_id TEXT NOT NULL,
    metric_code TEXT NOT NULL,
    metric_name TEXT,
    target_value REAL,
    comparison_operator TEXT, -- 'LT', 'GT', 'LTE', 'GTE'
    measurement_period TEXT, -- 'DAILY', 'WEEKLY', 'MONTHLY'
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (platform_id) REFERENCES platform_sla_config(id) ON DELETE CASCADE
);

-- Platform notes
CREATE TABLE IF NOT EXISTS platform_notes (
    id TEXT PRIMARY KEY,
    platform_id TEXT NOT NULL,
    note_text TEXT,
    importance_level TEXT DEFAULT 'INFO', -- 'CRITICAL', 'WARNING', 'INFO'
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (platform_id) REFERENCES platform_sla_config(id) ON DELETE CASCADE
);

-- ============================================
-- 3. ENHANCED ORDER MODEL
-- ============================================

-- Add new columns to orders_history (existing table)
-- Note: SQLite doesn't support multiple ALTER TABLE in one statement

-- Customer dimension
ALTER TABLE orders_history ADD COLUMN customer_id TEXT;

-- Weight dimensions
ALTER TABLE orders_history ADD COLUMN weight_kg REAL DEFAULT 0.5;
ALTER TABLE orders_history ADD COLUMN weight_class TEXT DEFAULT 'LIGHT'; -- 'LIGHT', 'MEDIUM', 'HEAVY', 'BULKY'

-- Complexity dimensions
ALTER TABLE orders_history ADD COLUMN sku_count INTEGER DEFAULT 1;
ALTER TABLE orders_history ADD COLUMN item_count INTEGER DEFAULT 1;
ALTER TABLE orders_history ADD COLUMN complexity TEXT DEFAULT 'SINGLE_SKU'; -- 'SINGLE_SKU', 'MULTI_SKU', 'COMPLEX'

-- Packing method
ALTER TABLE orders_history ADD COLUMN packing_method TEXT DEFAULT 'STANDARD'; -- 'STANDARD', 'FIELD_TABLE', 'PREPACK'

-- Priority & SLA
ALTER TABLE orders_history ADD COLUMN priority TEXT DEFAULT 'STANDARD'; -- 'INSTANT', 'SAME_DAY', 'NEXT_DAY', 'STANDARD', 'ECONOMY'
ALTER TABLE orders_history ADD COLUMN is_mall INTEGER DEFAULT 0;
ALTER TABLE orders_history ADD COLUMN platform_tier TEXT;
ALTER TABLE orders_history ADD COLUMN sla_deadline_internal TEXT;

-- Performance tracking
ALTER TABLE orders_history ADD COLUMN actual_packing_minutes REAL;
ALTER TABLE orders_history ADD COLUMN carrier_code TEXT;

-- Create indexes for new dimensions
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_weight_class ON orders_history(weight_class);
CREATE INDEX IF NOT EXISTS idx_orders_complexity ON orders_history(complexity);
CREATE INDEX IF NOT EXISTS idx_orders_packing_method ON orders_history(packing_method);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders_history(priority);
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders_history(carrier_code);

-- ============================================
-- 4. PRIORITY QUEUE SYSTEM
-- ============================================

-- Priority buckets configuration
CREATE TABLE IF NOT EXISTS priority_buckets (
    id TEXT PRIMARY KEY,
    priority INTEGER NOT NULL, -- 1 = highest priority
    name TEXT NOT NULL,
    description TEXT,
    processing_order TEXT DEFAULT 'FIFO', -- 'FIFO', 'DEADLINE', 'CUSTOMER_PRIORITY'
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Priority criteria rules
CREATE TABLE IF NOT EXISTS priority_criteria (
    id TEXT PRIMARY KEY,
    bucket_id TEXT NOT NULL,
    criterion_type TEXT NOT NULL, -- 'SERVICE_TYPE', 'PLATFORM', 'HOURS_TO_DEADLINE', 'FLAG'
    criterion_value TEXT, -- JSON config
    weight REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (bucket_id) REFERENCES priority_buckets(id) ON DELETE CASCADE
);

-- Runtime queue state (for real-time monitoring)
CREATE TABLE IF NOT EXISTS order_queue_state (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    bucket_id TEXT NOT NULL,
    priority_score REAL DEFAULT 0,
    assigned_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    status TEXT DEFAULT 'QUEUED', -- 'QUEUED', 'PROCESSING', 'COMPLETED', 'CANCELLED'
    FOREIGN KEY (bucket_id) REFERENCES priority_buckets(id)
);

-- Create indexes for queue queries
CREATE INDEX IF NOT EXISTS idx_queue_bucket ON order_queue_state(bucket_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON order_queue_state(status);
CREATE INDEX IF NOT EXISTS idx_queue_assigned ON order_queue_state(assigned_at);

-- ============================================
-- 5. CARRIER PICKUP WINDOWS (Phase 3 prep)
-- ============================================

CREATE TABLE IF NOT EXISTS carrier_pickup_windows (
    id TEXT PRIMARY KEY,
    carrier_code TEXT NOT NULL,
    carrier_name TEXT,
    day_of_week INTEGER, -- 0=Sunday, 1=Monday, ..., 6=Saturday
    pickup_time TEXT, -- '14:00'
    capacity INTEGER DEFAULT 500,
    service_types TEXT, -- JSON array: ["STANDARD", "EXPRESS"]
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_carrier_day ON carrier_pickup_windows(carrier_code, day_of_week);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Total new tables: 13
-- Total altered tables: 1 (orders_history)
-- Total new indexes: 9
