# Boxme Forecast MVP - Kế Hoạch Triển Khai Tiếp Theo

## 📊 Tình Trạng Hiện Tại (Đã Hoàn Thành)

### ✅ Phase 1: MVP Core (COMPLETED)
- ✅ Database schema với D1 (10 tables)
- ✅ Calendar events (48 double days 2024-2025)
- ✅ Productivity standards (36 configurations)
- ✅ Forecast generation API (baseline + ML)
- ✅ Dashboard với KPI cards + chart
- ✅ Calendar view (30 days)
- ✅ Alerts page
- ✅ Local development environment

### ⚠️ Còn Thiếu So Với Spec Gốc
- ❌ Full 24 months historical data (chỉ có seed script)
- ❌ Workforce calculation API (chưa implement)
- ❌ Workforce Planning page (chưa có)
- ❌ Authentication & authorization
- ❌ WMS/OPS API integration
- ❌ Lark Chat notifications
- ❌ Production deployment
- ❌ Monitoring & logging

---

## 🎯 PHASE 2: Complete Core Features (2-3 Weeks)

### Week 1: Historical Data & Workforce API

#### Task 2.1: Generate Full 24 Months Data ⏱️ 1 day
**Priority: HIGH** - Cần có data để test forecast accuracy

```bash
# Steps:
1. Run data generator script
   npx tsx scripts/generate-fake-data.ts
   
2. Load into D1 database
   wrangler d1 execute boxme-forecast-production --local --file=./generated-orders.sql
   
3. Verify data
   - Check order counts per day
   - Verify peak day multipliers
   - Confirm product group distribution
```

**Acceptance Criteria:**
- ✅ 730 days of orders (24 months)
- ✅ 10,000-40,000 orders/day range
- ✅ Peak days có correct multipliers
- ✅ 4 product groups distributed properly

#### Task 2.2: Implement Workforce Calculation API ⏱️ 3 days
**Priority: HIGH** - Core business logic

**API Endpoint:** `POST /api/workforce/calculate`

**Input:**
```json
{
  "forecast_id": "fc-2025-12-15-xxx",
  "forecast_date": "2025-12-15"
}
```

**Output:**
```json
{
  "success": true,
  "recommendation": {
    "forecast_date": "2025-12-15",
    "total_orders": 15000,
    "work_hours": {
      "pick": 350,
      "pack": 100,
      "moving": 25,
      "return": 25,
      "total": 500
    },
    "staff_needed": {
      "boxme": 44,
      "seasonal": 6,
      "veteran": 12,
      "total": 62
    },
    "availability": {
      "boxme": 80,
      "seasonal": 20,
      "veteran": 30
    },
    "gap": {
      "total": -68,
      "contractor_needed": 0
    },
    "costs": {
      "regular": 11000000,
      "contractor_bonus": 0,
      "meals": 0,
      "total": 11000000
    },
    "alert_level": "ok"
  }
}
```

**Implementation Steps:**
1. Get forecast từ daily_forecasts
2. Get product group distribution từ orders_history
3. Calculate work hours by type (pick 70%, pack 20%, moving 5%, return 5%)
4. Get productivity standards từ DB
5. Calculate staff needed by type/level
6. Get current availability (hardcoded hoặc từ roster table)
7. Calculate gap và contractor needs
8. Calculate costs
9. Determine alert level (ok/warning/critical)
10. Save to workforce_recommendations table
11. Create hiring_alerts if needed

**Acceptance Criteria:**
- ✅ Correct calculation theo spec
- ✅ Creates hiring alerts for gaps > 50
- ✅ Saves to workforce_recommendations table
- ✅ Returns proper error messages

#### Task 2.3: Create Hiring Alerts Auto-generation ⏱️ 1 day
**Priority: MEDIUM**

**Trigger:** After workforce calculation
**Logic:**
- If gap > 50 contractors → alert_level = "warning"
- If gap > 100 contractors → alert_level = "critical"
- If days_until_event < 7 → escalate alert_level

**Implementation:**
```typescript
async function createHiringAlert(db, forecast_date, contractor_needed, alert_level) {
  const today = new Date();
  const event = new Date(forecast_date);
  const days_until = Math.ceil((event - today) / (1000 * 60 * 60 * 24));
  
  if (days_until > 0 && days_until <= 14) {
    await db.prepare(`
      INSERT INTO hiring_alerts 
      (id, forecast_date, alert_date, days_until_event, contractors_needed, alert_level, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      generateUUID(),
      forecast_date,
      today.toISOString().split('T')[0],
      days_until,
      contractor_needed,
      alert_level
    ).run();
  }
}
```

### Week 2: Workforce Planning Page

#### Task 2.4: Build Workforce Planning Page ⏱️ 4 days
**Priority: HIGH**

**URL:** `/workforce` hoặc `/planning`

**Features:**
1. **Date Selector**
   - Single date picker
   - Quick buttons: Tomorrow, Next Week, Next Peak Day

2. **Forecast Summary Card**
   - Forecasted orders (large number)
   - vs yesterday / vs last week
   - Peak day indicator
   - Confidence score

3. **Workforce Breakdown Table**
   ```
   | Shift     | Work Type | Staff Type | Needed | Available | Gap | Action |
   |-----------|-----------|------------|--------|-----------|-----|--------|
   | Morning   | Pick      | Boxme      | 15     | 20        | -5  | ✓      |
   | Morning   | Pick      | Seasonal   | 5      | 3         | +2  | ⚠️     |
   | ...       | ...       | ...        | ...    | ...       | ... | ...    |
   | **Total** |           |            | **62** | **130**   | **-68** |   |
   ```

4. **Staff Mix Chart** (Donut chart)
   - Boxme (blue)
   - Seasonal (yellow)
   - Veteran (green)
   - Contractor needed (red)

5. **Cost Breakdown Card**
   - Regular wages
   - Contractor bonuses
   - Meal costs
   - Total (highlighted)

6. **Action Buttons**
   - Calculate Workforce (triggers API)
   - Export to CSV
   - Refresh

**Implementation:**
```html
<div class="workforce-planning">
  <div class="date-selector">
    <input type="date" id="plan-date" />
    <button onclick="selectTomorrow()">Tomorrow</button>
    <button onclick="selectNextWeek()">Next Week</button>
    <button onclick="selectNextPeak()">Next Peak Day</button>
  </div>

  <div class="forecast-summary">
    <!-- KPI cards -->
  </div>

  <div class="breakdown-table">
    <!-- Workforce table -->
  </div>

  <div class="charts-costs">
    <div class="donut-chart">
      <canvas id="staffMixChart"></canvas>
    </div>
    <div class="cost-breakdown">
      <!-- Cost cards -->
    </div>
  </div>

  <div class="actions">
    <button onclick="calculateWorkforce()">Calculate Workforce</button>
    <button onclick="exportToCSV()">Export to CSV</button>
  </div>
</div>
```

**Acceptance Criteria:**
- ✅ Date selection works
- ✅ Loads forecast for selected date
- ✅ Calls workforce calculation API
- ✅ Displays breakdown table
- ✅ Shows donut chart
- ✅ Shows cost breakdown
- ✅ Export to CSV works

### Week 3: Testing & Polish

#### Task 2.5: Accuracy Tracking System ⏱️ 2 days
**Priority: MEDIUM**

**Feature:** Update actual orders và calculate MAPE

**Implementation:**
1. Daily cron job to update actual_orders
```typescript
// Update actual orders for yesterday
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const dateStr = yesterday.toISOString().split('T')[0];

const actualCount = await db.prepare(
  'SELECT COUNT(*) as count FROM orders_history WHERE order_date = ?'
).bind(dateStr).first();

const mape = Math.abs((forecast - actual) / actual) * 100;

await db.prepare(`
  UPDATE daily_forecasts 
  SET actual_orders = ?, mape = ? 
  WHERE forecast_date = ?
`).bind(actualCount.count, mape, dateStr).run();
```

2. Dashboard KPI updates automatically

**Acceptance Criteria:**
- ✅ Actual orders updated daily
- ✅ MAPE calculated correctly
- ✅ Dashboard shows real accuracy %

#### Task 2.6: Mobile Responsive Improvements ⏱️ 2 days
**Priority: MEDIUM**

**Focus Areas:**
1. Dashboard - stack KPI cards on mobile
2. Calendar - switch to list view on mobile
3. Workforce table - horizontal scroll
4. Charts - reduce height on mobile

**Breakpoints:**
```css
/* Mobile: < 640px */
/* Tablet: 640px - 1024px */
/* Desktop: > 1024px */
```

#### Task 2.7: Error Handling & Loading States ⏱️ 1 day
**Priority: MEDIUM**

**Add to all pages:**
- Loading spinners
- Error messages
- Retry buttons
- Empty states
- Network error handling

---

## 🚀 PHASE 3: Production Ready (2 Weeks)

### Week 4: Authentication & Security

#### Task 3.1: Simple Authentication ⏱️ 2 days
**Options:**

**Option A: Cloudflare Access (Recommended)**
```jsonc
// wrangler.jsonc
{
  "pages": {
    "access": {
      "enabled": true,
      "team_name": "boxme-fulfillment"
    }
  }
}
```

**Option B: Basic Auth with Environment Variables**
```typescript
app.use('/*', async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Basic ')) {
    return c.text('Unauthorized', 401, {
      'WWW-Authenticate': 'Basic realm="Boxme Forecast"'
    });
  }
  
  const credentials = atob(auth.slice(6)).split(':');
  const [username, password] = credentials;
  
  if (username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
    return next();
  }
  
  return c.text('Unauthorized', 401);
});
```

**Option C: JWT Tokens**
```typescript
import { sign, verify } from 'hono/jwt';

app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();
  
  if (username === 'admin' && password === 'secret') {
    const token = await sign({ username, exp: Math.floor(Date.now() / 1000) + 3600 }, c.env.JWT_SECRET);
    return c.json({ token });
  }
  
  return c.json({ error: 'Invalid credentials' }, 401);
});

app.use('/api/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.text('Unauthorized', 401);
  
  try {
    await verify(token, c.env.JWT_SECRET);
    return next();
  } catch {
    return c.text('Unauthorized', 401);
  }
});
```

**Recommended:** Option A (Cloudflare Access) - simplest, no code changes

#### Task 3.2: Environment Variables & Secrets ⏱️ 1 day

**Local (.dev.vars):**
```env
ADMIN_USER=admin
ADMIN_PASS=your-secure-password
JWT_SECRET=your-jwt-secret-key
```

**Production (Cloudflare):**
```bash
wrangler pages secret put ADMIN_USER
wrangler pages secret put ADMIN_PASS
wrangler pages secret put JWT_SECRET
```

### Week 5: Deployment & Monitoring

#### Task 3.3: Production Deployment ⏱️ 2 days

**Steps:**

1. **Create Production D1 Database**
```bash
wrangler d1 create boxme-forecast-production
# Copy database_id from output
```

2. **Update wrangler.jsonc**
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "boxme-forecast-production",
      "database_id": "your-actual-database-id-here"
    }
  ]
}
```

3. **Run Production Migrations**
```bash
npm run db:migrate:prod
```

4. **Seed Production Data**
```bash
wrangler d1 execute boxme-forecast-production --file=./seed.sql
# Optional: Load 24 months data (large file)
```

5. **Deploy to Cloudflare Pages**
```bash
npm run deploy
```

6. **Configure Custom Domain (Optional)**
```bash
wrangler pages domain add forecast.boxme.asia --project-name boxme-forecast
```

#### Task 3.4: Monitoring Setup ⏱️ 1 day

**Option A: Cloudflare Analytics (Built-in)**
- Already available in Cloudflare Dashboard
- Page views, requests, errors
- No setup required

**Option B: Simple Logging**
```typescript
// Add to all API routes
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} - ${c.res.status} - ${duration}ms`);
});
```

**Option C: Error Tracking**
```typescript
app.onError((err, c) => {
  console.error('Error:', err);
  // Optional: Send to external service (Sentry, etc.)
  return c.json({ error: 'Internal Server Error' }, 500);
});
```

#### Task 3.5: Backup & Recovery Plan ⏱️ 1 day

**Database Backup:**
```bash
# Automated daily backup script
#!/bin/bash
DATE=$(date +%Y-%m-%d)
wrangler d1 export boxme-forecast-production > backups/backup-$DATE.sql
```

**Git Repository:**
- Ensure all code is committed
- Push to GitHub (private repo)
- Tag releases: `git tag v1.0.0`

**Documentation:**
- Update README.md
- Deployment guide
- Troubleshooting guide

---

## 📈 PHASE 4: Advanced Features (Future)

### Phase 4.1: Real Integrations (1 Month)
1. **WMS API Integration**
   - Real-time order data sync
   - Hourly/daily batch jobs
   
2. **OPS API Integration**
   - Real workforce data
   - Attendance tracking
   
3. **Lark Chat Integration**
   - Webhook notifications
   - Alert forwarding
   - Daily reports

### Phase 4.2: Advanced Analytics (1 Month)
1. **Forecast Accuracy Dashboard**
   - MAPE trends over time
   - Peak day vs normal day accuracy
   - Model performance comparison
   
2. **Cost Analytics**
   - Cost trends
   - Overtime analysis
   - Budget vs actual
   
3. **Staff Performance**
   - Productivity by staff type
   - Efficiency trends

### Phase 4.3: ML Model Improvements (2 Months)
1. **Prophet Model**
   - Better seasonality handling
   - Holiday effects
   
2. **LSTM Model**
   - Deep learning for complex patterns
   - Multi-variate forecasting
   
3. **Ensemble Learning**
   - Combine multiple models
   - Adaptive weighting

---

## ✅ Success Metrics (Target trong 3 tháng)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Forecast MAPE** | N/A (chưa có data) | <20% | 🔄 |
| **Peak Day MAPE** | N/A | <30% | 🔄 |
| **System Uptime** | 100% (local) | >99.5% | ✅ |
| **API Response Time** | <100ms | <200ms | ✅ |
| **Pages Completed** | 3/5 | 5/5 | 🔄 |
| **Core APIs** | 3/5 | 5/5 | 🔄 |

---

## 🎯 IMMEDIATE NEXT STEPS (This Week)

### Priority 1: Complete Core Features
1. ✅ Generate 24 months data (1 day)
2. ✅ Implement workforce calculation API (3 days)
3. ✅ Build workforce planning page (2 days)

### Priority 2: Testing
1. ✅ Test with real data
2. ✅ Fix any bugs
3. ✅ Mobile testing

### Priority 3: Deployment
1. ✅ Deploy to production
2. ✅ Setup monitoring
3. ✅ Create backup plan

---

## 📞 Hỗ Trợ & Tài Liệu

**Current Documentation:**
- ✅ README.md (completed)
- ⏳ ROADMAP.md (this file)
- ⏳ API_DOCS.md (needed)
- ⏳ DEPLOYMENT.md (needed)

**Resources:**
- Cloudflare D1 Docs: https://developers.cloudflare.com/d1/
- Hono Framework: https://hono.dev/
- Chart.js: https://www.chartjs.org/

---

**Last Updated:** 2025-12-11  
**Next Review:** After completing Phase 2
