-- ============================================
-- PHASE 2: SETTINGS MODULE
-- ============================================
-- Migration: 0004_settings_module.sql
-- Created: 2025-12-11
-- Description: Add Warehouses, Shifts, Productivity Standards v2

-- ============================================
-- 1. WAREHOUSE MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    max_capacity_per_day INTEGER DEFAULT 10000,
    max_staff INTEGER DEFAULT 100,
    storage_area_sqm REAL DEFAULT 1000,
    packing_stations INTEGER DEFAULT 50,
    field_table_stations INTEGER DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_warehouses_active ON warehouses(is_active);

-- ============================================
-- 2. SHIFT CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS shift_configurations (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT NOT NULL,
    shift_name TEXT NOT NULL, -- 'Ca Sáng', 'Ca Chiều', 'Ca Đêm'
    start_time TEXT NOT NULL, -- '08:00'
    end_time TEXT NOT NULL, -- '17:00'
    duration_hours REAL NOT NULL,
    capacity_percentage REAL DEFAULT 33.3, -- % of daily capacity
    days_of_week TEXT, -- JSON array: [1,2,3,4,5] = Mon-Fri
    break_minutes INTEGER DEFAULT 60,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shifts_warehouse ON shift_configurations(warehouse_id);

-- ============================================
-- 3. PRODUCTIVITY STANDARDS V2 (ENHANCED)
-- ============================================

CREATE TABLE IF NOT EXISTS productivity_standards_v2 (
    id TEXT PRIMARY KEY,
    
    -- Dimensions
    staff_level TEXT NOT NULL, -- 'BOXME', 'VETERAN', 'SEASONAL', 'CONTRACTOR'
    work_type TEXT NOT NULL, -- 'PICK', 'PACK', 'MOVING', 'RETURN', 'HANDOVER'
    product_group TEXT DEFAULT 'ALL', -- 'COSMETICS', 'FASHION', 'ELECTRONICS', 'BABY', 'FOOD', 'ALL'
    complexity TEXT DEFAULT 'SINGLE_SKU', -- 'SINGLE_SKU', 'MULTI_SKU', 'COMPLEX'
    weight_class TEXT DEFAULT 'LIGHT', -- 'LIGHT', 'MEDIUM', 'HEAVY', 'BULKY'
    
    -- Performance Metrics (orders per hour)
    orders_per_hour REAL DEFAULT 30,
    percentile_50 REAL DEFAULT 30, -- Median performance
    percentile_75 REAL DEFAULT 38, -- Good performance
    percentile_90 REAL DEFAULT 45, -- Excellent performance
    min_threshold REAL DEFAULT 20, -- Minimum acceptable
    max_threshold REAL DEFAULT 60, -- Maximum realistic
    
    -- Historical tracking
    last_calculated TEXT,
    sample_size INTEGER DEFAULT 0, -- Number of orders analyzed
    confidence_level REAL DEFAULT 0, -- Statistical confidence %
    
    -- Adjustments (multipliers)
    field_table_multiplier REAL DEFAULT 0.7, -- 30% faster
    prepack_multiplier REAL DEFAULT 0.5, -- 50% faster
    rush_multiplier REAL DEFAULT 1.2, -- 20% slower
    
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(staff_level, work_type, product_group, complexity, weight_class)
);

CREATE INDEX IF NOT EXISTS idx_productivity_staff ON productivity_standards_v2(staff_level);
CREATE INDEX IF NOT EXISTS idx_productivity_work ON productivity_standards_v2(work_type);
CREATE INDEX IF NOT EXISTS idx_productivity_active ON productivity_standards_v2(is_active);

-- ============================================
-- 4. CUSTOMER FORECAST SUBMISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS customer_forecast_submissions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    forecast_date TEXT NOT NULL,
    orders INTEGER NOT NULL,
    submitted_by TEXT,
    submitted_at TEXT DEFAULT (datetime('now')),
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forecast_submit_customer ON customer_forecast_submissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_forecast_submit_date ON customer_forecast_submissions(forecast_date);

-- ============================================
-- 5. FORECAST ADJUSTMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS forecast_adjustments (
    id TEXT PRIMARY KEY,
    forecast_id TEXT NOT NULL,
    adjusted_by TEXT NOT NULL,
    adjusted_at TEXT DEFAULT (datetime('now')),
    original_value INTEGER,
    adjusted_value INTEGER,
    reason TEXT,
    FOREIGN KEY (forecast_id) REFERENCES daily_forecasts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forecast_adj_id ON forecast_adjustments(forecast_id);

-- ============================================
-- 6. PREPACK REGISTRATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS prepack_registrations (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    target_date TEXT NOT NULL,
    sku_code TEXT NOT NULL,
    product_name TEXT,
    quantity_registered INTEGER DEFAULT 0,
    quantity_prepacked INTEGER DEFAULT 0,
    quantity_pending INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED'
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prepack_customer ON prepack_registrations(customer_id);
CREATE INDEX IF NOT EXISTS idx_prepack_date ON prepack_registrations(target_date);
CREATE INDEX IF NOT EXISTS idx_prepack_status ON prepack_registrations(status);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- New tables: 6
-- New indexes: 12
