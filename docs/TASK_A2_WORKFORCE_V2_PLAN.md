# PHASE A - TASK A2: WORKFORCE CALCULATION v2.0 API

## 📋 IMPLEMENTATION PLAN

### Current Status (Completed ✓)
- ✅ **Task A1**: Generated 121 daily forecasts (3 months historical + 1 month forward)
- ✅ Database initialized with all Phase 2 schemas (28 tables)
- ✅ Dev server running on port 3000
- ✅ Basic workforce calculation API exists (needs v2.0 upgrade)

### Task A2 Scope: Workforce Calculation v2.0 API

**Objective**: Implement multi-dimensional workforce calculation with customer-specific routing, productivity, and priority-based allocation.

**Timeline**: 1 week (5-7 days)

---

## 🎯 KEY FEATURES TO IMPLEMENT

### 1. Multi-Dimensional Order Routing
**Goal**: Route orders to optimal packing methods

**Routing Logic**:
```typescript
interface RoutingDecision {
  method: 'FIELD_TABLE' | 'PREPACK' | 'STANDARD';
  reason: string;
  eligible: boolean;
}

// Field Table criteria
- SKU count ≤ customer.field_table_max_sku (default 1)
- Item count ≤ customer.field_table_max_items (default 5)
- Weight ≤ customer.field_table_max_weight (default 1.0kg)
- Hero SKU match (optional)
→ 70% faster processing

// Pre-pack criteria
- Category in customer.prepack_categories
- Weight ≥ customer.prepack_min_weight (default 5.0kg)
- Weekly quota available
→ 50% time saved

// Standard
- All other orders
- Default processing
```

**Database Tables Used**:
- `customers`
- `customer_operations` (field_table_*, prepack_* config)
- `customer_product_mix` (category percentages)

---

### 2. Customer-Specific Productivity Calculation
**Goal**: Use actual customer/category productivity instead of averages

**Productivity Lookup**:
```typescript
// From productivity_standards_v2 table
interface ProductivityRate {
  category_code: string;
  avg_processing_minutes: number;  // Per order
  packing_method: 'FIELD_TABLE' | 'PREPACK' | 'STANDARD';
  staff_type: 'boxme' | 'seasonal' | 'veteran';
  efficiency_rate: number;  // 0.8 - 1.2
}

// Calculation
work_hours = Σ(orders_by_category * processing_minutes / 60)
```

**Database Tables Used**:
- `productivity_standards_v2`
- `customer_product_mix`
- `category_group_productivity`

---

### 3. Priority-Based Staff Allocation
**Goal**: Allocate staff by priority buckets (1-6)

**Priority Buckets** (from `priority_buckets` table):
1. **P1 - Instant**: Mall same-day < 4h (8am cutoff)
2. **P2 - Same Day**: Standard same-day (6pm cutoff)
3. **P3 - Next Day**: Next-day orders
4. **P4 - Standard**: 2-3 day delivery
5. **P5 - Economy**: 3-5 day delivery  
6. **P6 - Delayed**: Can delay if needed

**Allocation Strategy**:
```typescript
// Allocate staff by priority
for (let priority = 1; priority <= 6; priority++) {
  const orders = getOrdersByPriority(priority);
  const hours = calculateWorkHours(orders);
  const staff = allocateStaff(hours, priority);
  
  // If capacity insufficient
  if (staff.gap > 0) {
    if (priority >= 4) {
      // Can delay non-urgent orders
      delayOrders(orders, priority);
    } else {
      // Hire contractors
      hireContractors(staff.gap);
    }
  }
}
```

**Database Tables Used**:
- `priority_buckets`
- `priority_criteria`
- `customer_sla` (cutoff times, priority levels)

---

### 4. Smart Recommendations & Cost Analysis
**Goal**: Provide actionable insights and cost optimization

**Recommendations**:
```typescript
interface Recommendation {
  type: 'OPTIMIZATION' | 'ALERT' | 'INSIGHT';
  category: 'FIELD_TABLE' | 'PREPACK' | 'STAFF' | 'COST';
  message: string;
  impact: {
    time_saved_hours?: number;
    cost_saved_vnd?: number;
    orders_affected?: number;
  };
  action?: string;
}

// Examples:
- "Enable Field Table for Customer X → Save 1.84M VND/day"
- "Increase Pre-pack quota by 500 → Save 150 hours/week"
- "Hire 25 contractors for 11.11 peak → Avoid 30% SLA breach"
```

**Cost Breakdown**:
```typescript
interface CostAnalysis {
  by_method: {
    field_table: { hours, staff, cost };
    prepack: { hours, staff, cost };
    standard: { hours, staff, cost };
  };
  by_staff_type: {
    boxme: { count, cost_per_hour, total };
    seasonal: { count, cost_per_hour, total };
    veteran: { count, cost_per_hour, total };
    contractor: { count, bonus, meals, total };
  };
  total_cost: number;
  cost_savings: {
    field_table_enabled: number;
    prepack_enabled: number;
    total_potential: number;
  };
}
```

---

## 🔧 API SPECIFICATION

### Endpoint: `POST /api/workforce/calculate/v2`

**Request Body**:
```json
{
  "forecast_date": "2025-12-25",
  "customer_breakdown": true,
  "priority_analysis": true,
  "include_recommendations": true
}
```

**Response**:
```json
{
  "success": true,
  "forecast_date": "2025-12-25",
  "summary": {
    "total_orders": 45000,
    "total_hours": 2250,
    "total_staff": 282,
    "total_cost": 6140000,
    "alert_level": "warning",
    "contractor_needed": 52
  },
  "breakdown_by_method": [
    {
      "method": "FIELD_TABLE",
      "orders": 12000,
      "hours": 450,
      "staff": 57,
      "cost": 1260000,
      "percentage": 26.7
    },
    {
      "method": "PREPACK",
      "orders": 8000,
      "hours": 320,
      "staff": 40,
      "cost": 880000,
      "percentage": 17.8
    },
    {
      "method": "STANDARD",
      "orders": 25000,
      "hours": 1480,
      "staff": 185,
      "cost": 4000000,
      "percentage": 55.5
    }
  ],
  "breakdown_by_customer": [
    {
      "customer_id": "C001",
      "customer_name": "Shopee Vietnam",
      "orders": 15000,
      "methods": {
        "field_table": 8000,
        "prepack": 3000,
        "standard": 4000
      },
      "hours": 720,
      "staff": 90,
      "cost": 1980000
    }
  ],
  "breakdown_by_priority": [
    {
      "priority": 1,
      "name": "Instant (Mall Same-day)",
      "orders": 5000,
      "cutoff": "08:00",
      "hours": 280,
      "staff": 35,
      "staff_allocated": {
        "boxme": 25,
        "veteran": 10,
        "seasonal": 0
      }
    }
  ],
  "staff_allocation": {
    "by_type": {
      "boxme": { "needed": 197, "available": 150, "gap": 47 },
      "seasonal": { "needed": 56, "available": 50, "gap": 6 },
      "veteran": { "needed": 29, "available": 30, "gap": 0 }
    },
    "by_shift": {
      "morning": { "staff": 120, "orders": 18000 },
      "afternoon": { "staff": 100, "orders": 15000 },
      "evening": { "staff": 62, "orders": 12000 }
    }
  },
  "cost_analysis": {
    "regular_staff": 4800000,
    "contractor_bonus": 2600000,
    "meals": 1560000,
    "total": 8960000,
    "savings_if_optimized": {
      "field_table_boost": 840000,
      "prepack_boost": 640000,
      "total_potential": 1480000
    }
  },
  "recommendations": [
    {
      "type": "OPTIMIZATION",
      "category": "FIELD_TABLE",
      "priority": "HIGH",
      "message": "Enable Field Table for Customer C003 (Lazada)",
      "impact": {
        "orders_affected": 3000,
        "time_saved_hours": 90,
        "cost_saved_vnd": 460000
      },
      "action": "Update customer_operations.field_table_enabled = 1"
    },
    {
      "type": "ALERT",
      "category": "STAFF",
      "priority": "CRITICAL",
      "message": "Staff shortage on 2025-12-25 (11.11 peak)",
      "impact": {
        "gap_total": 52,
        "orders_at_risk": 8000
      },
      "action": "Hire 52 contractors by 2025-12-18 (7 days before)"
    }
  ]
}
```

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Create Workforce v2 Module (Day 1-2)
**File**: `src/workforce-v2.ts`

1. Create TypeScript interfaces
2. Implement order routing logic
3. Implement productivity lookup
4. Write unit tests

### Step 2: Integrate with Database (Day 3-4)
**File**: `src/index.tsx` (add new endpoint)

1. Query customer configurations
2. Query productivity standards
3. Query priority buckets
4. Calculate staff allocation

### Step 3: Add Smart Recommendations (Day 5)
**File**: `src/workforce-recommendations.ts`

1. Field Table opportunity detection
2. Pre-pack optimization analysis
3. Cost savings calculator
4. Alert generation logic

### Step 4: Testing & Validation (Day 6)
1. Unit tests for all modules
2. Integration tests with real data
3. Performance testing (< 200ms response)
4. Edge case handling

### Step 5: Documentation (Day 7)
1. API documentation
2. Algorithm explanation
3. Configuration guide
4. Usage examples

---

## 📊 SUCCESS METRICS

- ✅ API response time < 200ms
- ✅ Accuracy: Staff calculation within ±5% of actual needs
- ✅ Cost estimation within ±10% of actual
- ✅ All 3 routing methods implemented correctly
- ✅ Recommendations provide actionable insights
- ✅ Integration tests pass 100%

---

## 🚀 NEXT ACTIONS

**Immediate (This Week)**:
1. Create `src/workforce-v2.ts` module
2. Implement order routing logic
3. Add v2 endpoint to `src/index.tsx`
4. Test with generated forecast data

**After Task A2 Complete**:
→ Move to Task A3: Build Workforce Planning Page UI

---

**Last Updated**: 2025-12-19  
**Status**: Ready for development  
**Assigned To**: AI Developer  
**Review Date**: After Day 3 implementation
