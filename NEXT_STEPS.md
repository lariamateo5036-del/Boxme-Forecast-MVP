# 🚀 HƯỚNG DẪN TRIỂN KHAI TIẾP THEO

## 📋 Tóm Tắt Tình Trạng Hiện Tại

### ✅ ĐÃ HOÀN THÀNH (Phase 1 - MVP Core)
1. **Database Layer** ✅
   - D1 database với 10 tables
   - Migration scripts
   - Seed data (calendar events, productivity standards)
   - Schema đầy đủ theo spec

2. **Backend APIs** ✅
   - `GET /api/dashboard/kpis` - Dashboard metrics
   - `GET /api/forecast/chart` - Chart data
   - `POST /api/forecast/generate` - Forecast generation
   - `GET /api/alerts` - Hiring alerts
   - `GET /api/calendar` - Calendar data

3. **Frontend Pages** ✅
   - Dashboard với KPI cards + Chart
   - Calendar view (30 days grid)
   - Alerts page
   - Responsive navigation

4. **Forecasting Models** ✅
   - Baseline model (rule-based)
   - ML model (moving average + exponential smoothing)
   - Peak day detection
   - Weekend adjustments

### ❌ CÒN THIẾU (So với spec gốc)
1. **Data**: Chưa có full 24 months historical data
2. **API**: Workforce calculation chưa implement
3. **Page**: Workforce Planning page chưa có
4. **Auth**: Chưa có authentication
5. **Integration**: Chưa có WMS/OPS/Lark integration
6. **Deployment**: Chưa deploy production

---

## 🎯 3 BƯỚC QUAN TRỌNG TIẾP THEO

### BƯỚC 1: Generate Historical Data (1 ngày)
**Tại sao quan trọng:** Không có data lịch sử → không test được accuracy

**Cách thực hiện:**
```bash
cd /home/user/webapp

# 1. Generate 24 months data (takes ~5 minutes)
npx tsx scripts/generate-fake-data.ts
# Output: generated-orders.sql (~50MB)

# 2. Load into database
wrangler d1 execute boxme-forecast-production --local --file=./generated-orders.sql
# This takes ~10-15 minutes for ~10-15 million orders

# 3. Verify
wrangler d1 execute boxme-forecast-production --local --command="SELECT COUNT(*) FROM orders_history"
# Should return: ~10,000,000 - 15,000,000 orders

# 4. Test forecast with real data
curl -X POST http://localhost:3000/api/forecast/generate -d '{"horizon":30}'
```

**Kết quả:**
- ✅ 730 days of orders (2 years)
- ✅ 10,000-40,000 orders/day
- ✅ Peak days có realistic spikes
- ✅ Dashboard KPIs sẽ có data thật

---

### BƯỚC 2: Implement Workforce Calculation API (3 ngày)

**File cần tạo:** `src/api/workforce.ts` hoặc thêm vào `src/index.tsx`

**Code template:**

```typescript
// POST /api/workforce/calculate
app.post('/api/workforce/calculate', async (c) => {
  const { DB } = c.env;
  const { forecast_id, forecast_date } = await c.req.json();

  try {
    // 1. Get forecast
    const forecast = await DB.prepare(
      'SELECT * FROM daily_forecasts WHERE id = ? OR forecast_date = ?'
    ).bind(forecast_id || '', forecast_date).first();

    if (!forecast) {
      return c.json({ error: 'Forecast not found' }, 404);
    }

    const totalOrders = forecast.final_forecast;

    // 2. Get product group distribution (from last 30 days)
    const distribution = await DB.prepare(`
      SELECT product_group, COUNT(*) * 1.0 / SUM(COUNT(*)) OVER() as ratio
      FROM orders_history
      WHERE order_date >= date('now', '-30 days')
      GROUP BY product_group
    `).all();

    // 3. Calculate work hours by type
    const workTypeRatios = {
      pick: 0.70,
      pack: 0.20,
      moving: 0.05,
      return: 0.05
    };

    // Get average productivity
    const avgProductivity = await DB.prepare(
      'SELECT AVG(orders_per_hour) as avg FROM productivity_standards'
    ).first();

    const totalHours = (totalOrders / avgProductivity.avg) * 1.15; // 15% buffer

    const workHours = {
      pick: totalHours * workTypeRatios.pick,
      pack: totalHours * workTypeRatios.pack,
      moving: totalHours * workTypeRatios.moving,
      return: totalHours * workTypeRatios.return,
      total: totalHours
    };

    // 4. Calculate staff needed
    const hoursPerShift = 8;
    const totalStaff = Math.ceil(totalHours / hoursPerShift);

    const staffNeeded = {
      boxme: Math.ceil(totalStaff * 0.70),
      veteran: Math.ceil(totalStaff * 0.20),
      seasonal: Math.ceil(totalStaff * 0.10),
      total: totalStaff
    };

    // 5. Get availability (hardcoded for MVP, should come from roster)
    const availability = {
      boxme: 80,
      seasonal: 20,
      veteran: 30
    };

    // 6. Calculate gap
    const gap = {
      boxme: Math.max(0, staffNeeded.boxme - availability.boxme),
      seasonal: Math.max(0, staffNeeded.seasonal - availability.seasonal),
      veteran: Math.max(0, staffNeeded.veteran - availability.veteran),
      total: Math.max(0, staffNeeded.total - (availability.boxme + availability.seasonal + availability.veteran))
    };

    const contractorNeeded = Math.ceil(gap.total * 1.2); // 20% buffer for no-shows

    // 7. Calculate costs
    const avgCostPerHour = 22000; // VND
    const contractorBonusPerPerson = 50000;
    const mealCostPerPerson = 30000;

    const costs = {
      regular: totalStaff * 8 * avgCostPerHour,
      contractorBonus: contractorNeeded * contractorBonusPerPerson,
      meals: contractorNeeded * mealCostPerPerson,
      total: 0
    };
    costs.total = costs.regular + costs.contractorBonus + costs.meals;

    // 8. Determine alert level
    const alertLevel = contractorNeeded > 100 ? 'critical' :
                       contractorNeeded > 50 ? 'warning' : 'ok';

    // 9. Save recommendation
    const recommendation = {
      id: `wr-${forecast_date}-${Date.now()}`,
      forecast_id: forecast.id,
      forecast_date,
      ...workHours,
      ...Object.fromEntries(
        Object.entries(staffNeeded).map(([k, v]) => [`${k}_staff_needed`, v])
      ),
      ...Object.fromEntries(
        Object.entries(availability).map(([k, v]) => [`available_${k}`, v])
      ),
      gap_total: gap.total,
      contractor_recruitment_needed: contractorNeeded,
      ...Object.fromEntries(
        Object.entries(costs).map(([k, v]) => [k === 'total' ? 'total_cost' : `${k}_cost`, v])
      ),
      alert_level: alertLevel
    };

    // Insert into DB
    await DB.prepare(`
      INSERT INTO workforce_recommendations 
      (id, forecast_id, forecast_date, pick_hours, pack_hours, moving_hours, return_hours, total_hours,
       boxme_staff_needed, seasonal_staff_needed, veteran_staff_needed, total_staff_needed,
       available_boxme, available_seasonal, available_veteran, gap_total, contractor_recruitment_needed,
       estimated_cost, contractor_bonus_cost, meal_cost, total_cost, alert_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      recommendation.id,
      recommendation.forecast_id,
      recommendation.forecast_date,
      recommendation.pick,
      recommendation.pack,
      recommendation.moving,
      recommendation.return,
      recommendation.total,
      recommendation.boxme_staff_needed,
      recommendation.seasonal_staff_needed,
      recommendation.veteran_staff_needed,
      recommendation.total_staff_needed,
      recommendation.available_boxme,
      recommendation.available_seasonal,
      recommendation.available_veteran,
      recommendation.gap_total,
      recommendation.contractor_recruitment_needed,
      recommendation.regular_cost,
      recommendation.contractorBonus_cost,
      recommendation.meals_cost,
      recommendation.total_cost,
      recommendation.alert_level
    ).run();

    // 10. Create hiring alert if needed
    if (alertLevel !== 'ok') {
      const today = new Date();
      const eventDate = new Date(forecast_date);
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

      if (daysUntil > 0 && daysUntil <= 14) {
        await DB.prepare(`
          INSERT INTO hiring_alerts 
          (id, forecast_date, alert_date, days_until_event, contractors_needed, alert_level, status)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `).bind(
          `alert-${forecast_date}-${Date.now()}`,
          forecast_date,
          today.toISOString().split('T')[0],
          daysUntil,
          contractorNeeded,
          alertLevel
        ).run();
      }
    }

    return c.json({
      success: true,
      recommendation
    });

  } catch (error) {
    console.error('Error calculating workforce:', error);
    return c.json({ error: 'Failed to calculate workforce' }, 500);
  }
});
```

**Testing:**
```bash
# Generate forecast first
curl -X POST http://localhost:3000/api/forecast/generate -d '{"horizon":30}'

# Then calculate workforce
curl -X POST http://localhost:3000/api/workforce/calculate \
  -H "Content-Type: application/json" \
  -d '{"forecast_date":"2025-12-15"}'
```

---

### BƯỚC 3: Build Workforce Planning Page (2 ngày)

**File:** Thêm route mới vào `src/index.tsx`

**HTML Template (simplified):**

```typescript
app.get('/workforce', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Workforce Planning - Boxme Forecast MVP</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation (copy from dashboard) -->
        
        <div class="max-w-7xl mx-auto px-4 py-8">
            <h1 class="text-3xl font-bold mb-6">
                <i class="fas fa-users mr-3"></i>
                Workforce Planning
            </h1>

            <!-- Date Selector -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <div class="flex gap-4 items-center">
                    <input type="date" id="plan-date" class="border rounded px-4 py-2" />
                    <button onclick="loadWorkforce()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        <i class="fas fa-calculator mr-2"></i>Calculate
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm mb-2">Total Orders</div>
                    <div class="text-3xl font-bold text-blue-600" id="total-orders">-</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm mb-2">Staff Needed</div>
                    <div class="text-3xl font-bold text-green-600" id="staff-needed">-</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm mb-2">Workforce Gap</div>
                    <div class="text-3xl font-bold text-orange-600" id="workforce-gap">-</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm mb-2">Total Cost</div>
                    <div class="text-3xl font-bold text-purple-600" id="total-cost">-</div>
                </div>
            </div>

            <!-- Breakdown Table -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h2 class="text-xl font-bold mb-4">Staff Breakdown</h2>
                <div id="breakdown-table" class="overflow-x-auto">
                    <table class="min-w-full">
                        <thead>
                            <tr class="border-b">
                                <th class="text-left py-2">Staff Type</th>
                                <th class="text-right py-2">Needed</th>
                                <th class="text-right py-2">Available</th>
                                <th class="text-right py-2">Gap</th>
                            </tr>
                        </thead>
                        <tbody id="breakdown-body">
                            <tr><td colspan="4" class="text-center py-4 text-gray-500">Select a date and calculate</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Chart -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-bold mb-4">Staff Mix</h2>
                <div style="height: 300px;">
                    <canvas id="staffMixChart"></canvas>
                </div>
            </div>
        </div>

        <script>
            let staffChart = null;

            async function loadWorkforce() {
                const date = document.getElementById('plan-date').value;
                if (!date) {
                    alert('Please select a date');
                    return;
                }

                try {
                    // Calculate workforce
                    const res = await axios.post('/api/workforce/calculate', {
                        forecast_date: date
                    });

                    const data = res.data.recommendation;

                    // Update summary cards
                    // (similar to dashboard loadKPIs)

                    // Update breakdown table
                    // (similar to alerts loadAlerts)

                    // Update chart
                    // (use Chart.js donut chart)

                } catch (error) {
                    console.error('Error:', error);
                    alert('Error calculating workforce');
                }
            }

            // Set default date to tomorrow
            document.getElementById('plan-date').valueAsDate = new Date(Date.now() + 86400000);
        </script>
    </body>
    </html>
  `);
});
```

---

## 📅 TIMELINE ĐỀ XUẤT

### Tuần 1 (Hiện tại → 7 ngày)
- ✅ **Ngày 1**: Generate 24 months data
- ✅ **Ngày 2-4**: Implement workforce calculation API
- ✅ **Ngày 5-7**: Build workforce planning page

### Tuần 2 (8-14 ngày)
- 🔄 **Ngày 8-9**: Testing với real data
- 🔄 **Ngày 10-11**: Bug fixes & refinements
- 🔄 **Ngày 12-14**: Mobile optimization

### Tuần 3 (15-21 ngày)
- 🔄 **Ngày 15-16**: Production deployment prep
- 🔄 **Ngày 17-18**: Deploy to Cloudflare Pages
- 🔄 **Ngày 19-21**: Monitoring & documentation

---

## 🚀 PRODUCTION DEPLOYMENT (Khi sẵn sàng)

### Checklist trước khi deploy:

**1. Database:**
```bash
# Create production D1
wrangler d1 create boxme-forecast-production

# Update wrangler.jsonc with database_id

# Run migrations
npm run db:migrate:prod

# Load seed data
wrangler d1 execute boxme-forecast-production --file=./seed.sql
```

**2. Build & Test:**
```bash
npm run build
npm run preview
# Test all pages manually
```

**3. Deploy:**
```bash
npm run deploy
# Or: wrangler pages deploy dist --project-name boxme-forecast
```

**4. Verify:**
- Check all pages load
- Test all APIs
- Verify database queries work
- Test forecast generation
- Test workforce calculation

**5. Monitor:**
- Check Cloudflare Analytics
- Monitor error rates
- Check response times

---

## 📞 CẦN HỖ TRỢ?

### Documentation
- 📖 **README.md** - Project overview & setup
- 📖 **ROADMAP.md** - Detailed phase planning
- 📖 **API_DOCS.md** - API reference
- 📖 **NEXT_STEPS.md** - This file

### Resources
- 🔗 Cloudflare D1: https://developers.cloudflare.com/d1/
- 🔗 Hono Framework: https://hono.dev/
- 🔗 Chart.js: https://www.chartjs.org/

### Contact
- GitHub: (your repo)
- Public Demo: https://3000-ibo0t9s4bx3n5pvcnnrnw-18e660f9.sandbox.novita.ai

---

**Chúc mừng! Bạn đã có một MVP forecast system hoạt động tốt!** 🎉

**Next:** Thực hiện 3 bước trên để complete core features.

---

**Last Updated:** 2025-12-11
