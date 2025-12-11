-- ============================================
-- SETTINGS MODULE SEED DATA
-- ============================================

-- ============================================
-- 1. WAREHOUSES
-- ============================================

INSERT OR REPLACE INTO warehouses (id, code, name, location, max_capacity_per_day, max_staff, storage_area_sqm, packing_stations, field_table_stations, is_active) VALUES
('wh-hcm-main', 'HCM-MAIN', 'Boxme HCM (Kho Chính)', 'Quận 9, TP.HCM', 15000, 150, 2500, 80, 20, 1),
('wh-hanoi', 'HN-01', 'Boxme Hanoi', 'Long Biên, Hà Nội', 8000, 80, 1500, 50, 10, 1),
('wh-danang', 'DN-01', 'Boxme Đà Nẵng', 'Hòa Vang, Đà Nẵng', 5000, 50, 1000, 30, 5, 1);

-- ============================================
-- 2. SHIFT CONFIGURATIONS
-- ============================================

-- HCM Main Warehouse
INSERT OR REPLACE INTO shift_configurations (id, warehouse_id, shift_name, start_time, end_time, duration_hours, capacity_percentage, days_of_week, break_minutes, is_active) VALUES
('shift-hcm-morning', 'wh-hcm-main', 'Ca Sáng', '08:00', '17:00', 9, 50, '[1,2,3,4,5,6,7]', 60, 1),
('shift-hcm-afternoon', 'wh-hcm-main', 'Ca Chiều', '14:00', '22:00', 8, 35, '[1,2,3,4,5,6,7]', 60, 1),
('shift-hcm-night', 'wh-hcm-main', 'Ca Đêm', '22:00', '06:00', 8, 15, '[1,2,3,4,5,6]', 30, 1);

-- Hanoi Warehouse
INSERT OR REPLACE INTO shift_configurations (id, warehouse_id, shift_name, start_time, end_time, duration_hours, capacity_percentage, days_of_week, break_minutes, is_active) VALUES
('shift-hn-morning', 'wh-hanoi', 'Ca Sáng', '08:00', '17:00', 9, 55, '[1,2,3,4,5,6,7]', 60, 1),
('shift-hn-afternoon', 'wh-hanoi', 'Ca Chiều', '14:00', '22:00', 8, 35, '[1,2,3,4,5,6]', 60, 1),
('shift-hn-night', 'wh-hanoi', 'Ca Đêm', '22:00', '06:00', 8, 10, '[1,2,3,4,5]', 30, 1);

-- Da Nang Warehouse
INSERT OR REPLACE INTO shift_configurations (id, warehouse_id, shift_name, start_time, end_time, duration_hours, capacity_percentage, days_of_week, break_minutes, is_active) VALUES
('shift-dn-morning', 'wh-danang', 'Ca Sáng', '08:00', '17:00', 9, 60, '[1,2,3,4,5,6]', 60, 1),
('shift-dn-afternoon', 'wh-danang', 'Ca Chiều', '14:00', '22:00', 8, 40, '[1,2,3,4,5]', 60, 1);

-- ============================================
-- 3. PRODUCTIVITY STANDARDS V2 (COMPREHENSIVE)
-- ============================================

-- BOXME Staff (Highest productivity)
-- PICK operations
INSERT OR REPLACE INTO productivity_standards_v2 (id, staff_level, work_type, product_group, complexity, weight_class, orders_per_hour, percentile_50, percentile_75, percentile_90, min_threshold, max_threshold, field_table_multiplier, prepack_multiplier, rush_multiplier) VALUES
('prod-boxme-pick-cos-single-light', 'BOXME', 'PICK', 'COSMETICS', 'SINGLE_SKU', 'LIGHT', 50, 45, 55, 65, 30, 80, 0.7, 0.5, 1.2),
('prod-boxme-pick-fas-single-light', 'BOXME', 'PICK', 'FASHION', 'SINGLE_SKU', 'LIGHT', 45, 40, 50, 60, 30, 75, 0.7, 0.5, 1.2),
('prod-boxme-pick-ele-single-medium', 'BOXME', 'PICK', 'ELECTRONICS', 'SINGLE_SKU', 'MEDIUM', 35, 30, 40, 50, 20, 60, 0.8, 0.6, 1.2),
('prod-boxme-pick-baby-single-light', 'BOXME', 'PICK', 'BABY', 'SINGLE_SKU', 'LIGHT', 48, 43, 53, 63, 30, 75, 0.7, 0.5, 1.2),
('prod-boxme-pick-food-single-light', 'BOXME', 'PICK', 'FOOD', 'SINGLE_SKU', 'LIGHT', 42, 38, 48, 58, 25, 70, 0.75, 0.55, 1.2);

-- PACK operations
INSERT OR REPLACE INTO productivity_standards_v2 (id, staff_level, work_type, product_group, complexity, weight_class, orders_per_hour, percentile_50, percentile_75, percentile_90, min_threshold, max_threshold, field_table_multiplier, prepack_multiplier, rush_multiplier) VALUES
('prod-boxme-pack-cos-single-light', 'BOXME', 'PACK', 'COSMETICS', 'SINGLE_SKU', 'LIGHT', 40, 35, 45, 55, 25, 70, 0.7, 0.5, 1.2),
('prod-boxme-pack-fas-single-light', 'BOXME', 'PACK', 'FASHION', 'SINGLE_SKU', 'LIGHT', 35, 30, 40, 50, 20, 60, 0.7, 0.5, 1.2),
('prod-boxme-pack-ele-single-medium', 'BOXME', 'PACK', 'ELECTRONICS', 'SINGLE_SKU', 'MEDIUM', 28, 25, 33, 40, 18, 50, 0.75, 0.55, 1.2),
('prod-boxme-pack-baby-single-light', 'BOXME', 'PACK', 'BABY', 'SINGLE_SKU', 'LIGHT', 38, 33, 43, 53, 23, 65, 0.7, 0.5, 1.2),
('prod-boxme-pack-food-single-light', 'BOXME', 'PACK', 'FOOD', 'SINGLE_SKU', 'LIGHT', 32, 28, 38, 45, 20, 55, 0.75, 0.55, 1.2);

-- MOVING operations
INSERT OR REPLACE INTO productivity_standards_v2 (id, staff_level, work_type, product_group, complexity, weight_class, orders_per_hour, percentile_50, percentile_75, percentile_90, min_threshold, max_threshold, field_table_multiplier, prepack_multiplier, rush_multiplier) VALUES
('prod-boxme-mov-all-all-all', 'BOXME', 'MOVING', 'ALL', 'SINGLE_SKU', 'ALL', 100, 90, 110, 130, 60, 150, 1.0, 1.0, 1.1),
('prod-boxme-ret-all-all-all', 'BOXME', 'RETURN', 'ALL', 'SINGLE_SKU', 'ALL', 25, 20, 30, 38, 15, 45, 1.0, 1.0, 1.15),
('prod-boxme-hand-all-all-all', 'BOXME', 'HANDOVER', 'ALL', 'SINGLE_SKU', 'ALL', 80, 70, 90, 105, 50, 120, 1.0, 1.0, 1.1);

-- VETERAN Staff (80-90% of Boxme)
INSERT OR REPLACE INTO productivity_standards_v2 (id, staff_level, work_type, product_group, complexity, weight_class, orders_per_hour, percentile_50, percentile_75, percentile_90, min_threshold, max_threshold, field_table_multiplier, prepack_multiplier, rush_multiplier) VALUES
('prod-vet-pick-cos-single-light', 'VETERAN', 'PICK', 'COSMETICS', 'SINGLE_SKU', 'LIGHT', 43, 38, 48, 58, 25, 70, 0.75, 0.55, 1.25),
('prod-vet-pick-fas-single-light', 'VETERAN', 'PICK', 'FASHION', 'SINGLE_SKU', 'LIGHT', 38, 33, 43, 53, 25, 65, 0.75, 0.55, 1.25),
('prod-vet-pack-cos-single-light', 'VETERAN', 'PACK', 'COSMETICS', 'SINGLE_SKU', 'LIGHT', 33, 28, 38, 48, 20, 60, 0.75, 0.55, 1.25),
('prod-vet-pack-fas-single-light', 'VETERAN', 'PACK', 'FASHION', 'SINGLE_SKU', 'LIGHT', 28, 23, 33, 43, 18, 50, 0.75, 0.55, 1.25),
('prod-vet-mov-all-all-all', 'VETERAN', 'MOVING', 'ALL', 'SINGLE_SKU', 'ALL', 85, 75, 95, 110, 50, 130, 1.0, 1.0, 1.15),
('prod-vet-ret-all-all-all', 'VETERAN', 'RETURN', 'ALL', 'SINGLE_SKU', 'ALL', 20, 15, 25, 33, 12, 40, 1.0, 1.0, 1.2);

-- SEASONAL Staff (60-70% of Boxme)
INSERT OR REPLACE INTO productivity_standards_v2 (id, staff_level, work_type, product_group, complexity, weight_class, orders_per_hour, percentile_50, percentile_75, percentile_90, min_threshold, max_threshold, field_table_multiplier, prepack_multiplier, rush_multiplier) VALUES
('prod-seas-pick-cos-single-light', 'SEASONAL', 'PICK', 'COSMETICS', 'SINGLE_SKU', 'LIGHT', 33, 28, 38, 45, 20, 55, 0.8, 0.6, 1.3),
('prod-seas-pick-fas-single-light', 'SEASONAL', 'PICK', 'FASHION', 'SINGLE_SKU', 'LIGHT', 30, 25, 35, 43, 18, 50, 0.8, 0.6, 1.3),
('prod-seas-pack-cos-single-light', 'SEASONAL', 'PACK', 'COSMETICS', 'SINGLE_SKU', 'LIGHT', 25, 20, 30, 38, 15, 48, 0.8, 0.6, 1.3),
('prod-seas-pack-fas-single-light', 'SEASONAL', 'PACK', 'FASHION', 'SINGLE_SKU', 'LIGHT', 22, 18, 28, 35, 13, 43, 0.8, 0.6, 1.3),
('prod-seas-mov-all-all-all', 'SEASONAL', 'MOVING', 'ALL', 'SINGLE_SKU', 'ALL', 65, 55, 75, 88, 40, 100, 1.0, 1.0, 1.2),
('prod-seas-ret-all-all-all', 'SEASONAL', 'RETURN', 'ALL', 'SINGLE_SKU', 'ALL', 15, 12, 20, 25, 10, 30, 1.0, 1.0, 1.25);

-- CONTRACTOR Staff (Special skills, focused tasks)
INSERT OR REPLACE INTO productivity_standards_v2 (id, staff_level, work_type, product_group, complexity, weight_class, orders_per_hour, percentile_50, percentile_75, percentile_90, min_threshold, max_threshold, field_table_multiplier, prepack_multiplier, rush_multiplier) VALUES
('prod-cont-pick-all-single-light', 'CONTRACTOR', 'PICK', 'ALL', 'SINGLE_SKU', 'LIGHT', 35, 30, 40, 48, 20, 60, 0.8, 0.6, 1.25),
('prod-cont-pack-all-single-light', 'CONTRACTOR', 'PACK', 'ALL', 'SINGLE_SKU', 'LIGHT', 28, 23, 33, 40, 18, 50, 0.8, 0.6, 1.25),
('prod-cont-mov-all-all-all', 'CONTRACTOR', 'MOVING', 'ALL', 'SINGLE_SKU', 'ALL', 70, 60, 80, 95, 45, 110, 1.0, 1.0, 1.2);

-- ============================================
-- SEED DATA SUMMARY
-- ============================================
-- Warehouses: 3 (HCM, Hanoi, Da Nang)
-- Shifts: 8 (3 shifts for HCM, 3 for Hanoi, 2 for Da Nang)
-- Productivity Standards: 28 records covering:
--   - 4 staff levels (BOXME, VETERAN, SEASONAL, CONTRACTOR)
--   - 5 work types (PICK, PACK, MOVING, RETURN, HANDOVER)
--   - 5 product groups (COSMETICS, FASHION, ELECTRONICS, BABY, FOOD, ALL)
