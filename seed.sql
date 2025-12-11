-- ============================================
-- SEED FAKE DATA FOR MVP TESTING
-- This script generates 24 months of historical data
-- Run with: npm run db:seed
-- ============================================

-- Note: This is a simplified version.
-- For full 24 months data, we'll use a TypeScript script
-- This just adds calendar events for testing

-- Calendar events (Double Days for 2024-2025)
INSERT OR IGNORE INTO calendar_events (id, event_date, event_type, event_name, is_peak, expected_multiplier, notes) VALUES
-- 2024 Double Days
('evt-2024-0101-pre', '2024-01-01', 'double_day_leadup', '1/1 New Year Sale (D-1)', 1, 2.05, NULL),
('evt-2024-0101', '2024-01-02', 'double_day', '1/1 New Year Sale', 1, 3.5, NULL),
('evt-2024-0101-post1', '2024-01-03', 'double_day_aftermath', '1/1 New Year Sale (D+1)', 1, 2.25, NULL),
('evt-2024-0101-post2', '2024-01-04', 'double_day_aftermath', '1/1 New Year Sale (D+2)', 1, 1.5, NULL),

('evt-2024-0202-pre', '2024-02-01', 'double_day_leadup', '2/2 Sale (D-1)', 1, 1.84, NULL),
('evt-2024-0202', '2024-02-02', 'double_day', '2/2 Sale', 1, 2.8, NULL),
('evt-2024-0202-post1', '2024-02-03', 'double_day_aftermath', '2/2 Sale (D+1)', 1, 1.9, NULL),
('evt-2024-0202-post2', '2024-02-04', 'double_day_aftermath', '2/2 Sale (D+2)', 1, 1.36, NULL),

('evt-2024-0303-pre', '2024-03-02', 'double_day_leadup', '3/3 Sale (D-1)', 1, 1.78, NULL),
('evt-2024-0303', '2024-03-03', 'double_day', '3/3 Sale', 1, 2.6, NULL),
('evt-2024-0303-post1', '2024-03-04', 'double_day_aftermath', '3/3 Sale (D+1)', 1, 1.8, NULL),
('evt-2024-0303-post2', '2024-03-05', 'double_day_aftermath', '3/3 Sale (D+2)', 1, 1.32, NULL),

('evt-2024-0404-pre', '2024-04-03', 'double_day_leadup', '4/4 Sale (D-1)', 1, 1.75, NULL),
('evt-2024-0404', '2024-04-04', 'double_day', '4/4 Sale', 1, 2.5, NULL),
('evt-2024-0404-post1', '2024-04-05', 'double_day_aftermath', '4/4 Sale (D+1)', 1, 1.75, NULL),
('evt-2024-0404-post2', '2024-04-06', 'double_day_aftermath', '4/4 Sale (D+2)', 1, 1.3, NULL),

('evt-2024-0505-pre', '2024-05-04', 'double_day_leadup', '5/5 Sale (D-1)', 1, 1.81, NULL),
('evt-2024-0505', '2024-05-05', 'double_day', '5/5 Sale', 1, 2.7, NULL),
('evt-2024-0505-post1', '2024-05-06', 'double_day_aftermath', '5/5 Sale (D+1)', 1, 1.85, NULL),
('evt-2024-0505-post2', '2024-05-07', 'double_day_aftermath', '5/5 Sale (D+2)', 1, 1.34, NULL),

('evt-2024-0606-pre', '2024-06-05', 'double_day_leadup', '6/6 Mid-Year Sale (D-1)', 1, 1.96, NULL),
('evt-2024-0606', '2024-06-06', 'double_day', '6/6 Mid-Year Sale', 1, 3.2, NULL),
('evt-2024-0606-post1', '2024-06-07', 'double_day_aftermath', '6/6 Mid-Year Sale (D+1)', 1, 2.1, NULL),
('evt-2024-0606-post2', '2024-06-08', 'double_day_aftermath', '6/6 Mid-Year Sale (D+2)', 1, 1.44, NULL),

('evt-2024-0707-pre', '2024-07-06', 'double_day_leadup', '7/7 Sale (D-1)', 1, 1.87, NULL),
('evt-2024-0707', '2024-07-07', 'double_day', '7/7 Sale', 1, 2.9, NULL),
('evt-2024-0707-post1', '2024-07-08', 'double_day_aftermath', '7/7 Sale (D+1)', 1, 1.95, NULL),
('evt-2024-0707-post2', '2024-07-09', 'double_day_aftermath', '7/7 Sale (D+2)', 1, 1.38, NULL),

('evt-2024-0808-pre', '2024-08-07', 'double_day_leadup', '8/8 Sale (D-1)', 1, 1.9, NULL),
('evt-2024-0808', '2024-08-08', 'double_day', '8/8 Sale', 1, 3.0, NULL),
('evt-2024-0808-post1', '2024-08-09', 'double_day_aftermath', '8/8 Sale (D+1)', 1, 2.0, NULL),
('evt-2024-0808-post2', '2024-08-10', 'double_day_aftermath', '8/8 Sale (D+2)', 1, 1.4, NULL),

('evt-2024-0909-pre', '2024-09-08', 'double_day_leadup', '9/9 Super Sale (D-1)', 1, 2.14, NULL),
('evt-2024-0909', '2024-09-09', 'double_day', '9/9 Super Sale', 1, 3.8, NULL),
('evt-2024-0909-post1', '2024-09-10', 'double_day_aftermath', '9/9 Super Sale (D+1)', 1, 2.4, NULL),
('evt-2024-0909-post2', '2024-09-11', 'double_day_aftermath', '9/9 Super Sale (D+2)', 1, 1.56, NULL),

('evt-2024-1010-pre', '2024-10-09', 'double_day_leadup', '10/10 Sale (D-1)', 1, 2.05, NULL),
('evt-2024-1010', '2024-10-10', 'double_day', '10/10 Sale', 1, 3.5, NULL),
('evt-2024-1010-post1', '2024-10-11', 'double_day_aftermath', '10/10 Sale (D+1)', 1, 2.25, NULL),
('evt-2024-1010-post2', '2024-10-12', 'double_day_aftermath', '10/10 Sale (D+2)', 1, 1.5, NULL),

('evt-2024-1111-pre', '2024-11-10', 'double_day_leadup', '11/11 Singles Day (D-1)', 1, 2.26, NULL),
('evt-2024-1111', '2024-11-11', 'double_day', '11/11 Singles Day', 1, 4.2, NULL),
('evt-2024-1111-post1', '2024-11-12', 'double_day_aftermath', '11/11 Singles Day (D+1)', 1, 2.6, NULL),
('evt-2024-1111-post2', '2024-11-13', 'double_day_aftermath', '11/11 Singles Day (D+2)', 1, 1.64, NULL),

('evt-2024-1212-pre', '2024-12-11', 'double_day_leadup', '12/12 Year-End Sale (D-1)', 1, 2.17, NULL),
('evt-2024-1212', '2024-12-12', 'double_day', '12/12 Year-End Sale', 1, 3.9, NULL),
('evt-2024-1212-post1', '2024-12-13', 'double_day_aftermath', '12/12 Year-End Sale (D+1)', 1, 2.45, NULL),
('evt-2024-1212-post2', '2024-12-14', 'double_day_aftermath', '12/12 Year-End Sale (D+2)', 1, 1.58, NULL),

-- 2025 Double Days
('evt-2025-0101-pre', '2024-12-31', 'double_day_leadup', '1/1 New Year Sale (D-1)', 1, 2.05, NULL),
('evt-2025-0101', '2025-01-01', 'double_day', '1/1 New Year Sale', 1, 3.5, NULL),
('evt-2025-0101-post1', '2025-01-02', 'double_day_aftermath', '1/1 New Year Sale (D+1)', 1, 2.25, NULL),
('evt-2025-0101-post2', '2025-01-03', 'double_day_aftermath', '1/1 New Year Sale (D+2)', 1, 1.5, NULL),

('evt-2025-0202-pre', '2025-02-01', 'double_day_leadup', '2/2 Sale (D-1)', 1, 1.84, NULL),
('evt-2025-0202', '2025-02-02', 'double_day', '2/2 Sale', 1, 2.8, NULL),
('evt-2025-0202-post1', '2025-02-03', 'double_day_aftermath', '2/2 Sale (D+1)', 1, 1.9, NULL),
('evt-2025-0202-post2', '2025-02-04', 'double_day_aftermath', '2/2 Sale (D+2)', 1, 1.36, NULL),

('evt-2025-0303-pre', '2025-03-02', 'double_day_leadup', '3/3 Sale (D-1)', 1, 1.78, NULL),
('evt-2025-0303', '2025-03-03', 'double_day', '3/3 Sale', 1, 2.6, NULL),
('evt-2025-0303-post1', '2025-03-04', 'double_day_aftermath', '3/3 Sale (D+1)', 1, 1.8, NULL),
('evt-2025-0303-post2', '2025-03-05', 'double_day_aftermath', '3/3 Sale (D+2)', 1, 1.32, NULL),

('evt-2025-0404-pre', '2025-04-03', 'double_day_leadup', '4/4 Sale (D-1)', 1, 1.75, NULL),
('evt-2025-0404', '2025-04-04', 'double_day', '4/4 Sale', 1, 2.5, NULL),
('evt-2025-0404-post1', '2025-04-05', 'double_day_aftermath', '4/4 Sale (D+1)', 1, 1.75, NULL),
('evt-2025-0404-post2', '2025-04-06', 'double_day_aftermath', '4/4 Sale (D+2)', 1, 1.3, NULL),

('evt-2025-0505-pre', '2025-05-04', 'double_day_leadup', '5/5 Sale (D-1)', 1, 1.81, NULL),
('evt-2025-0505', '2025-05-05', 'double_day', '5/5 Sale', 1, 2.7, NULL),
('evt-2025-0505-post1', '2025-05-06', 'double_day_aftermath', '5/5 Sale (D+1)', 1, 1.85, NULL),
('evt-2025-0505-post2', '2025-05-07', 'double_day_aftermath', '5/5 Sale (D+2)', 1, 1.34, NULL),

('evt-2025-0606-pre', '2025-06-05', 'double_day_leadup', '6/6 Mid-Year Sale (D-1)', 1, 1.96, NULL),
('evt-2025-0606', '2025-06-06', 'double_day', '6/6 Mid-Year Sale', 1, 3.2, NULL),
('evt-2025-0606-post1', '2025-06-07', 'double_day_aftermath', '6/6 Mid-Year Sale (D+1)', 1, 2.1, NULL),
('evt-2025-0606-post2', '2025-06-08', 'double_day_aftermath', '6/6 Mid-Year Sale (D+2)', 1, 1.44, NULL),

-- Tet Holiday
('evt-tet-2024', '2024-02-10', 'holiday', 'Tết Nguyên Đán 2024', 1, 3.5, NULL),
('evt-tet-2025', '2025-01-29', 'holiday', 'Tết Nguyên Đán 2025', 1, 3.5, NULL);

-- Sample orders for last 7 days (for testing)
-- In production, use TypeScript script to generate full 24 months
