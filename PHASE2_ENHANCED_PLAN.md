# 🎯 PHASE 2 ENHANCED - KẾ HOẠCH NÂNG CÁP TOÀN DIỆN

**Ngày tạo:** 2025-12-11  
**Mục tiêu:** Xây dựng hệ thống quản lý khách hàng và cấu hình hoàn chỉnh với UX chuyên nghiệp

---

## 📊 PHÂN TÍCH YÊU CẦU TỪ HÌNH ẢNH

### Hình 1: Cấu hình Vận hành & SLA (Operations)
**Insights:**
- Bảng matrix khách hàng × loại dịch vụ
- Các cột: MALL, PISHIP, INSTANT, FAST TRACK
- Checkmark system (✓ = enabled, ✗ = disabled)
- Khách hàng: Unilever, Samsung, Coolmate, Sunhouse, Bàn_Dã_Chiến
- Kênh: Shopee, Lazada, TikTok, Chiến dịch

### Hình 2: Thời gian làm việc (Ca chuẩn)
**Insights:**
- 3 ca làm việc:
  - Ca Sáng: 8:00 - 17:00 (9h)
  - Ca Chiều: 14:00 - 22:00 (8h)
  - Ca Đêm: 22:00 - 30:00/06:00 (6h)
- Overlap giữa các ca để xử lý peak hours

### Hình 3: Cấu hình Hệ thống
**Sections:**
1. **Kho & Nhân sự** - Warehouse & staff configuration
2. **Định mức Năng suất** - Productivity standards
3. **Hãng vận chuyển** - Carrier configuration
4. **Quy định Sàn (SLA)** - Platform SLA rules

**Carrier Table:**
- Columns: Hãng vận chuyển, Loại hình, Max capacity/ca, Giờ lấy hàng, Cut-off cuối, Limit cấp nhật sớm
- Carriers: SPX Express, J&T Express, Lazada Express, SPX Hỏa Tốc
- Pickup windows: 10h-21h, Multiple slots per day

### Hình 4: Lưu ý Quan trọng & Platform SLA Details
**Critical Notes (Cập nhật 2025):**
- Shopee: PQR < 20%, Hỏa tốc cắt lúc 21h
- Lazada: FFR >= 75% cho LazMall
- TikTok: Đơn trước 18h phải giao trước 12h hôm sau

**Platform Cards:**
- Shopee NHANH: Cut-off 21:00, Buffer 2h, LSR < 8%, PQR < 20%
- Shopee HỎA TỐC: Cut-off 21:00, Buffer 1h, Trong ngày
- Lazada LAZMALL: Cut-off 20:00, Buffer 2h, FFR >= 75%
- TikTok STANDARD: Cut-off 18:00, Buffer 1h, Trong ngày

---

## 🎯 KIẾN TRÚC HỆ THỐNG MỚI

### 1. CUSTOMER MANAGEMENT MODULE (Quản lý Khách hàng)

#### 1.1. Customer List Page (`/customers`)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ 👥 Quản lý Khách hàng                        [+ Thêm]│
├─────────────────────────────────────────────────────┤
│ [🔍 Tìm kiếm] [Platform ▼] [Tier ▼] [Status ▼]     │
├─────────────────────────────────────────────────────┤
│ Customer    │ Platform │ Đơn/ngày │ SLA │ Actions   │
├─────────────┼──────────┼──────────┼─────┼───────────┤
│ Unilever    │ Shopee   │ 2,500    │ ✓✓✓ │ [Detail]  │
│ Coolmate    │ TikTok   │ 3,500    │ ✓✓  │ [Detail]  │
│ Samsung     │ Lazada   │ 1,800    │ ✓✓✓ │ [Detail]  │
└─────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Search by name/code
- ✅ Filter by platform, tier, status
- ✅ Quick stats: Total orders/day, SLA compliance
- ✅ Export to Excel
- ✅ Bulk actions

#### 1.2. Customer Detail Page (`/customers/:id`)

**Tab Structure:**
```
┌─────────────────────────────────────────────────────┐
│ ← Back   Coolmate - Thời trang nam          [Edit]  │
├─────────────────────────────────────────────────────┤
│ [Overview] [Operations] [SLA] [Forecast] [History]  │
├─────────────────────────────────────────────────────┤
│                    TAB CONTENT                       │
└─────────────────────────────────────────────────────┘
```

**Tab 1: Overview (Tổng quan)**
```typescript
interface CustomerOverview {
  // Basic Info
  code: string;
  name: string;
  tier: 'PREMIUM' | 'STANDARD' | 'BASIC';
  primary_platform: string;
  account_manager: string;
  is_active: boolean;
  
  // Quick Stats (Real-time)
  stats: {
    orders_today: number;
    orders_this_week: number;
    orders_this_month: number;
    avg_orders_per_day: number;
    sla_compliance_rate: number; // %
    forecast_accuracy: number; // MAPE %
  };
  
  // Product Mix (Pie Chart)
  product_mix: Array<{
    category: string;
    percentage: number;
    avg_processing_time: number;
    orders_count: number;
  }>;
  
  // Recent Activity
  recent_orders: Array<{
    order_id: string;
    date: string;
    status: string;
    packing_method: string;
  }>;
}
```

**Tab 2: Operations (Cấu hình Vận hành)**
```typescript
interface CustomerOperations {
  // Service Type Matrix (như hình 1)
  service_types: {
    mall_enabled: boolean;      // MALL (SHOPEE/LAZ) - SLA CHẶT HƠN
    piship_enabled: boolean;    // PISHIP (ĐVVC SẴN) - GIỜ LẤY CÙNG
    instant_enabled: boolean;   // INSTANT (HỎA TỐC) - CẦN LINE RIÊNG
    fast_track_enabled: boolean; // FAST TRACK - CHỜ PHÉP ĐÃ CHIẾN
  };
  
  // Field Table Configuration
  field_table: {
    enabled: boolean;
    max_sku: number;           // Max 1-3 SKU
    max_items: number;         // Max 5 items
    max_weight: number;        // Max 1kg
    hero_skus: string[];       // ["SKU001", "SKU002"]
    efficiency_gain: string;   // "30%"
  };
  
  // Pre-pack Configuration
  prepack: {
    enabled: boolean;
    categories: string[];      // ["COSMETICS", "BABY"]
    min_weight: number;        // 5kg
    weekly_quota: number;      // 1500 orders/week
    current_prepacked: number; // Số đã prepack
    pending_prepack: number;   // Số chờ prepack
    prepack_schedule: Array<{
      date: string;
      registered_orders: number;
      completed: number;
      pending: number;
    }>;
  };
  
  // Quality Requirements
  quality: {
    requires_camera: boolean;
    check_level: 'BASIC' | 'STANDARD' | 'PREMIUM';
    special_instructions: string;
  };
}
```

**Tab 3: SLA Configuration (Quy định SLA)**
```typescript
interface CustomerSLA {
  // Platform-specific SLA (như hình 4)
  sla_configs: Array<{
    platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK';
    tier: 'STANDARD' | 'MALL' | 'INSTANT';
    cutoff_time: string;        // "21:00"
    processing_deadline: string; // "SAME_DAY" | "NEXT_DAY" | "4 HOURS"
    internal_buffer: number;    // 2 hours
    priority_level: number;     // 1-5
    can_delay: boolean;
    
    // Quality Metrics
    quality_requirements: {
      pqr: { target: number; operator: 'LT' | 'GT' }; // PQR < 20%
      lsr: { target: number; operator: 'LT' | 'GT' }; // LSR < 8%
      ffr: { target: number; operator: 'LT' | 'GT' }; // FFR >= 75%
    };
    
    // Compliance Tracking
    compliance: {
      last_7_days: number;   // %
      last_30_days: number;  // %
      violations_count: number;
      at_risk_orders: number;
    };
  }>;
}
```

**Tab 4: Forecast Management (Dự báo)**
```typescript
interface CustomerForecast {
  // System Auto-forecast (Hệ thống tự tính)
  system_forecast: {
    date: string;
    orders: number;
    confidence: number;
    method: 'BASELINE' | 'ML' | 'ENSEMBLE';
    breakdown: {
      by_method: { standard: number; field_table: number; prepack: number };
      by_priority: { instant: number; mall: number; standard: number };
    };
  };
  
  // Customer Submitted Forecast (Khách gửi)
  customer_forecast: {
    date: string;
    orders: number;
    submitted_by: string;
    submitted_at: string;
    notes: string;
  };
  
  // Staff Adjusted Forecast (Nhân viên edit)
  adjusted_forecast: {
    date: string;
    orders: number;
    adjusted_by: string;
    adjusted_at: string;
    reason: string;
    final_forecast: number;  // Used for workforce calculation
  };
  
  // Forecast Accuracy History
  accuracy_history: Array<{
    date: string;
    forecast: number;
    actual: number;
    mape: number;
    variance: number;
  }>;
  
  // Actions
  actions: {
    upload_customer_forecast: () => void;
    adjust_forecast: (date: string, orders: number, reason: string) => void;
    recalculate_workforce: () => void;  // Trigger when updated
  };
}
```

**Tab 5: Order History (Lịch sử đơn hàng)**
```typescript
interface CustomerHistory {
  // Date range selector
  date_range: { from: string; to: string };
  
  // Summary metrics
  summary: {
    total_orders: number;
    avg_per_day: number;
    by_method: { standard: number; field_table: number; prepack: number };
    by_priority: { instant: number; mall: number; standard: number };
    by_weight: { light: number; medium: number; heavy: number; bulky: number };
  };
  
  // Trends Chart (30 days)
  trends: Array<{
    date: string;
    orders: number;
    field_table_ratio: number;
    prepack_ratio: number;
  }>;
  
  // Detailed order list
  orders: Array<{
    order_id: string;
    order_date: string;
    platform: string;
    priority: string;
    weight: number;
    sku_count: number;
    packing_method: string;
    actual_minutes: number;
    status: string;
  }>;
  
  // Export functionality
  export_options: ['CSV', 'Excel', 'PDF'];
}
```

---

### 2. SETTINGS MODULE (Cấu hình Hệ thống)

#### 2.1. Settings Navigation (`/settings`)

```
┌─────────────────────────────────────────────────────┐
│ ⚙️ Cấu hình Hệ thống                                │
├─────────────────────────────────────────────────────┤
│ Sidebar               │ Content Area                 │
├───────────────────────┼──────────────────────────────┤
│ 🏢 Kho & Nhân sự      │                              │
│ 📊 Định mức Năng suất │                              │
│ 🚚 Hãng vận chuyển    │                              │
│ 🎯 Quy định Sàn (SLA) │                              │
│ ⏰ Thời gian làm việc │                              │
│ 🔔 Cảnh báo & Alerts  │                              │
└───────────────────────┴──────────────────────────────┘
```

#### 2.2. Warehouse & Staff (`/settings/warehouses`)

**Multiple Warehouse Support:**
```typescript
interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  is_active: boolean;
  
  // Capacity
  capacity: {
    max_orders_per_day: number;
    max_staff: number;
    storage_area_sqm: number;
    packing_stations: number;
    field_table_stations: number;
  };
  
  // Staff Roster
  staff_roster: {
    boxme: { total: number; available_today: number };
    veteran: { total: number; available_today: number };
    seasonal: { total: number; available_today: number };
    contractor: { total: number; available_today: number };
  };
  
  // Working Hours (như hình 2)
  working_hours: {
    shifts: Array<{
      name: 'Ca Sáng' | 'Ca Chiều' | 'Ca Đêm';
      start_time: string;  // "08:00"
      end_time: string;    // "17:00"
      duration_hours: number;
      capacity_percentage: number;  // % of daily capacity
    }>;
  };
  
  // Equipment
  equipment: {
    cameras: number;
    scanners: number;
    printers: number;
    scales: number;
  };
}
```

**UI Layout:**
```
┌─────────────────────────────────────────────────────┐
│ 🏢 Kho & Nhân sự                            [+ Thêm] │
├─────────────────────────────────────────────────────┤
│ 📍 Boxme HCM (Main)                    [Active] [✏️]│
│   ├─ Capacity: 15,000 orders/day                    │
│   ├─ Staff: 80 Boxme, 30 Veteran, 20 Seasonal       │
│   ├─ Shifts: 3 ca (Sáng 8-17, Chiều 14-22, Đêm 22-6)│
│   └─ Equipment: 50 cameras, 30 scanners             │
├─────────────────────────────────────────────────────┤
│ 📍 Boxme Hanoi                         [Active] [✏️]│
│   ├─ Capacity: 8,000 orders/day                     │
│   └─ ...                                             │
└─────────────────────────────────────────────────────┘
```

#### 2.3. Productivity Standards (`/settings/productivity`)

**Comprehensive Productivity Matrix:**
```typescript
interface ProductivityStandard {
  id: string;
  
  // Dimensions
  staff_level: 'BOXME' | 'VETERAN' | 'SEASONAL' | 'CONTRACTOR';
  work_type: 'PICK' | 'PACK' | 'MOVING' | 'RETURN' | 'HANDOVER';
  product_group: string;  // 'COSMETICS', 'FASHION', 'ELECTRONICS', etc.
  complexity: 'SINGLE_SKU' | 'MULTI_SKU' | 'COMPLEX';
  weight_class: 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'BULKY';
  
  // Performance Metrics
  metrics: {
    orders_per_hour: number;      // Main metric
    percentile_50: number;        // Median performance
    percentile_75: number;        // Good performance
    percentile_90: number;        // Excellent performance
    min_threshold: number;        // Minimum acceptable
    max_threshold: number;        // Maximum realistic
  };
  
  // Historical tracking
  history: {
    last_updated: string;
    auto_calculated_from: string; // Date range of historical data
    sample_size: number;          // Number of orders analyzed
    confidence_level: number;     // Statistical confidence %
  };
  
  // Adjustments
  adjustments: {
    field_table_multiplier: number;  // 0.7 (30% faster)
    prepack_multiplier: number;      // 0.5 (50% faster)
    rush_order_multiplier: number;   // 1.2 (20% slower due to urgency)
    training_period_multiplier: number; // 1.5 (50% slower for new staff)
  };
}
```

**UI with Editable Grid:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📊 Định mức Năng suất                    [Auto-update] [Export] [Import]│
├─────────────────────────────────────────────────────────────────────────┤
│ Filter: [Staff Level ▼] [Work Type ▼] [Product ▼]    Last update: Today│
├─────────────────────────────────────────────────────────────────────────┤
│ Staff   │ Work │ Product  │ Median │ P75 │ P90 │ Min │ Max │ Actions   │
├─────────┼──────┼──────────┼────────┼─────┼─────┼─────┼─────┼───────────┤
│ BOXME   │ PICK │ Cosmetic │ 45/h   │ 55  │ 65  │ 30  │ 80  │ [Edit]    │
│ BOXME   │ PACK │ Cosmetic │ 30/h   │ 38  │ 45  │ 20  │ 60  │ [Edit]    │
│ VETERAN │ PICK │ Fashion  │ 50/h   │ 60  │ 70  │ 35  │ 90  │ [Edit]    │
│ SEASONAL│ PACK │ Baby     │ 25/h   │ 30  │ 35  │ 15  │ 45  │ [Edit]    │
└─────────────────────────────────────────────────────────────────────────┘

[💡 Auto-calculate from last 90 days]  [🔄 Update selected]  [📥 Import CSV]
```

**Auto-calculation Feature:**
- Button to trigger recalculation from historical data
- Select date range (last 30/60/90 days)
- Statistical analysis with confidence intervals
- Review before applying changes
- Track changes history

#### 2.4. Carrier Configuration (`/settings/carriers`)

**Comprehensive Carrier Management (như hình 3):**
```typescript
interface CarrierConfig {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  
  // Service Types
  service_types: Array<{
    type: 'STANDARD' | 'EXPRESS' | 'INSTANT';
    max_capacity_per_window: number;
    cost_per_order: number;
  }>;
  
  // Pickup Windows (như hình 3)
  pickup_windows: Array<{
    day_of_week: number;      // 1=Monday
    time: string;             // "10:00"
    capacity: number;         // 5000
    cutoff_time: string;      // "21:00" - Deadline to prepare
    advance_limit: number;    // 1000 - Max orders can book early
  }>;
  
  // SLA & Quality
  sla: {
    standard_delivery_hours: number;  // 24-48h
    express_delivery_hours: number;   // 4-12h
    on_time_rate_target: number;      // 95%
    current_performance: number;      // 93.5%
  };
  
  // Integration
  integration: {
    api_endpoint: string;
    api_key: string;
    webhook_url: string;
    auto_sync_enabled: boolean;
  };
}
```

**UI Table (như hình 3):**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🚚 Hãng vận chuyển                                          [+ Thêm ĐVVC]│
├──────────────────────────────────────────────────────────────────────────┤
│ Hãng         │ Loại  │ Max/ca │ Giờ lấy    │ Cut-off │ Limit sớm │ [...]│
├──────────────┼───────┼────────┼────────────┼─────────┼───────────┼──────┤
│ SPX Express  │ Tiêu  │ 5000   │ 10h,16h,21h│ 21:00   │ 1000      │ [✏️] │
│ J&T Express  │ Tiêu  │ 3000   │ 11h, 17h   │ 20:00   │ 500       │ [✏️] │
│ Lazada (LEX) │ Tiêu  │ 4000   │ 12h, 18h   │ 20:00   │ 0         │ [✏️] │
│ SPX Hỏa Tốc  │ Hỏa   │ 500    │ Theo đơn   │ 21:00   │ 0         │ [✏️] │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 2.5. Platform SLA Rules (`/settings/platform-sla`)

**Visual SLA Cards (như hình 4):**
```typescript
interface PlatformSLARule {
  platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'TIKI' | 'SENDO';
  tier: 'STANDARD' | 'MALL' | 'INSTANT';
  
  // Timing Rules
  timing: {
    cutoff_time: string;           // "21:00"
    processing_deadline: string;   // "Trước 23:59 cùng ngày"
    internal_buffer: number;       // 2 hours
    handling_time_sla: string;     // "24h" | "Trong ngày"
  };
  
  // Quality Requirements
  quality: {
    pqr: { threshold: number; operator: 'LT' | 'GT'; description: string };
    lsr: { threshold: number; operator: 'LT' | 'GT'; description: string };
    ffr: { threshold: number; operator: 'LT' | 'GT'; description: string };
  };
  
  // Important Notes (Lưu ý Quan trọng - như hình 4)
  critical_notes: Array<{
    importance: 'CRITICAL' | 'WARNING' | 'INFO';
    text: string;
    effective_date: string;
  }>;
  
  // Visual Styling
  ui: {
    border_color: string;      // Orange for Shopee, Blue for Lazada
    priority_badge: string;    // "Cut-off Chính thức"
  };
}
```

**UI Layout (như hình 4):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎯 Quy định Sàn (SLA)                                    [Last updated] │
├─────────────────────────────────────────────────────────────────────────┤
│ ⚠️ Lưu ý Quan trọng [Cập nhật 2025]                                    │
│ • Shopee: PQR < 20% (Product Quality Rate). Hỏa tốc cắt lúc 21h.       │
│ • Lazada: FFR >= 75% cho LazMall (Fast Fulfillment Rate).              │
│ • TikTok: Đơn trước 18h phải giao trước 12h hôm sau.                   │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────┬─────────────────────┐
│ Shopee                   │ Shopee                   │ Lazada              │
│ NHANH (STANDARD)         │ HỎA TỐC                  │ LAZMALL             │
│ Cut-off: 21:00          │ Cut-off: 21:00          │ Cut-off: 20:00     │
├──────────────────────────┼──────────────────────────┼─────────────────────┤
│ Hạn xử lý:              │ Hạn xử lý:              │ Hạn xử lý:         │
│ Trước 23:59 cùng ngày   │ Trong ngày              │ 24h                │
│ Buffer nội bộ: 2 giờ    │ Buffer nội bộ: 1 giờ    │ Buffer nội bộ: 2h  │
│                          │                          │                     │
│ "LSR <= 8%, PQR < 20%"  │ "Từ 02/12/2024: 21h"    │ "FFR >= 75%"       │
└──────────────────────────┴──────────────────────────┴─────────────────────┘

┌──────────────────────────┐
│ TikTok                   │
│ STANDARD                 │
│ Cut-off: 18:00          │
├──────────────────────────┤
│ Hạn xử lý: Trong ngày   │
│ Buffer nội bộ: 1 giờ    │
│                          │
│ "Đơn sau 18h giao 12h"  │
└──────────────────────────┘
```

#### 2.6. Working Hours Management (`/settings/working-hours`)

**Shift Configuration (như hình 2):**
```typescript
interface ShiftConfiguration {
  warehouse_id: string;
  
  shifts: Array<{
    id: string;
    name: 'Ca Sáng' | 'Ca Chiều' | 'Ca Đêm' | 'Ca Tăng cường';
    start_time: string;    // "08:00"
    end_time: string;      // "17:00"
    duration_hours: number;
    
    // Staff allocation
    staff_allocation: {
      boxme: number;
      veteran: number;
      seasonal: number;
      contractor: number;
    };
    
    // Capacity
    capacity_percentage: number;  // % of daily total
    max_orders: number;
    
    // Days active
    days_of_week: number[];  // [1,2,3,4,5] = Mon-Fri
    
    // Break times
    breaks: Array<{
      start: string;
      duration_minutes: number;
    }>;
  }>;
  
  // Overlap strategy
  overlap: {
    enabled: boolean;
    peak_hours: string[];     // ["14:00-17:00", "19:00-21:00"]
    extra_staff_percentage: number;
  };
}
```

**UI Layout (như hình 2):**
```
┌─────────────────────────────────────────────────────┐
│ ⏰ Thời gian làm việc (Ca chuẩn)           [Edit]   │
├─────────────────────────────────────────────────────┤
│ Ca Sáng                            8    -    17     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (9h)   │
│ 50% capacity | 80 staff | Mon-Sun                   │
├─────────────────────────────────────────────────────┤
│ Ca Chiều                          14    -    22     │
│          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (8h)   │
│ 35% capacity | 60 staff | Mon-Sun                   │
├─────────────────────────────────────────────────────┤
│ Ca Đêm                            22    -    30     │
│                           ━━━━━━━━━━━━━━━━  (6h)   │
│ 15% capacity | 30 staff | Mon-Sat                   │
└─────────────────────────────────────────────────────┘

💡 Overlap: Ca Chiều & Ca Sáng (14:00-17:00) for peak hours
```

---

## 🎨 UX/UI DESIGN PRINCIPLES

### Design System

**Colors:**
- Primary: Blue #3B82F6
- Success: Green #22C55E
- Warning: Orange/Yellow #F59E0B
- Danger: Red #EF4444
- Info: Purple #A855F7

**Typography:**
- Headings: Inter Bold
- Body: Inter Regular
- Monospace (data): Roboto Mono

**Components:**
- Cards with shadows
- Tabbed interfaces
- Editable tables with inline editing
- Modal dialogs for complex forms
- Toast notifications for actions

### Responsive Design
- Desktop-first (primary users are operations staff)
- Tablet support for warehouse floor
- Mobile view for quick checks

### Accessibility
- Keyboard navigation
- ARIA labels
- High contrast mode
- Screen reader support

---

## 📊 DATABASE SCHEMA ADDITIONS

### New Tables Needed:

```sql
-- Warehouse management
CREATE TABLE warehouses (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    max_capacity_per_day INTEGER,
    is_active INTEGER DEFAULT 1
);

-- Shift configuration
CREATE TABLE shift_configurations (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT NOT NULL,
    shift_name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_hours REAL,
    capacity_percentage REAL,
    days_of_week TEXT, -- JSON array
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

-- Productivity standards (enhanced)
CREATE TABLE productivity_standards_v2 (
    id TEXT PRIMARY KEY,
    staff_level TEXT NOT NULL,
    work_type TEXT NOT NULL,
    product_group TEXT,
    complexity TEXT,
    weight_class TEXT,
    percentile_50 REAL,
    percentile_75 REAL,
    percentile_90 REAL,
    min_threshold REAL,
    max_threshold REAL,
    last_calculated DATE,
    sample_size INTEGER,
    UNIQUE(staff_level, work_type, product_group, complexity, weight_class)
);

-- Customer forecast submissions
CREATE TABLE customer_forecast_submissions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    forecast_date TEXT NOT NULL,
    orders INTEGER NOT NULL,
    submitted_by TEXT,
    submitted_at TEXT DEFAULT (datetime('now')),
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Forecast adjustments by staff
CREATE TABLE forecast_adjustments (
    id TEXT PRIMARY KEY,
    forecast_id TEXT NOT NULL,
    adjusted_by TEXT NOT NULL,
    adjusted_at TEXT DEFAULT (datetime('now')),
    original_value INTEGER,
    adjusted_value INTEGER,
    reason TEXT,
    FOREIGN KEY (forecast_id) REFERENCES daily_forecasts(id)
);

-- Pre-pack registrations
CREATE TABLE prepack_registrations (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    target_date TEXT NOT NULL,
    sku_code TEXT NOT NULL,
    quantity_registered INTEGER,
    quantity_prepacked INTEGER DEFAULT 0,
    quantity_pending INTEGER,
    status TEXT DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

---

## 🚀 IMPLEMENTATION ROADMAP

### Phase 2A: Customer Management (Week 1-2)

**Sprint 1: Customer APIs & Basic UI (5 days)**
- [ ] Customer CRUD APIs
- [ ] Customer list page
- [ ] Customer detail page - Overview tab
- [ ] Customer detail page - Operations tab

**Sprint 2: Advanced Customer Features (5 days)**
- [ ] SLA configuration tab
- [ ] Forecast management tab
- [ ] Order history tab with charts
- [ ] Product mix auto-calculation

### Phase 2B: Settings & Configuration (Week 3-4)

**Sprint 3: Warehouse & Productivity (5 days)**
- [ ] Warehouse management APIs & UI
- [ ] Shift configuration UI (như hình 2)
- [ ] Productivity standards grid with inline editing
- [ ] Auto-calculation from historical data

**Sprint 4: Carriers & Platform SLA (5 days)**
- [ ] Carrier configuration APIs & UI (như hình 3)
- [ ] Platform SLA rules UI (như hình 4)
- [ ] SLA compliance tracking
- [ ] Visual SLA cards with color coding

### Phase 2C: Integration & Testing (Week 5)

**Sprint 5: Integration & Polish (5 days)**
- [ ] Connect Customer config → Workforce calculation
- [ ] Connect Productivity standards → Workforce calculation
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation

---

## 🎯 SUCCESS METRICS

### User Experience:
- ⏱️ Configuration time: < 5 minutes per customer
- ⏱️ Forecast adjustment time: < 2 minutes
- ⏱️ SLA lookup time: < 10 seconds
- 😊 User satisfaction: > 4.5/5.0

### System Performance:
- 📊 Page load time: < 2 seconds
- 📊 API response time: < 500ms
- 📊 Bulk update time: < 5 seconds for 100 records
- 📊 Auto-calculation time: < 30 seconds for 90-day analysis

### Business Impact:
- 🎯 Forecast accuracy: Improve to < 15% MAPE
- 🎯 SLA compliance: > 98%
- 🎯 Planning time: Reduce from 6h/week to < 1h/week
- 🎯 Configuration errors: Reduce by 80%

---

**Timeline:** 5 weeks  
**Effort:** 2 FTE (1 Developer, 0.5 BA, 0.5 QA)  
**Priority:** HIGH - Critical for operational excellence

---

**Next Steps:**
1. Review và approve design
2. Create detailed wireframes
3. Start implementation Sprint 1
4. Weekly demo & feedback sessions
