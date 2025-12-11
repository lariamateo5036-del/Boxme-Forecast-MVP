# Boxme Forecast MVP - API Documentation

## Base URL
- **Local Development**: `http://localhost:3000`
- **Production**: `https://your-project.pages.dev`
- **Sandbox**: `https://3000-ibo0t9s4bx3n5pvcnnrnw-18e660f9.sandbox.novita.ai`

---

## 📊 Dashboard APIs

### GET /api/dashboard/kpis
Get current KPI metrics for dashboard

**Response:**
```json
{
  "todayForecast": 15000,
  "nextPeakDay": {
    "date": "2025-12-12",
    "name": "12/12 Year-End Sale",
    "daysUntil": 1,
    "forecast": 58500
  },
  "workforceGap": 0,
  "forecastAccuracy": 85.0
}
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

---

## 📈 Forecast APIs

### GET /api/forecast/chart
Get historical and forecast data for chart visualization

**Query Parameters:**
- `days` (optional): Number of days to include (default: 7, max: 30)

**Example:**
```
GET /api/forecast/chart?days=14
```

**Response:**
```json
{
  "data": [
    {
      "date": "2025-12-10",
      "actual": 14523,
      "isPeak": false
    },
    {
      "date": "2025-12-11",
      "actual": 15234,
      "isPeak": false
    },
    {
      "date": "2025-12-12",
      "forecast": 58500,
      "lowerBound": 49725,
      "upperBound": 70200,
      "isPeak": true,
      "peakLabel": "12/12 Year-End Sale"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

---

### POST /api/forecast/generate
Generate forecasts for next N days

**Request Body:**
```json
{
  "horizon": 30
}
```

**Parameters:**
- `horizon`: Number of days to forecast (default: 30, max: 90)

**Response:**
```json
{
  "success": true,
  "forecasts_generated": 30,
  "message": "Generated 30 forecasts"
}
```

**Algorithm:**
1. Get average orders from last 30 days
2. Check for peak events in calendar
3. Apply multipliers:
   - Peak days: 1.5x - 4.2x (based on event)
   - Weekends: 1.3x
   - Normal days: 1.0x
4. Add randomness: ±10%
5. Calculate confidence intervals: ±15%

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid parameters
- `500 Internal Server Error` - Database error

---

## 👥 Workforce APIs

### POST /api/workforce/calculate
Calculate workforce requirements for a specific date

**Status:** ⚠️ NOT YET IMPLEMENTED

**Request Body:**
```json
{
  "forecast_id": "fc-2025-12-15-xxx",
  "forecast_date": "2025-12-15"
}
```

**Response:**
```json
{
  "success": true,
  "recommendation": {
    "forecast_date": "2025-12-15",
    "total_orders": 15000,
    "work_hours": {
      "pick": 350.5,
      "pack": 100.0,
      "moving": 25.0,
      "return": 25.0,
      "total": 500.5
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

**Calculation Logic:**
1. Get forecast from `daily_forecasts` table
2. Estimate product group distribution (from last 30 days)
3. Calculate work hours by type:
   - Pick: 70% of total
   - Pack: 20%
   - Moving: 5%
   - Return: 5%
4. Get productivity standards from DB
5. Calculate staff needed: `hours / (staff_productivity * 8 hours/shift)`
6. Distribute by staff type: Boxme 70%, Veteran 20%, Seasonal 10%
7. Check availability (currently hardcoded)
8. Calculate gap: `needed - available`
9. Calculate costs: `hours * cost_per_hour`
10. Determine alert level:
    - `ok`: gap <= 0
    - `warning`: 0 < gap <= 50
    - `critical`: gap > 50

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid forecast_id or date
- `404 Not Found` - Forecast not found
- `500 Internal Server Error` - Database error

---

## 🚨 Alerts APIs

### GET /api/alerts
Get all pending hiring alerts

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-xxx",
      "forecast_date": "2025-12-12",
      "alert_date": "2025-12-05",
      "days_until_event": 7,
      "contractors_needed": 120,
      "alert_level": "critical",
      "status": "pending",
      "acknowledged_by": null,
      "acknowledged_at": null,
      "notes": null,
      "created_at": "2025-12-05T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

---

## 📅 Calendar APIs

### GET /api/calendar
Get forecast data for a specific month

**Query Parameters:**
- `month` (optional): Month in YYYY-MM format (default: current month)

**Example:**
```
GET /api/calendar?month=2025-12
```

**Response:**
```json
{
  "calendar": [
    {
      "id": "fc-2025-12-01-xxx",
      "forecast_date": "2025-12-01",
      "final_forecast": 14500,
      "lower_bound": 12325,
      "upper_bound": 17400,
      "is_peak_day": 0,
      "peak_multiplier": 1.0,
      "notes": null,
      "ml_confidence": 0.75,
      "created_at": "2025-11-30T10:00:00Z"
    },
    {
      "id": "fc-2025-12-12-xxx",
      "forecast_date": "2025-12-12",
      "final_forecast": 58500,
      "lower_bound": 49725,
      "upper_bound": 70200,
      "is_peak_day": 1,
      "peak_multiplier": 3.9,
      "notes": "12/12 Year-End Sale",
      "ml_confidence": 0.75,
      "created_at": "2025-11-30T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

---

## 🗄️ Database Schema

### Key Tables

#### daily_forecasts
```sql
CREATE TABLE daily_forecasts (
    id TEXT PRIMARY KEY,
    forecast_date TEXT NOT NULL UNIQUE,
    generated_at TEXT DEFAULT (datetime('now')),
    model_version TEXT,
    baseline_forecast INTEGER,
    ml_forecast INTEGER,
    ml_confidence REAL,
    customer_forecast INTEGER,
    customer_weight REAL,
    final_forecast INTEGER,
    lower_bound INTEGER,
    upper_bound INTEGER,
    actual_orders INTEGER,
    mape REAL,
    is_peak_day INTEGER DEFAULT 0,
    peak_multiplier REAL,
    notes TEXT
);
```

#### workforce_recommendations
```sql
CREATE TABLE workforce_recommendations (
    id TEXT PRIMARY KEY,
    forecast_id TEXT,
    forecast_date TEXT NOT NULL,
    pick_hours REAL,
    pack_hours REAL,
    moving_hours REAL,
    return_hours REAL,
    total_hours REAL,
    boxme_staff_needed INTEGER,
    seasonal_staff_needed INTEGER,
    veteran_staff_needed INTEGER,
    total_staff_needed INTEGER,
    available_boxme INTEGER,
    available_seasonal INTEGER,
    available_veteran INTEGER,
    gap_total INTEGER,
    contractor_recruitment_needed INTEGER,
    estimated_cost REAL,
    contractor_bonus_cost REAL,
    meal_cost REAL,
    total_cost REAL,
    alert_level TEXT
);
```

#### hiring_alerts
```sql
CREATE TABLE hiring_alerts (
    id TEXT PRIMARY KEY,
    forecast_date TEXT NOT NULL,
    alert_date TEXT NOT NULL,
    days_until_event INTEGER,
    contractors_needed INTEGER,
    alert_level TEXT,
    status TEXT DEFAULT 'pending',
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    notes TEXT
);
```

---

## 🔐 Authentication (Future)

Currently no authentication. Planned options:

### Option A: Cloudflare Access
```bash
# Enable Cloudflare Access in dashboard
# No code changes needed
```

### Option B: Basic Auth
```bash
# Set environment variables
ADMIN_USER=admin
ADMIN_PASS=your-secure-password

# All requests require Basic Auth header
Authorization: Basic base64(username:password)
```

### Option C: JWT Tokens
```bash
POST /api/login
{
  "username": "admin",
  "password": "secret"
}

Response:
{
  "token": "eyJhbGc..."
}

# Use token in subsequent requests
Authorization: Bearer eyJhbGc...
```

---

## 🚀 Rate Limits (Future)

Currently no rate limiting. Recommended:
- 100 requests/minute per IP
- 1000 requests/hour per IP

---

## ⚠️ Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

Common error codes:
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## 📊 Data Formats

### Date Format
All dates use ISO 8601 format: `YYYY-MM-DD`

Example: `2025-12-11`

### DateTime Format
All timestamps use ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`

Example: `2025-12-11T10:30:00Z`

### Currency
All costs in VND (Vietnamese Dong), no decimal places

Example: `11000000` = 11,000,000 VND

---

## 🧪 Testing

### Test Forecast Generation
```bash
curl -X POST http://localhost:3000/api/forecast/generate \
  -H "Content-Type: application/json" \
  -d '{"horizon":30}'
```

### Test KPIs
```bash
curl http://localhost:3000/api/dashboard/kpis
```

### Test Chart Data
```bash
curl "http://localhost:3000/api/forecast/chart?days=7"
```

---

## 📝 Changelog

### v1.0.0 (2025-12-11)
- ✅ Initial release
- ✅ Dashboard KPIs API
- ✅ Forecast generation API
- ✅ Chart data API
- ✅ Calendar API
- ✅ Alerts API

### v1.1.0 (Planned)
- ⏳ Workforce calculation API
- ⏳ Authentication
- ⏳ Rate limiting
- ⏳ Webhook notifications

---

**Last Updated:** 2025-12-11
