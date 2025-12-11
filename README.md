# Boxme Forecast MVP

## Project Overview
- **Name**: Boxme Workforce & Capacity Forecasting System MVP
- **Goal**: Dự báo khối lượng đơn hàng và tính toán nhu cầu lực lượng lao động cho Boxme Fulfillment
- **Features**: 
  - Dashboard với KPI metrics và forecast chart
  - Forecast generation API (baseline + ML models)
  - Calendar view cho 30 ngày tới
  - Alert system cho workforce planning
  - D1 Database với 24 tháng historical data

## URLs
- **Local Development**: http://localhost:3000
- **Public Sandbox**: https://3000-ibo0t9s4bx3n5pvcnnrnw-18e660f9.sandbox.novita.ai
- **GitHub**: Chưa push (sẽ push sau)

## Data Architecture
- **Database**: Cloudflare D1 (SQLite-based)
- **Main Tables**:
  - `orders_history` - Lịch sử đơn hàng (có thể seed fake data 24 tháng)
  - `daily_forecasts` - Dự báo theo ngày
  - `workforce_recommendations` - Khuyến nghị lực lượng lao động
  - `hiring_alerts` - Cảnh báo tuyển dụng
  - `calendar_events` - Các ngày peak (1/1, 2/2, 3/3, ..., 11/11, 12/12)
  - `productivity_standards` - Chuẩn năng suất theo staff type/level/product group

- **Forecasting Models**:
  - Baseline: Rule-based với peak day multipliers
  - ML: Moving average + exponential smoothing
  - Ensemble: Kết hợp baseline + ML + customer forecasts

## Current Features Completed
✅ D1 Database schema với migration
✅ Seed data cho calendar events (48 double days 2024-2025)
✅ API Routes:
  - GET `/api/dashboard/kpis` - KPI metrics
  - GET `/api/forecast/chart` - Chart data
  - POST `/api/forecast/generate` - Generate forecasts
  - GET `/api/alerts` - Hiring alerts
  - GET `/api/calendar` - Calendar data

✅ Frontend Dashboard:
  - KPI Cards (Today Forecast, Next Peak Day, Workforce Gap, Accuracy)
  - Forecast Chart (Chart.js với actual + forecast lines)
  - Recent Alerts listing
  - Generate Forecast button

## Features Not Yet Implemented
⏳ Full 24 months fake data generation (script prepared but not executed)
⏳ Workforce calculation API
⏳ Calendar page với detailed forecast breakdown
⏳ Workforce planning page
⏳ Alerts page với acknowledge functionality
⏳ Authentication & authorization
⏳ Lark Chat integration
⏳ WMS/OPS API integration
⏳ Mobile responsive optimization

## Recommended Next Steps
1. **Generate full historical data**:
   ```bash
   cd /home/user/webapp
   npx tsx scripts/generate-fake-data.ts
   wrangler d1 execute boxme-forecast-production --local --file=./generated-orders.sql
   ```

2. **Implement workforce calculation API**:
   - Calculate work hours by product group
   - Determine staff needed by type/level
   - Generate hiring recommendations

3. **Add Calendar View page**:
   - Monthly calendar grid
   - Click day to see detailed forecast
   - Color-coding by order volume

4. **Add Workforce Planning page**:
   - Staff breakdown table by shift/work type
   - Cost estimation
   - Export to CSV/Lark Base

5. **Production Deployment**:
   ```bash
   # Create production D1 database
   wrangler d1 create boxme-forecast-production
   
   # Update wrangler.jsonc with database_id
   
   # Run migrations
   npm run db:migrate:prod
   
   # Deploy
   npm run deploy
   ```

## User Guide
1. **Dashboard**: Xem tổng quan KPIs và forecast chart
2. **Generate Forecast**: Click "Generate Forecast" để tạo dự báo 30 ngày
3. **View Alerts**: Kiểm tra cảnh báo tuyển dụng cần thiết

## Deployment
- **Platform**: Cloudflare Pages + D1 Database
- **Status**: ✅ Development Active (Local + Sandbox)
- **Tech Stack**: Hono + TypeScript + TailwindCSS + Chart.js + D1 SQLite
- **Last Updated**: 2025-12-11

## Development Commands
```bash
# Build
npm run build

# Start dev server (local)
npm run dev:sandbox

# Start with PM2 (daemon)
pm2 start ecosystem.config.cjs

# Database commands
npm run db:migrate:local    # Run migrations
npm run db:seed             # Seed calendar events
npm run db:reset            # Reset database

# Test
curl http://localhost:3000/api/dashboard/kpis
```

## Technical Notes
- **D1 Database**: SQLite-based, supports local development with --local flag
- **Forecasting Algorithm**: 
  - Baseline = average last 30 days × weekend/peak multipliers
  - ML = exponential smoothing + trend component
  - Final = weighted ensemble
- **Peak Day Detection**: Automatic từ calendar_events table
- **Randomness**: ±10% để simulate real-world variance

## Known Issues
- Chưa có actual orders data → KPIs hiển thị 0
- Forecast accuracy chưa tính được vì chưa có actual_orders
- Alert system chưa tự động generate từ workforce recommendations

## Contributors
- MVP Development: AI Assistant
- Business Requirements: Boxme Fulfillment Team
