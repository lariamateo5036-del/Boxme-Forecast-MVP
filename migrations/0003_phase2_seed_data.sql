-- ============================================
-- PHASE 2: SEED DATA
-- ============================================
-- Migration: 0003_phase2_seed_data.sql
-- Created: 2025-12-11
-- Description: Seed realistic data for customers, platforms, SLA configs, priority queues

-- ============================================
-- 1. CUSTOMERS (Top fulfillment customers)
-- ============================================

INSERT OR IGNORE INTO customers (id, code, name, primary_platform, tier) VALUES
  ('cust-coolmate', 'COOLMATE', 'Coolmate - Thời trang nam', 'SHOPEE', 'PREMIUM'),
  ('cust-simple', 'SIMPLE', 'Simple Skincare', 'LAZADA', 'PREMIUM'),
  ('cust-bobby', 'BOBBY', 'Bobby Baby Products', 'TIKTOK', 'STANDARD'),
  ('cust-routine', 'ROUTINE', 'Routine Vietnam', 'SHOPEE', 'PREMIUM'),
  ('cust-kidsplaza', 'KIDSPLAZA', 'Kids Plaza', 'SHOPEE', 'STANDARD'),
  ('cust-sapo', 'SAPO', 'Sapo Beauty', 'LAZADA', 'STANDARD'),
  ('cust-elise', 'ELISE', 'Elise Fashion', 'TIKTOK', 'STANDARD'),
  ('cust-vinamit', 'VINAMIT', 'Vinamit Foods', 'SHOPEE', 'STANDARD');

-- ============================================
-- 2. CUSTOMER PRODUCT MIX
-- ============================================

-- Coolmate (Fashion - diverse mix)
INSERT OR IGNORE INTO customer_product_mix (id, customer_id, category_code, category_name, percentage, avg_processing_minutes) VALUES
  ('mix-coolmate-1', 'cust-coolmate', 'FASHION_LIGHT', 'Áo thun, áo polo', 45, 1.8),
  ('mix-coolmate-2', 'cust-coolmate', 'FASHION_MEDIUM', 'Quần dài, áo khoác', 35, 2.2),
  ('mix-coolmate-3', 'cust-coolmate', 'FASHION_BULKY', 'Áo khoác dày, đồ bộ', 15, 3.0),
  ('mix-coolmate-4', 'cust-coolmate', 'ACCESSORIES', 'Phụ kiện thời trang', 5, 1.5);

-- Simple (Cosmetics - high value, careful handling)
INSERT OR IGNORE INTO customer_product_mix (id, customer_id, category_code, category_name, percentage, avg_processing_minutes) VALUES
  ('mix-simple-1', 'cust-simple', 'COSMETICS', 'Mỹ phẩm skincare', 80, 2.8),
  ('mix-simple-2', 'cust-simple', 'COSMETICS_FRAGILE', 'Serum, tinh chất', 15, 3.5),
  ('mix-simple-3', 'cust-simple', 'GIFT_SET', 'Set quà tặng', 5, 4.0);

-- Bobby (Baby products - diverse weight, careful handling)
INSERT OR IGNORE INTO customer_product_mix (id, customer_id, category_code, category_name, percentage, avg_processing_minutes) VALUES
  ('mix-bobby-1', 'cust-bobby', 'BABY_LIGHT', 'Bình sữa, ti giả', 25, 2.0),
  ('mix-bobby-2', 'cust-bobby', 'BABY_MEDIUM', 'Bỉm tã, sữa bột', 50, 2.5),
  ('mix-bobby-3', 'cust-bobby', 'BABY_BULKY', 'Xe đẩy, nôi, ghế ngồi', 15, 5.0),
  ('mix-bobby-4', 'cust-bobby', 'BABY_FRAGILE', 'Đồ chơi điện tử', 10, 3.2);

-- ============================================
-- 3. CUSTOMER OPERATIONS CONFIG
-- ============================================

-- Coolmate: Field Table enabled for hero SKUs (best sellers)
INSERT OR IGNORE INTO customer_operations (id, customer_id, field_table_enabled, field_table_max_sku, field_table_max_items, field_table_max_weight, field_table_hero_skus, prepack_enabled, prepack_weekly_quota, requires_camera, quality_check_level) VALUES
  ('ops-coolmate', 'cust-coolmate', 1, 1, 5, 1.0, '["CM-TEE-BK-M", "CM-TEE-WH-L", "CM-POLO-NV-XL"]', 1, 1500, 1, 'STANDARD');

-- Simple: Premium quality checks, no field table
INSERT OR IGNORE INTO customer_operations (id, customer_id, field_table_enabled, prepack_enabled, prepack_categories, prepack_min_weight, prepack_weekly_quota, requires_camera, quality_check_level) VALUES
  ('ops-simple', 'cust-simple', 0, 1, '["COSMETICS", "GIFT_SET"]', 3.0, 800, 1, 'PREMIUM');

-- Bobby: Pre-pack for large diapers orders
INSERT OR IGNORE INTO customer_operations (id, customer_id, field_table_enabled, prepack_enabled, prepack_categories, prepack_min_weight, prepack_weekly_quota, requires_camera, quality_check_level) VALUES
  ('ops-bobby', 'cust-bobby', 0, 1, '["BABY_MEDIUM", "BABY_BULKY"]', 5.0, 600, 1, 'STANDARD');

-- Routine: Field Table for hero products
INSERT OR IGNORE INTO customer_operations (id, customer_id, field_table_enabled, field_table_max_sku, field_table_max_items, field_table_hero_skus, prepack_enabled, requires_camera, quality_check_level) VALUES
  ('ops-routine', 'cust-routine', 1, 1, 3, '["RT-SERUM-01", "RT-CREAM-02"]', 0, 1, 'STANDARD');

-- Standard config for others
INSERT OR IGNORE INTO customer_operations (id, customer_id, requires_camera, quality_check_level) VALUES
  ('ops-kidsplaza', 'cust-kidsplaza', 1, 'STANDARD'),
  ('ops-sapo', 'cust-sapo', 1, 'STANDARD'),
  ('ops-elise', 'cust-elise', 1, 'BASIC'),
  ('ops-vinamit', 'cust-vinamit', 1, 'STANDARD');

-- ============================================
-- 4. CUSTOMER SLA CONFIG
-- ============================================

-- Premium customers (Coolmate, Simple, Routine)
INSERT OR IGNORE INTO customer_sla (id, customer_id, platform, tier, cutoff_time, internal_buffer_hours, priority_level, can_delay_non_urgent) VALUES
  ('sla-coolmate-1', 'cust-coolmate', 'SHOPEE', 'MALL', '21:00', 1.5, 1, 0),
  ('sla-simple-1', 'cust-simple', 'LAZADA', 'MALL', '20:00', 1.5, 1, 0),
  ('sla-routine-1', 'cust-routine', 'SHOPEE', 'MALL', '21:00', 2, 1, 0);

-- Standard customers
INSERT OR IGNORE INTO customer_sla (id, customer_id, platform, tier, cutoff_time, internal_buffer_hours, priority_level, can_delay_non_urgent) VALUES
  ('sla-bobby-1', 'cust-bobby', 'TIKTOK', 'STANDARD', '21:00', 2, 3, 0),
  ('sla-kidsplaza-1', 'cust-kidsplaza', 'SHOPEE', 'STANDARD', '21:00', 2, 3, 1),
  ('sla-sapo-1', 'cust-sapo', 'LAZADA', 'STANDARD', '20:00', 2, 3, 0),
  ('sla-elise-1', 'cust-elise', 'TIKTOK', 'STANDARD', '21:00', 2.5, 4, 1),
  ('sla-vinamit-1', 'cust-vinamit', 'SHOPEE', 'STANDARD', '21:00', 2, 3, 0);

-- ============================================
-- 5. PLATFORM SLA CONFIG
-- ============================================

-- Shopee
INSERT OR IGNORE INTO platform_sla_config (id, platform_code, platform_name, is_active) VALUES
  ('platform-shopee', 'SHOPEE', 'Shopee Vietnam', 1);

INSERT OR IGNORE INTO platform_service_tiers (id, platform_id, tier_code, tier_name, cutoff_time, processing_deadline_type, processing_deadline_value, internal_buffer_hours, special_rules) VALUES
  ('tier-shopee-std', 'platform-shopee', 'STANDARD', 'Shopee Nhanh (Standard)', '21:00', 'SAME_DAY', NULL, 2, NULL),
  ('tier-shopee-instant', 'platform-shopee', 'INSTANT', 'Shopee Hỏa Tốc', '21:00', 'HOURS', 4, 1, 'Từ 02/12/2024: Hạn cutoff 21h'),
  ('tier-shopee-mall', 'platform-shopee', 'MALL', 'Shopee Mall', '21:00', 'SAME_DAY', NULL, 1.5, 'SLA chặt hơn, ưu tiên cao');

INSERT OR IGNORE INTO platform_quality_requirements (id, platform_id, metric_code, metric_name, target_value, comparison_operator, measurement_period) VALUES
  ('qm-shopee-pqr', 'platform-shopee', 'PQR', 'Product Quality Rate', 20, 'LT', 'WEEKLY'),
  ('qm-shopee-lsr', 'platform-shopee', 'LSR', 'Late Shipment Rate', 8, 'LT', 'MONTHLY'),
  ('qm-shopee-ffr', 'platform-shopee', 'FFR', 'Fast Fulfillment Rate', 70, 'GTE', 'MONTHLY');

INSERT OR IGNORE INTO platform_notes (id, platform_id, note_text, importance_level, display_order) VALUES
  ('note-shopee-1', 'platform-shopee', 'Đơn Shopee Nhanh: Phải giao trước 24h kể từ khi đặt', 'CRITICAL', 1),
  ('note-shopee-2', 'platform-shopee', 'PQR < 20%: Chỉ số chất lượng sản phẩm phải dưới 20%', 'WARNING', 2),
  ('note-shopee-3', 'platform-shopee', 'Shopee Mall có FFR >= 70% (tỷ lệ giao nhanh)', 'INFO', 3);

-- Lazada
INSERT OR IGNORE INTO platform_sla_config (id, platform_code, platform_name, is_active) VALUES
  ('platform-lazada', 'LAZADA', 'Lazada Vietnam', 1);

INSERT OR IGNORE INTO platform_service_tiers (id, platform_id, tier_code, tier_name, cutoff_time, processing_deadline_type, processing_deadline_value, internal_buffer_hours, special_rules) VALUES
  ('tier-lazada-std', 'platform-lazada', 'STANDARD', 'Lazada Standard', '20:00', 'NEXT_DAY', NULL, 2, NULL),
  ('tier-lazada-mall', 'platform-lazada', 'MALL', 'LazMall', '20:00', 'SAME_DAY', NULL, 1.5, 'Cam kết giao hàng nhanh'),
  ('tier-lazada-instant', 'platform-lazada', 'INSTANT', 'Instant Delivery', '20:00', 'HOURS', 3, 1, 'Giao trong 3h tại TP.HCM');

INSERT OR IGNORE INTO platform_quality_requirements (id, platform_id, metric_code, metric_name, target_value, comparison_operator, measurement_period) VALUES
  ('qm-lazada-lsr', 'platform-lazada', 'LSR', 'Late Shipment Rate', 5, 'LT', 'WEEKLY'),
  ('qm-lazada-ffr', 'platform-lazada', 'FFR', 'Fast Fulfillment Rate', 75, 'GTE', 'MONTHLY'),
  ('qm-lazada-rr', 'platform-lazada', 'RR', 'Return Rate', 5, 'LT', 'MONTHLY');

INSERT OR IGNORE INTO platform_notes (id, platform_id, note_text, importance_level, display_order) VALUES
  ('note-lazada-1', 'platform-lazada', 'LazMall có FFR >= 75%: Tỷ lệ giao nhanh cao hơn Shopee', 'CRITICAL', 1),
  ('note-lazada-2', 'platform-lazada', 'Cutoff 20:00: Sớm hơn Shopee 1 tiếng', 'WARNING', 2);

-- TikTok Shop
INSERT OR IGNORE INTO platform_sla_config (id, platform_code, platform_name, is_active) VALUES
  ('platform-tiktok', 'TIKTOK', 'TikTok Shop Vietnam', 1);

INSERT OR IGNORE INTO platform_service_tiers (id, platform_id, tier_code, tier_name, cutoff_time, processing_deadline_type, processing_deadline_value, internal_buffer_hours, special_rules) VALUES
  ('tier-tiktok-std', 'platform-tiktok', 'STANDARD', 'TikTok Standard', '21:00', 'NEXT_DAY', NULL, 2, NULL),
  ('tier-tiktok-instant', 'platform-tiktok', 'INSTANT', 'TikTok Hỏa Tốc', '21:00', 'HOURS', 4, 1, 'Giao trong 4h');

INSERT OR IGNORE INTO platform_quality_requirements (id, platform_id, metric_code, metric_name, target_value, comparison_operator, measurement_period) VALUES
  ('qm-tiktok-lsr', 'platform-tiktok', 'LSR', 'Late Shipment Rate', 10, 'LT', 'WEEKLY');

INSERT OR IGNORE INTO platform_notes (id, platform_id, note_text, importance_level, display_order) VALUES
  ('note-tiktok-1', 'platform-tiktok', 'TikTok đang tăng trưởng nhanh, cần monitor volume', 'INFO', 1);

-- ============================================
-- 6. PRIORITY QUEUE BUCKETS
-- ============================================

INSERT OR IGNORE INTO priority_buckets (id, priority, name, description, processing_order, is_active) VALUES
  ('bucket-1-instant', 1, 'INSTANT - Hỏa Tốc', 'Đơn hỏa tốc SLA < 4h, xử lý ngay', 'DEADLINE', 1),
  ('bucket-2-mall', 2, 'MALL - SLA Chặt', 'LazMall, Shopee Mall, SLA cao', 'DEADLINE', 1),
  ('bucket-3-atrisk', 3, 'AT RISK - Sắp trễ', 'Còn < 2h đến deadline nội bộ', 'DEADLINE', 1),
  ('bucket-4-piship', 4, 'PISHIP - ĐVVC theo slot', 'Carrier pickup window trong 4h', 'DEADLINE', 1),
  ('bucket-5-standard', 5, 'STANDARD - Theo thứ tự', 'Standard FIFO processing', 'FIFO', 1),
  ('bucket-6-flexible', 6, 'FLEXIBLE - Có thể delay', 'Economy, có thể xử lý sau', 'CUSTOMER_PRIORITY', 1);

-- ============================================
-- 7. PRIORITY CRITERIA
-- ============================================

-- Bucket 1: INSTANT criteria
INSERT OR IGNORE INTO priority_criteria (id, bucket_id, criterion_type, criterion_value, weight) VALUES
  ('crit-instant-1', 'bucket-1-instant', 'SERVICE_TYPE', '{"values": ["INSTANT", "SAME_DAY"]}', 1.0),
  ('crit-instant-2', 'bucket-1-instant', 'HOURS_TO_DEADLINE', '{"max_hours": 4}', 1.0);

-- Bucket 2: MALL criteria
INSERT OR IGNORE INTO priority_criteria (id, bucket_id, criterion_type, criterion_value, weight) VALUES
  ('crit-mall-1', 'bucket-2-mall', 'PLATFORM', '{"values": ["LAZADA", "SHOPEE"]}', 1.0),
  ('crit-mall-2', 'bucket-2-mall', 'FLAG', '{"flag": "is_mall", "value": true}', 1.0);

-- Bucket 3: AT RISK criteria
INSERT OR IGNORE INTO priority_criteria (id, bucket_id, criterion_type, criterion_value, weight) VALUES
  ('crit-atrisk-1', 'bucket-3-atrisk', 'HOURS_TO_DEADLINE', '{"max_hours": 2}', 1.0);

-- Bucket 4: PISHIP criteria
INSERT OR IGNORE INTO priority_criteria (id, bucket_id, criterion_type, criterion_value, weight) VALUES
  ('crit-piship-1', 'bucket-4-piship', 'FLAG', '{"flag": "has_carrier_window", "value": true}', 1.0),
  ('crit-piship-2', 'bucket-4-piship', 'HOURS_TO_DEADLINE', '{"max_hours": 4}', 0.8);

-- ============================================
-- 8. CARRIER PICKUP WINDOWS (Sample data)
-- ============================================

-- GHTK (Giao Hàng Tiết Kiệm)
INSERT OR IGNORE INTO carrier_pickup_windows (id, carrier_code, carrier_name, day_of_week, pickup_time, capacity, service_types) VALUES
  ('pickup-ghtk-mon-09', 'GHTK', 'Giao Hàng Tiết Kiệm', 1, '09:00', 500, '["STANDARD", "EXPRESS"]'),
  ('pickup-ghtk-mon-14', 'GHTK', 'Giao Hàng Tiết Kiệm', 1, '14:00', 500, '["STANDARD"]'),
  ('pickup-ghtk-tue-09', 'GHTK', 'Giao Hàng Tiết Kiệm', 2, '09:00', 500, '["STANDARD", "EXPRESS"]'),
  ('pickup-ghtk-wed-09', 'GHTK', 'Giao Hàng Tiết Kiệm', 3, '09:00', 500, '["STANDARD", "EXPRESS"]');

-- Ninja Van
INSERT OR IGNORE INTO carrier_pickup_windows (id, carrier_code, carrier_name, day_of_week, pickup_time, capacity, service_types) VALUES
  ('pickup-ninja-mon-10', 'NINJAVAN', 'Ninja Van', 1, '10:00', 300, '["EXPRESS"]'),
  ('pickup-ninja-mon-15', 'NINJAVAN', 'Ninja Van', 1, '15:00', 300, '["EXPRESS"]'),
  ('pickup-ninja-tue-10', 'NINJAVAN', 'Ninja Van', 2, '10:00', 300, '["EXPRESS"]');

-- GHN (Giao Hàng Nhanh)
INSERT OR IGNORE INTO carrier_pickup_windows (id, carrier_code, carrier_name, day_of_week, pickup_time, capacity, service_types) VALUES
  ('pickup-ghn-mon-11', 'GHN', 'Giao Hàng Nhanh', 1, '11:00', 400, '["STANDARD", "EXPRESS"]'),
  ('pickup-ghn-mon-16', 'GHN', 'Giao Hàng Nhanh', 1, '16:00', 400, '["STANDARD"]');

-- ============================================
-- SEED DATA COMPLETE
-- ============================================
-- Total customers: 8
-- Total product mix entries: 13
-- Total operations configs: 8
-- Total SLA configs: 8
-- Total platforms: 3 (Shopee, Lazada, TikTok)
-- Total service tiers: 8
-- Total quality requirements: 7
-- Total platform notes: 5
-- Total priority buckets: 6
-- Total priority criteria: 8
-- Total carrier pickup windows: 10
