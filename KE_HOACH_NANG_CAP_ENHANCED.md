# 🚀 KẾ HOẠCH NÂNG CẤP ENHANCED - BOXME FORECAST MVP
## Dựa trên Nghiên cứu Advanced Forecasting & Workforce Planning

**Ngày tạo:** 2025-12-11  
**Version:** 2.0 Enhanced  
**Trạng thái:** 🟢 Ready for Phase 2+ Development  

---

## 📊 TỔNG QUAN NÂNG CẤP

### So sánh với Kế hoạch Gốc

| Aspect | Kế hoạch Gốc (v1.0) | Kế hoạch Enhanced (v2.0) |
|--------|---------------------|--------------------------|
| **Forecasting** | Single Prophet + LightGBM | Hybrid Multi-Model Ensemble |
| **Workforce Planning** | 2-level (Daily → Staff) | 5-level Cascade (Campaign → Task) |
| **Data Schema** | 19 tables | 28+ tables (extended) |
| **Optimization** | Greedy allocation | MILP + Multi-objective |
| **UI Complexity** | Simple breakdown | Full cascade visualization |
| **Timeline** | 3-7 tuần | 8-16 tuần (phân nhiều phase) |

### Key Enhancements

1. **🎯 Multi-Model Forecasting Ensemble**
   - Prophet + LightGBM + TFT (Temporal Fusion Transformer)
   - Dynamic weight adjustment based on recent performance
   - Hierarchical reconciliation (warehouse → customer → line)

2. **🏗️ 5-Level Workforce Planning Cascade**
   ```
   Campaign/Event → Daily → Shift → Line → Task
   ```
   - Chi tiết đến từng task (PICK, PACK, MOVING, RETURN)
   - Phân bổ theo level (L1, L2, L3) và staff type (Boxme, Temp, Contractor)

3. **📐 Advanced Optimization**
   - MILP (Mixed Integer Linear Programming)
   - Multi-objective optimization (cost vs service level vs balance)
   - Heuristic fallback for fast computation

4. **🎨 Enhanced UI/UX**
   - Category Group × Carrier planning table (theo screenshots)
   - Auto-Fill tối ưu với AI suggestions
   - Smart hiring recommendations
   - Real-time capacity calculations

---

## 🗂️ PHẦN 1: EXTENDED DATA SCHEMA

### 1.1 New Tables (9 bảng mới)

```sql
-- =====================================================
-- CAMPAIGN PLANNING
-- =====================================================

CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'DOUBLE_DAY', 'SALARY_DAY', 'HOLIDAY'
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    peak_date DATE,
    
    warehouse_id TEXT REFERENCES warehouses(id),
    affects_all_customers BOOLEAN DEFAULT true,
    
    total_forecasted_orders INTEGER,
    total_forecasted_items INTEGER,
    
    day_distribution TEXT, -- JSON: {"D-1": 15, "D": 50, "D+1": 25, "D+2": 10}
    
    status TEXT DEFAULT 'DRAFT',
    
    total_staff_required INTEGER,
    total_boxme_staff INTEGER,
    total_temp_staff INTEGER,
    total_contractor_staff INTEGER,
    estimated_total_cost REAL,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaign_daily_plans (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    
    plan_date DATE NOT NULL,
    day_label TEXT NOT NULL, -- 'D-1', 'D', 'D+1', 'D+2', 'NORMAL'
    
    forecasted_orders INTEGER,
    forecasted_items INTEGER,
    percentage_of_campaign REAL,
    
    total_staff_required INTEGER,
    boxme_staff_required INTEGER,
    temp_staff_required INTEGER,
    contractor_staff_required INTEGER,
    
    status TEXT DEFAULT 'DRAFT',
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, plan_date)
);

-- =====================================================
-- SHIFT PLANNING
-- =====================================================

CREATE TABLE shift_plans (
    id TEXT PRIMARY KEY,
    campaign_daily_plan_id TEXT REFERENCES campaign_daily_plans(id) ON DELETE CASCADE,
    warehouse_id TEXT REFERENCES warehouses(id),
    shift_id TEXT,
    plan_date DATE NOT NULL,
    
    forecasted_orders INTEGER,
    forecasted_items INTEGER,
    
    total_staff_required INTEGER,
    boxme_staff INTEGER DEFAULT 0,
    temp_staff INTEGER DEFAULT 0,
    contractor_staff INTEGER DEFAULT 0,
    
    picker_count INTEGER DEFAULT 0,
    packer_count INTEGER DEFAULT 0,
    mover_count INTEGER DEFAULT 0,
    return_handler_count INTEGER DEFAULT 0,
    qc_count INTEGER DEFAULT 0,
    
    target_productivity REAL,
    target_output INTEGER,
    
    actual_orders_processed INTEGER,
    actual_items_processed INTEGER,
    actual_staff_count INTEGER,
    actual_productivity REAL,
    
    status TEXT DEFAULT 'PLANNED',
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id, plan_date, shift_id)
);

-- =====================================================
-- LINE/KÊNH PLANNING
-- =====================================================

CREATE TABLE line_plans (
    id TEXT PRIMARY KEY,
    shift_plan_id TEXT REFERENCES shift_plans(id) ON DELETE CASCADE,
    
    line_code TEXT NOT NULL,
    line_name TEXT NOT NULL,
    
    category_group TEXT NOT NULL, -- 'NHOM_1', 'NHOM_2', 'NHOM_3', 'NHOM_4', 'DA_CHIEN'
    carrier_code TEXT,
    
    is_field_table BOOLEAN DEFAULT false,
    field_table_config_id TEXT,
    
    forecasted_orders INTEGER,
    forecasted_items INTEGER,
    
    -- Staff - Boxme
    boxme_l1 INTEGER DEFAULT 0,
    boxme_l2 INTEGER DEFAULT 0,
    boxme_l3 INTEGER DEFAULT 0,
    boxme_total INTEGER DEFAULT 0,
    
    -- Staff - Temp
    temp_l1 INTEGER DEFAULT 0,
    temp_l2 INTEGER DEFAULT 0,
    temp_l3 INTEGER DEFAULT 0,
    temp_total INTEGER DEFAULT 0,
    
    total_staff INTEGER DEFAULT 0,
    
    in_time TEXT,
    out_time TEXT,
    effective_hours REAL,
    
    productivity_target REAL,
    capacity INTEGER,
    
    actual_orders_processed INTEGER,
    actual_productivity REAL,
    
    status TEXT DEFAULT 'PLANNED',
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(shift_plan_id, line_code)
);

-- =====================================================
-- TASK PLANNING
-- =====================================================

CREATE TABLE task_plans (
    id TEXT PRIMARY KEY,
    line_plan_id TEXT REFERENCES line_plans(id) ON DELETE CASCADE,
    
    task_type TEXT NOT NULL, -- 'PICK', 'PACK', 'MOVING', 'RETURN', 'QC', 'PREPACK'
    
    -- Picker
    boxme_picker INTEGER DEFAULT 0,
    temp_picker INTEGER DEFAULT 0,
    
    -- Packer by level
    boxme_packer_l1 INTEGER DEFAULT 0,
    boxme_packer_l2 INTEGER DEFAULT 0,
    boxme_packer_l3 INTEGER DEFAULT 0,
    temp_packer_l1 INTEGER DEFAULT 0,
    temp_packer_l2 INTEGER DEFAULT 0,
    temp_packer_l3 INTEGER DEFAULT 0,
    
    -- Other roles
    mover_count INTEGER DEFAULT 0,
    return_handler_count INTEGER DEFAULT 0,
    qc_count INTEGER DEFAULT 0,
    
    total_staff INTEGER DEFAULT 0,
    
    target_orders INTEGER,
    target_items INTEGER,
    target_productivity REAL,
    
    actual_orders INTEGER,
    actual_items INTEGER,
    actual_productivity REAL,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(line_plan_id, task_type)
);

-- =====================================================
-- PRODUCTIVITY CONFIGURATION
-- =====================================================

CREATE TABLE category_group_productivity (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT REFERENCES warehouses(id),
    
    category_group TEXT NOT NULL,
    carrier_code TEXT,
    
    -- Boxme productivity (orders/hour)
    boxme_l1_productivity REAL NOT NULL,
    boxme_l2_productivity REAL NOT NULL,
    boxme_l3_productivity REAL NOT NULL,
    
    -- Temp productivity
    temp_l1_productivity REAL,
    temp_l2_productivity REAL,
    temp_l3_productivity REAL,
    
    -- Field table productivity (higher)
    dachien_l1_productivity REAL,
    dachien_l2_productivity REAL,
    dachien_l3_productivity REAL,
    
    effective_date DATE NOT NULL,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id, category_group, carrier_code, effective_date)
);

CREATE TABLE task_ratio_config (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT REFERENCES warehouses(id),
    category_group TEXT NOT NULL,
    
    pick_ratio REAL DEFAULT 25,
    pack_ratio REAL DEFAULT 60,
    move_ratio REAL DEFAULT 10,
    return_ratio REAL DEFAULT 5,
    
    pick_productivity_multiplier REAL DEFAULT 1.5,
    
    effective_date DATE NOT NULL,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id, category_group, effective_date)
);

-- =====================================================
-- FORECAST MODEL PERFORMANCE
-- =====================================================

CREATE TABLE forecast_model_performance (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    forecast_date DATE NOT NULL,
    warehouse_id TEXT,
    
    predicted_value REAL,
    actual_value REAL,
    
    error_absolute REAL,
    error_percentage REAL,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(model_name, forecast_date, warehouse_id)
);

CREATE TABLE ensemble_weights_history (
    id TEXT PRIMARY KEY,
    effective_date DATE NOT NULL,
    warehouse_id TEXT,
    
    weights TEXT NOT NULL, -- JSON: {"prophet": 0.4, "lightgbm": 0.5, "tft": 0.1}
    
    reason TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- OPTIMIZATION RESULTS
-- =====================================================

CREATE TABLE optimization_runs (
    id TEXT PRIMARY KEY,
    shift_plan_id TEXT REFERENCES shift_plans(id),
    
    algorithm_used TEXT, -- 'MILP', 'HEURISTIC', 'MULTI_OBJECTIVE'
    
    objective_cost REAL,
    objective_service_level REAL,
    objective_contractor_ratio REAL,
    objective_balance REAL,
    
    is_feasible BOOLEAN,
    infeasibility_reasons TEXT,
    
    computation_time_ms INTEGER,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧠 PHẦN 2: MULTI-MODEL FORECASTING ENSEMBLE

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│          HYBRID FORECASTING ARCHITECTURE v2.0               │
└─────────────────────────────────────────────────────────────┘

INPUT LAYER
├── Historical Orders (24 months)
├── External Regressors (Customer forecasts, Events)
└── Real-time Signals (Live orders, Anomalies)

PREPROCESSING
├── Missing value imputation
├── Outlier detection (Isolation Forest)
├── Feature engineering (180+ features)
└── Normalization

BASE MODELS (Ensemble)
├── Statistical Models
│   ├── Prophet (trend + seasonality + holidays)
│   └── MSTL + ETS (decomposition)
├── Machine Learning
│   ├── LightGBM (short-term, feature-rich)
│   ├── XGBoost (robust alternative)
│   └── TFT (multi-horizon, attention-based) *Optional
└── Specialized Models
    ├── Croston/TSB (intermittent demand)
    └── Event Multiplier Model (double days)

ENSEMBLE LAYER
├── Dynamic Weight Selection (based on recent MAPE)
├── Weighted Averaging
└── Stacking Meta-learner (optional)

HIERARCHICAL RECONCILIATION
├── Bottom-up: Customer → Warehouse
├── Top-down: Warehouse → Customer
└── MinT Optimal Combination

POST-PROCESSING
├── Business Rules (capacity constraints, min/max)
├── Prediction Intervals (80%, 95%)
└── Anomaly Flags

OUTPUT
├── Point Forecast
├── Lower/Upper Bounds
├── Confidence Score (0-1)
├── Breakdown by Customer/Platform/Category
└── Model Contributions
```

### 2.2 Implementation Priority

#### Phase 2A: Core Ensemble (2 tuần)
**Priority: 🔴 HIGH**

**Bước 1:** Implement Prophet Forecaster
```typescript
class ProphetForecaster extends BaseForecaster {
  // Đã có code template trong file nghiên cứu
  // - Add Vietnamese holidays
  // - Custom seasonality (monthly salary days)
  // - Holiday effects for Double Days
  // - External regressors (customer forecasts)
}
```

**Bước 2:** Implement LightGBM Forecaster
```typescript
class LightGBMForecaster extends BaseForecaster {
  // Feature engineering (180+ features):
  // - Time features (day, month, cyclical encoding)
  // - Event features (double day, salary day, distance)
  // - Lag features (1, 7, 14, 28 days)
  // - Rolling statistics (mean, std, min, max)
  // - Customer forecast integration
  
  // Quantile regression for prediction intervals
  // - Train 3 models: Q10, Q50, Q90
}
```

**Bước 3:** Implement HybridForecastingPipeline
```typescript
class HybridForecastingPipeline {
  // Orchestrate multiple models
  // - Fit all models on historical data
  // - Generate predictions from each
  // - Dynamic weight adjustment (based on recent MAPE)
  // - Weighted ensemble
  // - Apply business rules
}
```

**API Endpoint:**
```typescript
POST /api/forecast/generate/v2
Body: {
  "warehouse_id": "wh-hcm-main",
  "target_date": "2025-12-15",
  "horizon": 30,
  "options": {
    "models": ["prophet", "lightgbm"],
    "include_breakdown": true,
    "confidence_level": 0.80
  }
}

Response: {
  "success": true,
  "forecast": {
    "date": "2025-12-15",
    "point_forecast": 15000,
    "lower_bound": 12750,
    "upper_bound": 17250,
    "confidence_score": 0.85,
    "model_contributions": {
      "prophet": 6000,
      "lightgbm": 9000
    },
    "breakdown": {
      "by_customer": {...},
      "by_platform": {...}
    }
  },
  "metadata": {
    "models_used": ["prophet", "lightgbm"],
    "computation_time_ms": 450,
    "data_points": 730
  }
}
```

#### Phase 2B: Advanced Models (4 tuần) *Optional*
**Priority: 🟡 MEDIUM**

**TFT (Temporal Fusion Transformer):**
- State-of-the-art multi-horizon forecasting
- Attention mechanism → interpretable
- Requires GPU, nhiều data (>1000 time series hoặc >3 years)
- **Khi nào implement:** Khi đã có đủ data và cần accuracy cao hơn

**Hierarchical Reconciliation:**
- Bottom-up: Forecast từng customer → aggregate lên warehouse
- Top-down: Forecast warehouse → disaggregate xuống customer
- MinT Optimal Combination: Tối ưu trọng số

---

## 🏗️ PHẦN 3: 5-LEVEL WORKFORCE PLANNING CASCADE

### 3.1 Cascade Overview

```
Level 1: CAMPAIGN/EVENT FORECAST
┌──────────────────────────────────────────────────────┐
│ Event: 11.11 Sale                                    │
│ Total Orders: 60,000 | Duration: D-1 → D+2 (4 days) │
│ D-1: 9,000 (15%) | D: 30,000 (50%)                  │
│ D+1: 15,000 (25%) | D+2: 6,000 (10%)                │
└──────────────────────────────────────────────────────┘
                    ↓
Level 2: DAILY BREAKDOWN BY CUSTOMER × PLATFORM × CATEGORY
┌──────────────────────────────────────────────────────┐
│ Date: Nov 11 (D Day) - 30,000 orders                │
│ • Unilever (Shopee, Cosmetics): 7,500 orders        │
│ • Samsung (Lazada, Electronics): 4,000 orders       │
│ • Coolmate (TikTok, Fashion): 11,000 orders         │
│ • Sunhouse (Shopee, Home Heavy): 2,500 orders       │
└──────────────────────────────────────────────────────┘
                    ↓
Level 3: SHIFT BREAKDOWN (CA LÀM VIỆC)
┌──────────────────────────────────────────────────────┐
│ Ca Sáng (8h-17h): 15,000 orders | 74 staff          │
│ Ca Chiều (14h-22h): 12,000 orders | 60 staff        │
│ Ca Đêm (22h-6h): 3,000 orders | 40 staff            │
└──────────────────────────────────────────────────────┘
                    ↓
Level 4: LINE/KÊNH BREAKDOWN (NHÓM NGÀNH HÀNG × CARRIER)
┌──────────────────────────────────────────────────────┐
│ Ca Sáng - By Line:                                   │
│ • Nhóm 1 - TTS: 1,560 orders | 7 staff              │
│ • Nhóm 1 - SPX: 2,080 orders | 13 staff             │
│ • Nhóm 4 - TTS: 2,535 orders | 22 staff             │
│ • Bàn Dã Chiến 1: 4,500 orders | 25 staff           │
└──────────────────────────────────────────────────────┘
                    ↓
Level 5: TASK & POSITION BREAKDOWN
┌──────────────────────────────────────────────────────┐
│ Ca Sáng - Line "Nhóm 1 - SPX":                      │
│ • PICK: 7 Boxme | Target: 2,080 | Prod: 42/h       │
│ • PACK: 3 L1, 9 L2, 3 L3 | Prod: 20/h              │
│ • MOVING: 2 staff | Prod: 80/h                      │
│ • RETURN: 1 staff | Prod: 30/h                      │
└──────────────────────────────────────────────────────┘
```

### 3.2 Implementation Roadmap

#### Task 3.1: Campaign Planning (1 tuần)
**Priority: 🔴 HIGH**

**API:**
```typescript
// Create campaign
POST /api/campaigns
Body: {
  "code": "DOUBLE_11_2024",
  "name": "11.11 Sale",
  "event_type": "DOUBLE_DAY",
  "start_date": "2024-11-10",
  "end_date": "2024-11-13",
  "peak_date": "2024-11-11",
  "warehouse_id": "wh-hcm-main",
  "day_distribution": {
    "D-1": 15,
    "D": 50,
    "D+1": 25,
    "D+2": 10
  }
}

// Generate full cascade plan
POST /api/campaigns/{id}/generate-plan
Response: {
  "campaign": {...},
  "daily_plans": [...],
  "shift_plans": [...],
  "line_plans": [...],
  "task_plans": [...],
  "summary": {
    "total_orders": 60000,
    "total_staff": 174,
    "total_cost": 30450000
  }
}
```

**Algorithm:**
```typescript
async function generateCascadePlan(campaignId: string) {
  // 1. Get forecasts for campaign dates
  const forecasts = await getForecastsForCampaign(campaignId);
  
  // 2. Create daily plans
  const dailyPlans = await generateDailyPlans(campaign, forecasts);
  
  // 3. For each day, create shift plans
  const shiftPlans = [];
  for (const dailyPlan of dailyPlans) {
    const shifts = await generateShiftPlans(dailyPlan);
    shiftPlans.push(...shifts);
  }
  
  // 4. For each shift, create line plans
  const linePlans = [];
  for (const shiftPlan of shiftPlans) {
    const lines = await generateLinePlans(shiftPlan);
    linePlans.push(...lines);
  }
  
  // 5. For each line, create task plans
  const taskPlans = [];
  for (const linePlan of linePlans) {
    const tasks = await generateTaskPlans(linePlan);
    taskPlans.push(...tasks);
  }
  
  return {
    campaign,
    dailyPlans,
    shiftPlans,
    linePlans,
    taskPlans
  };
}
```

#### Task 3.2: Line Plan Generation với Optimization (2 tuần)
**Priority: 🔴 HIGH**

**Key Logic:**
```typescript
async function generateLinePlans(shiftPlan: ShiftPlan) {
  const lineConfigs = await getLineConfigurations(shiftPlan.warehouse_id);
  const linePlans = [];
  
  for (const lineConfig of lineConfigs) {
    // Get forecasted orders for this line (by category group + carrier)
    const lineForecast = await getLineForecast(
      shiftPlan.plan_date,
      lineConfig.category_group,
      lineConfig.carrier_code
    );
    
    // Get productivity rates
    const productivity = await getProductivityRates(
      shiftPlan.warehouse_id,
      lineConfig.category_group,
      lineConfig.carrier_code
    );
    
    // Calculate required headcount
    const requiredHours = lineForecast.orders / productivity.avg;
    const requiredHeadcount = Math.ceil(requiredHours / shiftPlan.effective_hours);
    
    // Allocate staff by level (L1 > L2 > L3, Boxme > Temp)
    const allocation = await allocateStaffByLevel(
      requiredHeadcount,
      availableStaff,
      productivity,
      options
    );
    
    // Calculate capacity
    const capacity = calculateLineCapacity(
      allocation,
      productivity,
      shiftPlan.effective_hours
    );
    
    linePlans.push({
      shift_plan_id: shiftPlan.id,
      line_code: lineConfig.code,
      line_name: lineConfig.name,
      category_group: lineConfig.category_group,
      carrier_code: lineConfig.carrier_code,
      
      forecasted_orders: lineForecast.orders,
      forecasted_items: lineForecast.items,
      
      boxme_l1: allocation.boxme.L1,
      boxme_l2: allocation.boxme.L2,
      boxme_l3: allocation.boxme.L3,
      boxme_total: allocation.boxme.total,
      
      temp_l1: allocation.temp.L1,
      temp_l2: allocation.temp.L2,
      temp_l3: allocation.temp.L3,
      temp_total: allocation.temp.total,
      
      total_staff: allocation.boxme.total + allocation.temp.total,
      
      productivity_target: productivity.avg,
      capacity
    });
  }
  
  return linePlans;
}
```

#### Task 3.3: Task Plan Generation (1 tuần)
**Priority: 🟡 MEDIUM**

**Algorithm:**
```typescript
async function generateTaskPlans(linePlan: LinePlan) {
  const taskRatios = await getTaskRatioConfig(
    linePlan.warehouse_id,
    linePlan.category_group
  );
  
  const totalStaff = linePlan.total_staff;
  
  // Calculate staff per task based on ratios
  const pickStaff = Math.round(totalStaff * (taskRatios.pick_ratio / 100));
  const packStaff = Math.round(totalStaff * (taskRatios.pack_ratio / 100));
  const moveStaff = Math.round(totalStaff * (taskRatios.move_ratio / 100));
  const returnStaff = Math.round(totalStaff * (taskRatios.return_ratio / 100));
  
  return [
    {
      line_plan_id: linePlan.id,
      task_type: 'PICK',
      boxme_picker: Math.min(pickStaff, linePlan.boxme_total),
      temp_picker: Math.max(0, pickStaff - linePlan.boxme_total),
      total_staff: pickStaff,
      target_orders: linePlan.forecasted_orders,
      target_productivity: linePlan.productivity_target * taskRatios.pick_productivity_multiplier
    },
    {
      line_plan_id: linePlan.id,
      task_type: 'PACK',
      // Distribute packers by level
      ...distributePackersByLevel(packStaff, linePlan),
      total_staff: packStaff,
      target_orders: linePlan.forecasted_orders,
      target_productivity: linePlan.productivity_target
    },
    {
      line_plan_id: linePlan.id,
      task_type: 'MOVING',
      mover_count: moveStaff,
      total_staff: moveStaff,
      target_orders: linePlan.forecasted_orders,
      target_productivity: linePlan.productivity_target * 3
    },
    {
      line_plan_id: linePlan.id,
      task_type: 'RETURN',
      return_handler_count: returnStaff,
      total_staff: returnStaff,
      target_orders: Math.round(linePlan.forecasted_orders * 0.05),
      target_productivity: linePlan.productivity_target * 0.7
    }
  ];
}
```

---

## 🎯 PHẦN 4: ADVANCED OPTIMIZATION

### 4.1 MILP Optimization (Optional - Advanced)
**Priority: 🟢 LOW**

**Khi nào cần:**
- Khi có nhiều constraints phức tạp
- Cần tối ưu chi phí tuyệt đối
- Có đủ resources (computation time)

**Implementation với PuLP (Python):**
```python
# Có thể implement như Edge Function riêng
# hoặc local service với API endpoint

POST /api/optimization/milp
Body: {
  "shift_plan_id": "sp-123",
  "constraints": {
    "max_contractor_ratio": 0.3,
    "min_staff_per_line": 3,
    "max_overtime_hours": 2
  }
}

Response: {
  "is_feasible": true,
  "allocation": {...},
  "hiring": {...},
  "total_cost": 2850000,
  "computation_time_ms": 1200
}
```

### 4.2 Heuristic Optimization (Recommended)
**Priority: 🔴 HIGH**

**Greedy Algorithm:**
1. Sort lines by demand (descending)
2. For each line, allocate best available staff first (L1 > L2 > L3, Boxme > Temp)
3. Fill gaps with contractors
4. Apply 25% buffer for no-shows

**Advantage:**
- Fast (<100ms)
- Easy to implement
- Good enough for 90% cases

---

## 🎨 PHẦN 5: ENHANCED UI/UX

### 5.1 Campaign Planning Dashboard (New Page)

**URL:** `/campaigns`

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│ 📅 Campaign Management                                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│ [+ New Campaign]  [Import from Calendar]              │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Upcoming Campaigns                                │ │
│ │                                                   │ │
│ │ 🔥 11.11 Sale (Nov 10-13)                        │ │
│ │    60,000 orders | 174 staff | ₫30.4M           │ │
│ │    Status: PLANNED  [View] [Edit] [Generate]    │ │
│ │                                                   │ │
│ │ 🎄 12.12 Sale (Dec 11-14)                        │ │
│ │    75,000 orders | 210 staff | ₫38.5M           │ │
│ │    Status: DRAFT    [View] [Edit] [Generate]    │ │
│ └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 5.2 Planning & Optimization Screen (Enhanced)

**URL:** `/planning?date=2024-11-11`

**Dựa trên Screenshots từ file nghiên cứu:**

```
┌────────────────────────────────────────────────────────────────┐
│ Lập kế hoạch & Tối ưu                                          │
│ Tính toán Capacity theo từng công đoạn. Tự động đề xuất       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ [✨ Tự động Tối ưu (Auto-Fill)]  📅 [Ngày D (11/11/2024)] ▼   │
│                                                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 💡 Đề xuất Tuyển dụng Temp (Smart Hiring)                     │
│                                                                │
│ CA SÁNG: [25 Standard] [9 Fast Track]                         │
│ CA CHIỀU: [19 Standard] [8 Fast Track]                        │
│ CA ĐÊM: [60 Standard] [15 Fast Track]                         │
│                                                                │
│ ⚠️ Cảnh báo: Đang sử dụng 74 nhân sự Boxme (Ca cao điểm),    │
│    vượt quá biên chế chính thức (45).                         │
│                                                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📊 Tổng quan Shift                                             │
│                                                                │
│ ┌─────────────┬─────────────┬─────────────┐                  │
│ │ ☀️ Ca Sáng  │ 🌅 Ca Chiều │ 🌙 Ca Đêm   │                  │
│ │ 15,000 đơn  │ 12,000 đơn  │ 3,000 đơn   │                  │
│ │ 57,000 items│ 45,600 items│ 11,400 items│                  │
│ │ 74 nhân sự  │ 60 nhân sự  │ 40 nhân sự  │                  │
│ └─────────────┴─────────────┴─────────────┘                  │
│                                                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📋 Phân bổ Nhân sự theo Line (Kênh × Nhóm hàng)               │
│                                                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Line/Kênh   │Carrier│Orders│Staff│Prod│Output│Capacity│   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ Nhóm 1-TTS  │  TTS  │1,560 │  7  │30/h│1,890 │ ✓ 119% │   │
│ │ Nhóm 1-SPX  │  SPX  │2,080 │ 13  │30/h│2,800 │ ✓ 135% │   │
│ │ Nhóm 4-TTS  │  TTS  │2,535 │ 22  │20/h│2,535 │ ✓ 100% │   │
│ │ Bàn DC 1    │  Mix  │4,500 │ 25  │50/h│4,500 │ ✓ 100% │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 🔨 Chi tiết Task Breakdown (Mở rộng...)                       │
│                                                                │
│ 📊 [Chart: Staff Mix]   💰 [Cost Breakdown]                   │
│                                                                │
│ [💾 Save Plan] [📤 Export Excel] [📱 Send to Lark]           │
└────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Auto-Fill Button:** Gọi optimization algorithm → tự động fill staff
- **Smart Hiring Badges:** Hiển thị số lượng temp cần tuyển theo shift
- **Real-time Capacity:** Cập nhật capacity % khi edit staff numbers
- **Expandable Task Details:** Click line để xem PICK, PACK, MOVING, RETURN breakdown
- **Multi-format Export:** Excel, CSV, Lark Base

### 5.3 Category Group × Carrier Planning Table

**Dựa trên Excel Screenshot:**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ KẾ HOẠCH TRIỂN KHAI THEO TỪNG KÊNH BÁN - NHÓM NGÀNH HÀNG                           │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Tổng kế hoạch: 43 | Tổng thực đạt: ...                                              │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│ 🌅 CA NGÀY (7:00 - 22:00) - 13,195 đơn | 7 Boxme, 37 Temp                          │
│                                                                                      │
│ ┏━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ NHÓM HÀNG 1   ┃ BOXME                    ┃ THỜI VỤ                          ┃ │
│ ┃ (Mỹ phẩm)     ┃ L1│SL1│L2│SL2│L3│SL3│In│Out│L1│SL1│L2│SL2│L3│SL3│In│Out│Đơn┃ │
│ ┣━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫ │
│ ┃ TTS           ┃40│ 3│35│ -│30│ -│ 7│22│30│ -│25│20│16│ -│ 7│20│3,200      ┃ │
│ ┃ SPX           ┃40│ 4│35│ -│30│ -│ 7│22│30│ -│25│14│ -│ -│ -│ -│2,800      ┃ │
│ ┃ LEX           ┃40│-2│35│ -│30│ -│-2│ -│30│ -│25│ -│ -│ 3│ -│ -│    0      ┃ │
│ ┗━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                                                      │
│ ┏━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ NHÓM HÀNG 2   ┃ ...                                                          ┃ │
│ ┗━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                                                      │
│ 🌙 CA ĐÊM (22:00 - 06:00) - ... đơn | ... Boxme, ... Temp                          │
│ ...                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Implementation Notes:**
- Editable cells (inline editing như Excel)
- Auto-calculate SL (số lượng) based on productivity + orders
- Color coding:
  - 🟢 Green: Sufficient capacity
  - 🟡 Yellow: Near capacity
  - 🔴 Red: Insufficient capacity
- Real-time updates khi edit numbers

---

## 📅 PHẦN 6: IMPLEMENTATION TIMELINE EXTENDED

### Phase 2A: Enhanced Forecasting (3 tuần)
**Timeline:** Tuần 3-5

| Task | Duration | Priority |
|------|----------|----------|
| Implement Prophet Forecaster | 3 ngày | 🔴 HIGH |
| Implement LightGBM Forecaster | 4 ngày | 🔴 HIGH |
| Feature Engineering (180+ features) | 3 ngày | 🔴 HIGH |
| HybridForecastingPipeline | 3 ngày | 🔴 HIGH |
| Dynamic Weight Adjustment | 2 ngày | 🟡 MEDIUM |
| API Integration & Testing | 3 ngày | 🔴 HIGH |

**Deliverables:**
- `/api/forecast/generate/v2` endpoint
- Multi-model ensemble working
- Confidence scores calculated
- Model performance tracking

### Phase 2B: Cascade Workforce Planning (4 tuần)
**Timeline:** Tuần 6-9

| Task | Duration | Priority |
|------|----------|----------|
| Database Migration (9 new tables) | 2 ngày | 🔴 HIGH |
| Campaign Planning API | 4 ngày | 🔴 HIGH |
| Shift Plan Generation | 3 ngày | 🔴 HIGH |
| Line Plan Generation | 5 ngày | 🔴 HIGH |
| Task Plan Generation | 3 ngày | 🟡 MEDIUM |
| Heuristic Optimization | 4 ngày | 🔴 HIGH |
| API Testing & Integration | 3 ngày | 🔴 HIGH |

**Deliverables:**
- Full cascade từ Campaign → Task
- 5-level hierarchy working
- Optimization algorithm implemented
- Smart hiring recommendations

### Phase 2C: Enhanced UI/UX (3 tuần)
**Timeline:** Tuần 10-12

| Task | Duration | Priority |
|------|----------|----------|
| Campaign Dashboard (/campaigns) | 4 ngày | 🔴 HIGH |
| Enhanced Planning Screen | 5 ngày | 🔴 HIGH |
| Category × Carrier Table | 4 ngày | 🔴 HIGH |
| Auto-Fill Button Integration | 3 ngày | 🔴 HIGH |
| Export Functions (Excel, Lark) | 2 ngày | 🟡 MEDIUM |
| Mobile Optimization | 3 ngày | 🟡 MEDIUM |

**Deliverables:**
- Campaign management UI
- Advanced planning table
- Real-time capacity updates
- Export to multiple formats

### Phase 3: Advanced Features (4 tuần - Optional)
**Timeline:** Tuần 13-16

| Task | Duration | Priority |
|------|----------|----------|
| TFT Model Implementation | 6 ngày | 🟢 LOW |
| MILP Optimization | 5 ngày | 🟢 LOW |
| Multi-objective Optimization | 4 ngày | 🟢 LOW |
| Hierarchical Reconciliation | 4 ngày | 🟢 LOW |
| Advanced Analytics Dashboard | 5 ngày | 🟡 MEDIUM |

**Deliverables:**
- State-of-the-art forecasting models
- Optimal workforce allocation
- Pareto-optimal solutions
- Advanced reporting

---

## 🎯 TỔNG KẾT & PRIORITIES

### Critical Path (MUST DO)

#### ✅ Phase 1 (Đã hoàn thành 60%)
- Core database & seed data
- Basic forecasting (Baseline + ML)
- Dashboard, Calendar, Settings UI

#### 🔴 Phase 2A: Enhanced Forecasting (3 tuần)
**Bắt đầu ngay:**
1. Generate 24 months historical data
2. Implement Prophet + LightGBM ensemble
3. Deploy forecast API v2

**Impact:** 
- Tăng accuracy từ 20% → <15% MAPE
- Confidence scores for decisions
- Better peak day predictions

#### 🔴 Phase 2B: Cascade Workforce Planning (4 tuần)
**Sau Phase 2A:**
1. Extend database schema (9 tables)
2. Implement 5-level cascade
3. Heuristic optimization

**Impact:**
- Chi tiết planning đến task level
- Auto staff allocation
- Smart hiring recommendations
- Tiết kiệm 5+ giờ planning mỗi tuần

#### 🔴 Phase 2C: Enhanced UI (3 tuần)
**Parallel với Phase 2B:**
1. Campaign dashboard
2. Enhanced planning screen
3. Category × Carrier table

**Impact:**
- Better UX for planners
- Visual capacity monitoring
- Quick decision making

### Optional Enhancements (NICE TO HAVE)

#### 🟡 Phase 3: Advanced Features (4 tuần)
**Khi có thời gian:**
- TFT deep learning model
- MILP optimization
- Multi-objective solutions

**Impact:**
- State-of-the-art accuracy
- Truly optimal solutions
- Research paper potential

---

## 📊 SUCCESS METRICS EXTENDED

### Phase 2 Targets

| Metric | Current | Target Phase 2 | Target Phase 3 |
|--------|---------|----------------|----------------|
| **Forecast MAPE** | N/A | <15% | <12% |
| **Peak Day MAPE** | N/A | <25% | <20% |
| **Planning Time** | 6h/week | <2h/week | <1h/week |
| **Staff Allocation Accuracy** | Manual | 85% | 95% |
| **Capacity Utilization** | Unknown | 90% | 95% |
| **Cost Optimization** | Baseline | 10% savings | 20% savings |
| **UI Response Time** | <100ms | <200ms | <150ms |
| **System Uptime** | 100% (local) | >99% | >99.5% |

### Business Impact Targets

- ⏰ **Time Savings:** 4-5 giờ/tuần planning time
- 💰 **Cost Savings:** 1.84M VND/ngày với optimal routing
- 📈 **Efficiency Gains:** 30-50% với Field Table + Pre-pack
- 🎯 **Accuracy:** <15% MAPE cho daily forecasts
- 🚀 **Service Level:** 98% SLA compliance

---

## 🤔 DECISION POINTS

### Should we implement Phase 2A-C? (Recommended: YES)
**Pros:**
- Significant accuracy improvements
- Complete workforce planning solution
- Production-ready features
- Competitive advantage

**Cons:**
- 10 tuần additional development
- More complexity to maintain
- Higher initial learning curve

**Recommendation:** ✅ **YES** - Implement Phase 2A-C
- Clear business value
- Manageable timeline
- Builds on solid Phase 1 foundation

### Should we implement Phase 3? (Recommended: EVALUATE LATER)
**Pros:**
- State-of-the-art forecasting
- Truly optimal solutions
- Cutting-edge technology

**Cons:**
- Diminishing returns (95% → 98% accuracy)
- High complexity
- Requires GPU/ML expertise
- 4 tuần additional dev time

**Recommendation:** 🟡 **EVALUATE AFTER PHASE 2**
- First validate Phase 2 results
- Measure actual business impact
- Assess if 3-5% improvement worth the effort

---

## 📞 NEXT STEPS

### Immediate Actions (This Week)

1. **Review & Approval**
   - Present enhanced plan to stakeholders
   - Get buy-in for Phase 2A-C (10 tuần investment)
   - Prioritize features if budget/time constrained

2. **Resource Planning**
   - Allocate developer time for Phase 2A (3 tuần)
   - Identify data sources for 24 months history
   - Setup development/staging environments

3. **Kick-off Phase 2A**
   - Generate historical data
   - Begin Prophet implementation
   - Setup model performance tracking

### Long-term Roadmap

**Tháng 1-2:** Phase 2A (Enhanced Forecasting)  
**Tháng 2-3:** Phase 2B (Cascade Planning)  
**Tháng 3-4:** Phase 2C (Enhanced UI)  
**Tháng 4-5:** Phase 3 (Advanced Features) *if approved*  
**Tháng 5+:** Production optimization & scaling

---

## 📚 REFERENCES & RESOURCES

### Research Documents
- ✅ `Boxme Forecast Resource.md` - Cascade planning & UI specs
- ✅ `Forecast Boxme Enhance.md` - Advanced algorithms research
- ✅ `KE_HOACH_PHAT_TRIEN.md` - Original plan v1.0

### External Resources
- 📖 Prophet Documentation: https://facebook.github.io/prophet/
- 📖 LightGBM: https://lightgbm.readthedocs.io/
- 📖 PyTorch Forecasting (TFT): https://pytorch-forecasting.readthedocs.io/
- 📖 PuLP Optimization: https://coin-or.github.io/pulp/

### Technical References
- 📄 Hyndman & Athanasopoulos - Forecasting: Principles and Practice
- 📄 Syntetos-Boylan - Intermittent Demand Forecasting
- 📄 Temporal Fusion Transformer Paper (2019)
- 📄 Hierarchical Forecast Reconciliation

---

**Last Updated:** 2025-12-11  
**Version:** 2.0 Enhanced  
**Status:** 🟢 Ready for Review & Approval  
**Next Review:** After Phase 2A completion
