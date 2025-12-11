# 📋 KẾ HOẠCH PHÁT TRIỂN TIẾP THEO - BOXME FORECAST MVP

**Ngày phân tích:** 2025-12-11  
**Phiên bản:** v1.0  
**Tình trạng dự án hiện tại:** 60% hoàn thành (Phase 2 đang triển khai)

---

## 🎯 TÓM TẮT TÌNH TRẠNG DỰ ÁN

### ✅ ĐÃ HOÀN THÀNH (Phase 1 + Một phần Phase 2)

#### 1. Database & Schema (100%)
- ✅ 19 tables đã được tạo và seed data
- ✅ Migration scripts hoàn chỉnh (5 files)
- ✅ Seed data đầy đủ cho:
  - 8 khách hàng (Coolmate, Simple, Bobby, Routine, KidsPlaza, Sapo, Elise, Vinamit)
  - 3 platforms (Shopee, Lazada, TikTok) với full SLA configs
  - 6 priority buckets (INSTANT → FLEXIBLE)
  - 3 kho (HCM Main, Hanoi, Da Nang)
  - 28 productivity standards
  - 48 calendar events (double days 2024-2025)

#### 2. Core APIs (60%)
- ✅ Dashboard KPIs API (`GET /api/dashboard/kpis`)
- ✅ Forecast generation API (`POST /api/forecast/generate`)
- ✅ Chart data API (`GET /api/forecast/chart`)
- ✅ Calendar API (`GET /api/calendar`)
- ✅ Alerts API (`GET /api/alerts`)
- ✅ Customer APIs (7 endpoints)
- ✅ Platform SLA APIs (4 endpoints)
- ✅ Settings APIs (7 endpoints - warehouses, productivity, carriers)

#### 3. Frontend Pages (80%)
- ✅ Dashboard với KPI cards + Chart.js visualization
- ✅ Calendar view (30 days grid)
- ✅ Alerts page
- ✅ Settings page (4 tabs: Warehouses, Productivity, Carriers, Platform SLA)
- ✅ Customer Management UI (5 tabs)
- ✅ Responsive navigation
- ✅ Real-time data loading với Axios

#### 4. Forecasting Models (100%)
- ✅ Baseline model (rule-based với peak day multipliers)
- ✅ ML model (moving average + exponential smoothing)
- ✅ Peak day detection từ calendar_events
- ✅ Weekend adjustments
- ✅ Ensemble approach

### ❌ CÒN THIẾU (40% còn lại)

#### 1. Data Layer
- ❌ Full 24 months historical data (có script nhưng chưa chạy)
- ❌ Real-time data sync với WMS/OPS

#### 2. Business Logic APIs
- ❌ **Workforce Calculation v2.0** (Core feature - CRITICAL)
  - Multi-dimensional order routing (Field Table, Pre-pack, Standard)
  - Customer-specific productivity calculation
  - Priority-based staff allocation
  - Smart recommendations
- ❌ Priority Queue System APIs
- ❌ Forecast adjustment APIs

#### 3. Frontend Pages
- ❌ **Workforce Planning Page** (HIGH PRIORITY)
  - Staff breakdown by shift/type
  - Cost estimation detail
  - Export functionality
- ❌ Enhanced Dashboard với customer breakdown
- ❌ Priority Queue Management UI

#### 4. Production Features
- ❌ Authentication & Authorization
- ❌ Production deployment
- ❌ Monitoring & Logging
- ❌ Backup & Recovery
- ❌ Error tracking

#### 5. Integrations
- ❌ WMS API integration (real orders data)
- ❌ OPS API integration (real workforce data)
- ❌ Lark Chat notifications
- ❌ Export to Lark Base / Excel

---

## 🚀 KẾ HOẠCH PHÁT TRIỂN 3 GIAI ĐOẠN

### 📌 GIAI ĐOẠN 1: HOÀN THIỆN CORE FEATURES (2 TUẦN - PRIORITY CAO NHẤT)

**Mục tiêu:** Hoàn thiện 100% các tính năng cốt lõi để hệ thống có thể đưa vào sử dụng thực tế

#### Tuần 1: Data & Workforce Calculation v2.0

##### Task 1.1: Generate Full 24 Months Historical Data ⏱️ 1 ngày
**Priority: 🔴 CRITICAL**

**Lý do quan trọng:**
- Không có historical data → không test được forecast accuracy
- Không có data → Dashboard KPIs hiển thị 0
- Không có data → không validate được workforce calculation

**Các bước thực hiện:**

```bash
# Step 1: Generate data
cd /home/user/webapp/Boxme-Forecast-MVP
npx tsx scripts/generate-fake-data.ts

# Step 2: Load vào database
wrangler d1 execute boxme-forecast-production --local --file=./generated-orders.sql

# Step 3: Verify
wrangler d1 execute boxme-forecast-production --local --command="
  SELECT 
    DATE(order_date) as date,
    COUNT(*) as orders,
    product_group
  FROM orders_history 
  GROUP BY DATE(order_date), product_group
  ORDER BY date DESC
  LIMIT 100
"

# Step 4: Test forecast với real data
curl -X POST http://localhost:3000/api/forecast/generate \
  -H "Content-Type: application/json" \
  -d '{"horizon": 30}'
```

**Kết quả mong đợi:**
- ✅ 730 days của orders (2 năm: 2024-2025)
- ✅ 10,000-40,000 orders/day (realistic range)
- ✅ Peak days (1/1, 2/2, ..., 11/11, 12/12) có multipliers đúng
- ✅ 4 product groups distributed properly (COSMETICS, FASHION, BABY, FOOD)

---

##### Task 1.2: Implement Workforce Calculation v2.0 API ⏱️ 3-4 ngày
**Priority: 🔴 CRITICAL**

**Đây là core business logic của toàn bộ hệ thống!**

**API Endpoint:** `POST /api/workforce/calculate/v2`

**Tính năng chính:**

1. **Multi-dimensional Order Routing**
   ```
   Đơn hàng → Phân loại:
   ├── Field Table (hero SKUs, single item, < 1kg) → 30% faster
   ├── Pre-pack (eligible categories, > 5kg) → 50% time saved
   └── Standard Line (default) → Normal processing
   ```

2. **Customer-specific Productivity**
   - Sử dụng `customer_product_mix.avg_processing_minutes`
   - Apply complexity multipliers từ `customer_operations`
   - Calculate by packing method (Field Table / Pre-pack / Standard)

3. **Priority-based Staff Allocation**
   ```
   INSTANT orders → Best staff (Boxme + Veteran)
   MALL orders → Priority allocation
   AT RISK orders → Immediate attention
   PISHIP → Standard allocation
   STANDARD → Standard allocation
   FLEXIBLE → Can delay
   ```

4. **Multi-dimensional Breakdown**
   - By customer (8 customers)
   - By packing method (Field Table / Pre-pack / Standard)
   - By priority level (6 levels)
   - By shift (Morning / Afternoon / Evening)

5. **Smart Recommendations**
   - Field Table opportunities
   - Pre-pack planning suggestions
   - Overtime warnings
   - Contractor recruitment needs

**Implementation File:** `src/api/workforce-v2.ts` hoặc thêm vào `src/index.tsx`

**Key Functions:**
```typescript
// 1. Order routing
function routeOrder(order) {
  if (isFieldTableEligible(order)) return 'field_table';
  if (isPrepackEligible(order)) return 'prepack';
  return 'standard';
}

// 2. Productivity calculation
function calculateProductivity(customer, method, productGroup) {
  const baseProductivity = getProductivityStandard(productGroup);
  const methodMultiplier = method === 'field_table' ? 1.3 : 
                          method === 'prepack' ? 1.5 : 1.0;
  const complexityMultiplier = customer.operations.complexity_factor;
  
  return baseProductivity * methodMultiplier * complexityMultiplier;
}

// 3. Staff allocation by priority
function allocateStaff(orders, availability) {
  // Sort by priority: INSTANT > MALL > AT_RISK > PISHIP > STANDARD > FLEXIBLE
  const sortedOrders = orders.sort((a, b) => a.priority_score - b.priority_score);
  
  // Allocate best staff to high-priority orders
  return {
    instant: allocateBestStaff(instantOrders, availability),
    mall: allocatePriorityStaff(mallOrders, availability),
    // ...
  };
}

// 4. Generate recommendations
function generateRecommendations(breakdown) {
  const recommendations = [];
  
  if (breakdown.field_table.potential > 1000) {
    recommendations.push({
      type: 'EFFICIENCY',
      message: `${breakdown.field_table.potential} đơn có thể dùng Field Table, tiết kiệm ${breakdown.field_table.time_saved} phút`,
      priority: 'HIGH'
    });
  }
  
  if (breakdown.prepack.eligible > 500) {
    recommendations.push({
      type: 'PLANNING',
      message: `Lên kế hoạch Pre-pack cho ${breakdown.prepack.eligible} đơn (D-1)`,
      priority: 'MEDIUM'
    });
  }
  
  return recommendations;
}
```

**API Response Structure:**
```json
{
  "forecast_date": "2025-12-15",
  "total_orders": 15000,
  
  "by_customer": [
    {
      "customer_id": "cust-coolmate",
      "customer_name": "Coolmate",
      "orders": 3500,
      "field_table_orders": 2100,
      "prepack_orders": 700,
      "standard_orders": 700,
      "staff_needed": 25,
      "estimated_cost": 4400000,
      "efficiency_gain": "28%"
    },
    // ... 7 more customers
  ],
  
  "by_method": {
    "field_table": {
      "orders": 4500,
      "efficiency_gain": "30%",
      "staff_needed": 15,
      "time_saved_minutes": 675,
      "potential_savings": 743000
    },
    "prepack": {
      "orders": 2000,
      "efficiency_gain": "50%",
      "staff_needed": 5,
      "time_saved_minutes": 1000,
      "potential_savings": 1100000
    },
    "standard": {
      "orders": 8500,
      "staff_needed": 60
    }
  },
  
  "by_priority": {
    "instant": { "orders": 500, "staff_allocated": 5 },
    "mall": { "orders": 2000, "staff_allocated": 15 },
    "at_risk": { "orders": 0, "staff_allocated": 0 },
    "piship": { "orders": 3000, "staff_allocated": 20 },
    "standard": { "orders": 8500, "staff_allocated": 40 },
    "flexible": { "orders": 1000, "staff_allocated": 5 }
  },
  
  "staff_allocation": {
    "total_needed": 85,
    "boxme": 60,
    "veteran": 17,
    "seasonal": 8,
    "contractor": 0,
    "gap": 0
  },
  
  "costs": {
    "regular": 14960000,
    "contractor_bonus": 0,
    "meals": 0,
    "overtime": 0,
    "total": 14960000
  },
  
  "alerts": [
    {
      "level": "INFO",
      "type": "FIELD_TABLE_OPPORTUNITY",
      "message": "4500 đơn có thể dùng Field Table, tiết kiệm 30% thời gian"
    }
  ],
  
  "recommendations": [
    "Sử dụng Field Table cho Coolmate hero SKUs: tiết kiệm 675 phút (743K VND)",
    "Pre-pack cho Bobby diapers orders (D-1): tiết kiệm 1000 phút (1.1M VND)",
    "Tổng tiết kiệm: 1.84M VND nếu tối ưu routing"
  ]
}
```

**Testing:**
```bash
# Test 1: Basic calculation
curl -X POST http://localhost:3000/api/workforce/calculate/v2 \
  -H "Content-Type: application/json" \
  -d '{"forecast_date":"2025-12-15"}'

# Test 2: With breakdowns
curl -X POST http://localhost:3000/api/workforce/calculate/v2 \
  -H "Content-Type: application/json" \
  -d '{
    "forecast_date":"2025-12-15",
    "breakdown_by": ["customer", "method", "priority"],
    "include_recommendations": true
  }'

# Test 3: Peak day
curl -X POST http://localhost:3000/api/workforce/calculate/v2 \
  -H "Content-Type: application/json" \
  -d '{"forecast_date":"2025-12-12"}'
```

---

#### Tuần 2: Workforce Planning UI & Testing

##### Task 1.3: Build Workforce Planning Page v2.0 ⏱️ 3-4 ngày
**Priority: 🔴 HIGH**

**URL:** `/workforce` hoặc `/planning`

**Layout Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│ Navigation Bar                                               │
├─────────────────────────────────────────────────────────────┤
│ 📅 Date Selector: [2025-12-15] [Tomorrow] [Next Peak]      │
│ Customer Filter: [All] [Coolmate] [Simple] [Bobby] ...      │
├─────────────────────────────────────────────────────────────┤
│ KPI Cards Row:                                               │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│ │Orders│ │Staff │ │Cost  │ │Gap   │ │Savings│              │
│ │15,000│ │ 85   │ │14.9M │ │  0   │ │1.84M │              │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
├─────────────────────────────────────────────────────────────┤
│ Breakdown by Customer (Table):                               │
│ ┌──────────┬─────┬──────┬────────┬──────┬──────┬───────┐  │
│ │Customer  │Order│Staff │Cost    │Field │Prepack│Saving│  │
│ ├──────────┼─────┼──────┼────────┼──────┼──────┼───────┤  │
│ │Coolmate  │3500 │25    │4.4M    │2100  │700   │1.23M │  │
│ │Simple    │2800 │20    │3.5M    │1200  │400   │840K  │  │
│ │...       │...  │...   │...     │...   │...   │...   │  │
│ └──────────┴─────┴──────┴────────┴──────┴──────┴───────┘  │
├──────────────────────────┬──────────────────────────────────┤
│ By Packing Method:       │ By Priority:                     │
│ ┌────────────────┐       │ ┌────────────────┐              │
│ │ Donut Chart    │       │ │ Bar Chart      │              │
│ │ - Field Table  │       │ │ - INSTANT: 500 │              │
│ │ - Pre-pack     │       │ │ - MALL: 2000   │              │
│ │ - Standard     │       │ │ - PISHIP: 3000 │              │
│ └────────────────┘       │ │ - STANDARD:8500│              │
│                          │ └────────────────┘              │
├──────────────────────────┴──────────────────────────────────┤
│ Staff Allocation Detail:                                     │
│ ┌───────┬────────┬─────────┬─────┬────────────┐            │
│ │Type   │Needed  │Available│Gap  │Allocation  │            │
│ ├───────┼────────┼─────────┼─────┼────────────┤            │
│ │Boxme  │60      │80       │-20  │✓ Sufficient│            │
│ │Veteran│17      │30       │-13  │✓ Sufficient│            │
│ │Seasonal│8      │20       │-12  │✓ Sufficient│            │
│ │Contract│0      │0        │0    │✓ Not needed│            │
│ └───────┴────────┴─────────┴─────┴────────────┘            │
├─────────────────────────────────────────────────────────────┤
│ 💡 Smart Recommendations:                                   │
│ • Sử dụng Field Table cho Coolmate hero SKUs: tiết kiệm     │
│   675 phút (743K VND)                                        │
│ • Pre-pack cho Bobby diapers orders (D-1): tiết kiệm 1000   │
│   phút (1.1M VND)                                            │
│ • Tổng tiết kiệm: 1.84M VND nếu tối ưu routing             │
├─────────────────────────────────────────────────────────────┤
│ Actions:                                                     │
│ [🔄 Calculate] [📊 Export CSV] [📱 Send to Lark]          │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**

1. **Interactive Date & Customer Selection**
   - Date picker với quick buttons
   - Customer multi-select dropdown
   - Auto-refresh on selection change

2. **Multi-dimensional Visualization**
   - Customer breakdown table (sortable, filterable)
   - Packing method donut chart (Chart.js)
   - Priority bar chart
   - Staff allocation table

3. **Real-time Calculations**
   - Calls `/api/workforce/calculate/v2` on date change
   - Shows loading states
   - Error handling with retry

4. **Smart Recommendations Panel**
   - Highlights efficiency opportunities
   - Shows cost savings potential
   - Action buttons for each recommendation

5. **Export Functions**
   - Export to CSV
   - Send to Lark Chat (future)
   - Copy to clipboard

**Implementation:** `src/index.tsx` - thêm route `/workforce`

---

##### Task 1.4: Testing & Bug Fixes ⏱️ 2 ngày
**Priority: 🔴 HIGH**

**Test Scenarios:**

1. **Forecast Generation**
   - Normal day forecast
   - Peak day forecast (12/12, 11/11)
   - Weekend adjustments
   - Accuracy calculation (sau khi có actual data)

2. **Workforce Calculation**
   - Test với 8 customers
   - Test Field Table routing
   - Test Pre-pack routing
   - Test priority allocation
   - Verify cost calculations

3. **UI/UX Testing**
   - Dashboard loads correctly
   - Calendar view works
   - Workforce page interactions
   - Mobile responsiveness
   - Error states
   - Loading states

4. **Edge Cases**
   - No orders day
   - Extremely high volume (100K+ orders)
   - Missing customer data
   - Database connection failures

**Testing Commands:**
```bash
# Unit tests
npm run test

# API tests
curl -X GET http://localhost:3000/api/dashboard/kpis
curl -X POST http://localhost:3000/api/forecast/generate -d '{"horizon":30}'
curl -X POST http://localhost:3000/api/workforce/calculate/v2 -d '{"forecast_date":"2025-12-15"}'

# Load testing (optional)
ab -n 1000 -c 10 http://localhost:3000/api/dashboard/kpis
```

---

### 📌 GIAI ĐOẠN 2: PRODUCTION DEPLOYMENT (1 TUẦN)

**Mục tiêu:** Deploy hệ thống lên production và đảm bảo stability

#### Task 2.1: Production Environment Setup ⏱️ 2 ngày
**Priority: 🟡 MEDIUM**

**Steps:**

1. **Create Production D1 Database**
```bash
wrangler d1 create boxme-forecast-production
# Output: database_id = xxxxx-xxxxx-xxxxx
```

2. **Update wrangler.jsonc**
```jsonc
{
  "name": "boxme-forecast",
  "pages_build_output_dir": "dist",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "boxme-forecast-production",
      "database_id": "your-actual-database-id-here"
    }
  ],
  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

3. **Run Production Migrations**
```bash
npm run db:migrate:prod

# Verify
wrangler d1 execute boxme-forecast-production --command="
  SELECT name FROM sqlite_master WHERE type='table'
"
```

4. **Seed Production Data**
```bash
# Calendar events & productivity standards
wrangler d1 execute boxme-forecast-production --file=./seed.sql

# Customer data
wrangler d1 execute boxme-forecast-production --file=./migrations/0003_phase2_seed_data.sql

# Settings data
wrangler d1 execute boxme-forecast-production --file=./migrations/0005_settings_seed_data.sql

# Optional: Historical data (large file - 50MB+)
# wrangler d1 execute boxme-forecast-production --file=./generated-orders.sql
```

5. **Configure Environment Variables**
```bash
# For authentication (Phase 3)
wrangler pages secret put ADMIN_USER
wrangler pages secret put ADMIN_PASS
wrangler pages secret put JWT_SECRET
```

6. **Build & Deploy**
```bash
# Build production bundle
npm run build

# Deploy to Cloudflare Pages
npm run deploy

# Or manual:
wrangler pages deploy dist --project-name boxme-forecast
```

7. **Custom Domain (Optional)**
```bash
wrangler pages domain add forecast.boxme.asia --project-name boxme-forecast
```

---

#### Task 2.2: Monitoring & Logging Setup ⏱️ 1 ngày
**Priority: 🟡 MEDIUM**

**Option 1: Cloudflare Built-in Analytics**
- Đã có sẵn trong Cloudflare Dashboard
- Metrics: Page views, Requests, Errors, Response times
- No setup required

**Option 2: Custom Logging**
```typescript
// Add to src/index.tsx

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  console.log(`[${new Date().toISOString()}] ${method} ${path} - ${status} - ${duration}ms`);
});

// Error tracking
app.onError((err, c) => {
  console.error(`[ERROR] ${err.message}`, {
    path: c.req.path,
    method: c.req.method,
    stack: err.stack
  });
  
  // Optional: Send to external service (Sentry, Datadog, etc.)
  
  return c.json({ 
    error: 'Internal Server Error',
    message: err.message 
  }, 500);
});
```

**Option 3: Health Check Endpoint**
```typescript
app.get('/health', async (c) => {
  const { DB } = c.env;
  
  try {
    // Check database connection
    const result = await DB.prepare('SELECT 1').first();
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: result ? 'connected' : 'disconnected',
      version: '1.0.0'
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message
    }, 503);
  }
});
```

---

#### Task 2.3: Backup & Recovery Plan ⏱️ 1 ngày
**Priority: 🟡 MEDIUM**

**1. Automated Database Backup**

Tạo script: `scripts/backup-db.sh`
```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="backups"

mkdir -p $BACKUP_DIR

echo "📦 Backing up Boxme Forecast database..."

# Export database
wrangler d1 export boxme-forecast-production > $BACKUP_DIR/backup-$DATE.sql

# Compress
gzip $BACKUP_DIR/backup-$DATE.sql

echo "✅ Backup completed: $BACKUP_DIR/backup-$DATE.sql.gz"

# Keep only last 30 days
find $BACKUP_DIR -name "backup-*.sql.gz" -mtime +30 -delete

echo "🧹 Cleaned old backups (>30 days)"
```

**2. Git Repository Backup**
```bash
# Tag release
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0

# Push to GitHub (private repo)
git remote add origin https://github.com/lariamateo5036-del/Boxme-Forecast-MVP.git
git push origin main --tags
```

**3. Recovery Procedure**

Document: `RECOVERY.md`
```markdown
# Recovery Procedures

## Database Recovery
1. List available backups:
   ```bash
   ls -lh backups/
   ```

2. Restore from backup:
   ```bash
   gunzip backups/backup-2025-12-11.sql.gz
   wrangler d1 execute boxme-forecast-production --file=backups/backup-2025-12-11.sql
   ```

## Application Recovery
1. Rollback deployment:
   ```bash
   wrangler pages deployment list --project-name boxme-forecast
   wrangler pages deployment rollback <deployment-id> --project-name boxme-forecast
   ```

2. Redeploy from tag:
   ```bash
   git checkout v1.0.0
   npm run build
   npm run deploy
   ```
```

---

### 📌 GIAI ĐOẠN 3: ADVANCED FEATURES & INTEGRATIONS (2-4 TUẦN)

**Mục tiêu:** Nâng cao tính năng và tích hợp với hệ thống hiện có

#### Task 3.1: Authentication & Authorization ⏱️ 2-3 ngày
**Priority: 🟡 MEDIUM**

**Recommended: Cloudflare Access (Simplest)**

```jsonc
// wrangler.jsonc
{
  "name": "boxme-forecast",
  "pages": {
    "access": {
      "enabled": true,
      "team_name": "boxme-fulfillment",
      "policies": [
        {
          "name": "Admin Access",
          "include": [
            {"email": {"email": "admin@boxme.asia"}}
          ]
        }
      ]
    }
  }
}
```

**Alternative: JWT-based Auth**

```typescript
// src/auth.ts
import { sign, verify } from 'hono/jwt';

export const authMiddleware = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    c.set('user', payload);
    return next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

// Login endpoint
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();
  
  // Verify credentials (hardcoded hoặc từ DB)
  if (username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
    const token = await sign({
      username,
      exp: Math.floor(Date.now() / 1000) + 3600 * 24 // 24 hours
    }, c.env.JWT_SECRET);
    
    return c.json({ token, user: { username } });
  }
  
  return c.json({ error: 'Invalid credentials' }, 401);
});

// Protected routes
app.use('/api/*', authMiddleware);
```

---

#### Task 3.2: WMS/OPS Integration ⏱️ 1 tuần
**Priority: 🟢 LOW (sau khi core features stable)**

**Integration Points:**

1. **WMS API - Real Orders Data**
```typescript
// src/integrations/wms.ts

async function syncOrdersFromWMS(db, date) {
  try {
    // Call WMS API
    const response = await fetch(`${WMS_API_URL}/orders?date=${date}`, {
      headers: {
        'Authorization': `Bearer ${WMS_API_TOKEN}`
      }
    });
    
    const orders = await response.json();
    
    // Insert vào orders_history
    for (const order of orders) {
      await db.prepare(`
        INSERT INTO orders_history 
        (id, order_date, customer_id, product_group, weight_kg, is_peak_day, ...)
        VALUES (?, ?, ?, ?, ?, ?, ...)
      `).bind(
        order.id,
        order.date,
        order.customer_id,
        order.product_group,
        order.weight,
        isPeakDay(order.date),
        // ...
      ).run();
    }
    
    console.log(`✅ Synced ${orders.length} orders from WMS for ${date}`);
  } catch (error) {
    console.error(`❌ Failed to sync orders from WMS:`, error);
  }
}

// Scheduled job (Cloudflare Cron Triggers)
export default {
  async scheduled(event, env, ctx) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    await syncOrdersFromWMS(env.DB, dateStr);
  }
};
```

2. **OPS API - Real Workforce Data**
```typescript
// src/integrations/ops.ts

async function syncStaffRosterFromOPS(db, date) {
  const response = await fetch(`${OPS_API_URL}/roster?date=${date}`, {
    headers: { 'Authorization': `Bearer ${OPS_API_TOKEN}` }
  });
  
  const roster = await response.json();
  
  // Update availability trong workforce calculation
  return {
    boxme: roster.boxme_count,
    seasonal: roster.seasonal_count,
    veteran: roster.veteran_count
  };
}
```

3. **Cron Schedule (wrangler.jsonc)**
```jsonc
{
  "triggers": {
    "crons": [
      "0 1 * * *"  // Daily at 1 AM
    ]
  }
}
```

---

#### Task 3.3: Lark Chat Integration ⏱️ 2-3 ngày
**Priority: 🟢 LOW**

**Features:**

1. **Alert Notifications**
```typescript
// src/integrations/lark.ts

async function sendLarkNotification(alert) {
  const webhook = LARK_WEBHOOK_URL;
  
  const message = {
    msg_type: "interactive",
    card: {
      header: {
        title: {
          tag: "plain_text",
          content: alert.level === 'critical' ? "🔴 CRITICAL ALERT" : "⚠️ WARNING"
        }
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `**Date:** ${alert.forecast_date}\n**Contractors Needed:** ${alert.contractors_needed}\n**Days Until Event:** ${alert.days_until_event}`
          }
        },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "View Details" },
              url: `${APP_URL}/workforce?date=${alert.forecast_date}`,
              type: "primary"
            }
          ]
        }
      ]
    }
  };
  
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
}
```

2. **Daily Summary Report**
```typescript
async function sendDailySummary(db) {
  const today = new Date().toISOString().split('T')[0];
  
  const forecast = await db.prepare(
    'SELECT * FROM daily_forecasts WHERE forecast_date = ?'
  ).bind(today).first();
  
  const workforce = await db.prepare(
    'SELECT * FROM workforce_recommendations WHERE forecast_date = ?'
  ).bind(today).first();
  
  const message = {
    msg_type: "interactive",
    card: {
      header: { title: { tag: "plain_text", content: "📊 Daily Forecast Summary" } },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `
**Date:** ${today}
**Forecasted Orders:** ${forecast.final_forecast}
**Staff Needed:** ${workforce.total_staff_needed}
**Estimated Cost:** ${workforce.total_cost.toLocaleString()} VND
**Status:** ${workforce.alert_level}
            `
          }
        }
      ]
    }
  };
  
  await fetch(LARK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
}
```

---

#### Task 3.4: Priority Queue System ⏱️ 3-4 ngày
**Priority: 🟢 LOW (future enhancement)**

**APIs:**
```typescript
// GET /api/queue/status - Real-time queue status
app.get('/api/queue/status', async (c) => {
  const { DB } = c.env;
  
  const buckets = await DB.prepare(`
    SELECT 
      pb.id,
      pb.bucket_name,
      pb.priority_score,
      COUNT(oqs.id) as orders_in_queue,
      SUM(CASE WHEN oqs.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
    FROM priority_buckets pb
    LEFT JOIN order_queue_state oqs ON oqs.priority_bucket_id = pb.id
    WHERE DATE(oqs.assigned_at) = DATE('now')
    GROUP BY pb.id
    ORDER BY pb.priority_score
  `).all();
  
  return c.json({ buckets: buckets.results || [] });
});

// POST /api/queue/assign - Assign order to bucket
app.post('/api/queue/assign', async (c) => {
  const { DB } = c.env;
  const { order_id, bucket_id } = await c.req.json();
  
  await DB.prepare(`
    INSERT INTO order_queue_state 
    (id, order_id, priority_bucket_id, status, assigned_at)
    VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `).bind(
    `queue-${Date.now()}`,
    order_id,
    bucket_id
  ).run();
  
  return c.json({ success: true });
});
```

---

## 📊 TIMELINE TỔNG HỢP

### Giai đoạn 1: Core Features (2 tuần)
- **Tuần 1:** Data generation + Workforce v2.0 API
- **Tuần 2:** Workforce UI + Testing

### Giai đoạn 2: Production (1 tuần)
- Setup production environment
- Monitoring & backup
- Initial deployment

### Giai đoạn 3: Advanced (2-4 tuần - optional)
- Authentication (2-3 ngày)
- WMS/OPS integration (1 tuần)
- Lark Chat integration (2-3 ngày)
- Priority Queue (3-4 ngày)

**Tổng thời gian:** 3-7 tuần (phụ thuộc scope Giai đoạn 3)

---

## 🎯 PRIORITIES & RECOMMENDATIONS

### ✅ MUST HAVE (Tuần 1-2)
1. ✅ Generate 24 months historical data
2. ✅ Implement Workforce Calculation v2.0 API
3. ✅ Build Workforce Planning Page
4. ✅ Testing & bug fixes
5. ✅ Production deployment

### 🟡 SHOULD HAVE (Tuần 3-4)
1. 🟡 Authentication system
2. 🟡 Monitoring & logging
3. 🟡 Mobile optimization improvements
4. 🟡 Export to CSV/Excel

### 🟢 NICE TO HAVE (Tuần 5-7)
1. 🟢 WMS/OPS API integration
2. 🟢 Lark Chat notifications
3. 🟢 Priority Queue management UI
4. 🟢 Advanced analytics dashboard

---

## 💡 BUSINESS IMPACT (Sau khi hoàn thành Giai đoạn 1-2)

### Efficiency Gains
- ⚡ **30% faster** processing với Field Table routing
- ⚡ **50% time saved** với Pre-pack planning
- ⚡ **<15% MAPE** forecast accuracy
- ⚡ **98% SLA compliance** với platform-specific handling
- ⚡ **<1 giờ planning time** (giảm từ 6h/tuần)

### Cost Savings
- 💰 **675 phút/ngày** tiết kiệm với Field Table (@ 4500 eligible orders)
- 💰 **1000 phút/ngày** tiết kiệm với Pre-pack planning
- 💰 **1.84M VND/ngày** potential savings với optimal routing
- 💰 **Giảm contractor needs** với better staff allocation

### Operational Improvements
- 📊 Customer-specific forecasting (8 customers)
- 📊 Platform SLA awareness (Shopee, Lazada, TikTok)
- 📊 Priority-based processing (6 levels)
- 📊 Data-driven recommendations
- 📊 Real-time workforce planning

---

## ✅ SUCCESS METRICS

| Metric | Hiện tại | Target | Timeline |
|--------|----------|--------|----------|
| **Forecast MAPE** | N/A (chưa có data) | <20% | Tuần 2 |
| **Peak Day MAPE** | N/A | <30% | Tuần 2 |
| **System Uptime** | 100% (local) | >99.5% | Tuần 3 |
| **API Response Time** | <100ms | <200ms | ✅ Done |
| **Core Pages** | 4/5 (80%) | 5/5 (100%) | Tuần 2 |
| **Core APIs** | 12/15 (80%) | 15/15 (100%) | Tuần 2 |
| **Planning Time** | 6h/week (manual) | <1h/week | Tuần 2 |
| **Cost Visibility** | 0% | 100% | Tuần 2 |

---

## 📞 HỖ TRỢ & TÀI LIỆU

### Documentation Hiện Có
- ✅ README.md - Project overview
- ✅ ROADMAP.md - Original roadmap
- ✅ NEXT_STEPS.md - Previous plan
- ✅ PHASE2_PROGRESS.md - Phase 2 progress
- ✅ ADVANCED_ROADMAP.md - Advanced features
- ✅ API_DOCS.md - API reference
- ✅ **KE_HOACH_PHAT_TRIEN.md** - This document (NEW)

### Resources
- 🔗 Cloudflare D1: https://developers.cloudflare.com/d1/
- 🔗 Hono Framework: https://hono.dev/
- 🔗 Chart.js: https://www.chartjs.org/
- 🔗 TailwindCSS: https://tailwindcss.com/

### Contact & Repository
- 📦 GitHub: https://github.com/lariamateo5036-del/Boxme-Forecast-MVP
- 🌐 Public Sandbox: https://3000-ibo0t9s4bx3n5pvcnnrnw-18e660f9.sandbox.novita.ai

---

## 🚀 IMMEDIATE ACTION ITEMS

### This Week (Tuần 1)
```bash
# Day 1: Generate data
cd /home/user/webapp/Boxme-Forecast-MVP
npx tsx scripts/generate-fake-data.ts
wrangler d1 execute boxme-forecast-production --local --file=./generated-orders.sql

# Day 2-4: Implement Workforce v2.0 API
# Create src/api/workforce-v2.ts
# Implement order routing, productivity calc, staff allocation
# Test với curl

# Day 5: Basic testing
npm run test
curl tests...
```

### Next Week (Tuần 2)
```bash
# Day 1-3: Build Workforce Planning UI
# Add route to src/index.tsx
# Implement UI components
# Integrate with API

# Day 4-5: Testing & bug fixes
# End-to-end testing
# Mobile testing
# Performance testing
```

---

**Last Updated:** 2025-12-11  
**Version:** 1.0  
**Status:** 🟢 Ready for Implementation  
**Next Review:** After completing Week 1 tasks
