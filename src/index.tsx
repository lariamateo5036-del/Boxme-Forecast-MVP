import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// ============================================
// API ROUTES
// ============================================

// Get dashboard KPIs
app.get('/api/dashboard/kpis', async (c) => {
  const { DB } = c.env;

  try {
    // Get today's forecast
    const today = new Date().toISOString().split('T')[0];
    const forecast = await DB.prepare(
      'SELECT * FROM daily_forecasts WHERE forecast_date = ? LIMIT 1'
    )
      .bind(today)
      .first();

    // Get next peak day
    const nextPeak = await DB.prepare(
      'SELECT * FROM calendar_events WHERE event_date > ? AND is_peak = 1 ORDER BY event_date ASC LIMIT 1'
    )
      .bind(today)
      .first();

    // Get workforce gap
    const workforceGap = await DB.prepare(
      'SELECT gap_total FROM workforce_recommendations WHERE forecast_date = ? LIMIT 1'
    )
      .bind(today)
      .first();

    // Get forecast accuracy (last 7 days)
    const accuracy = await DB.prepare(
      `SELECT AVG(ABS((final_forecast - actual_orders) * 100.0 / actual_orders)) as mape
       FROM daily_forecasts 
       WHERE actual_orders IS NOT NULL 
       AND forecast_date >= date('now', '-7 days')`
    ).first<{ mape: number }>();

    return c.json({
      todayForecast: forecast?.final_forecast || 0,
      nextPeakDay: nextPeak
        ? {
            date: nextPeak.event_date,
            name: nextPeak.event_name,
            daysUntil: Math.ceil(
              (new Date(nextPeak.event_date as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ),
            forecast: Math.round((nextPeak.expected_multiplier as number) * 15000),
          }
        : null,
      workforceGap: workforceGap?.gap_total || 0,
      forecastAccuracy: accuracy?.mape ? 100 - Math.min(accuracy.mape, 100) : 85,
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return c.json({ error: 'Failed to fetch KPIs' }, 500);
  }
});

// Get forecast data for chart
app.get('/api/forecast/chart', async (c) => {
  const { DB } = c.env;
  const days = parseInt(c.req.query('days') || '30');

  try {
    // Get historical data (actual orders)
    const historical = await DB.prepare(
      `SELECT order_date as date, COUNT(*) as count
       FROM orders_history
       WHERE order_date >= date('now', '-${days} days')
       GROUP BY order_date
       ORDER BY order_date ASC`
    ).all();

    // Get forecasts
    const forecasts = await DB.prepare(
      `SELECT forecast_date as date, final_forecast, lower_bound, upper_bound, is_peak_day, notes
       FROM daily_forecasts
       WHERE forecast_date >= date('now') AND forecast_date <= date('now', '+${days} days')
       ORDER BY forecast_date ASC`
    ).all();

    const chartData = [];

    // Add historical data
    if (historical.results) {
      for (const row of historical.results) {
        chartData.push({
          date: row.date,
          actual: row.count,
          isPeak: false,
        });
      }
    }

    // Add forecast data
    if (forecasts.results) {
      for (const row of forecasts.results) {
        chartData.push({
          date: row.date,
          forecast: row.final_forecast,
          lowerBound: row.lower_bound,
          upperBound: row.upper_bound,
          isPeak: row.is_peak_day === 1,
          peakLabel: row.notes,
        });
      }
    }

    return c.json({ data: chartData });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return c.json({ error: 'Failed to fetch chart data' }, 500);
  }
});

// Generate forecast
app.post('/api/forecast/generate', async (c) => {
  const { DB } = c.env;
  const { horizon = 30 } = await c.req.json().catch(() => ({}));

  try {
    // Get historical average (last 30 days)
    const avgResult = await DB.prepare(
      `SELECT AVG(cnt) as avg_orders FROM (
        SELECT COUNT(*) as cnt FROM orders_history
        WHERE order_date >= date('now', '-30 days')
        GROUP BY order_date
      )`
    ).first<{ avg_orders: number }>();

    const baseAvg = avgResult?.avg_orders || 15000;

    // Get peak events
    const peakEvents = await DB.prepare(
      `SELECT * FROM calendar_events 
       WHERE event_date >= date('now') 
       AND event_date <= date('now', '+${horizon} days')
       AND is_peak = 1`
    ).all();

    const forecasts = [];
    const today = new Date();

    for (let i = 1; i <= horizon; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(today.getDate() + i);
      const dateStr = forecastDate.toISOString().split('T')[0];
      const dayOfWeek = forecastDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Check if peak day
      const peakEvent = peakEvents.results?.find((e) => e.event_date === dateStr);

      let forecast = baseAvg;

      if (peakEvent) {
        forecast *= peakEvent.expected_multiplier as number;
      } else if (isWeekend) {
        forecast *= 1.3;
      }

      // Add some randomness
      forecast = Math.round(forecast * (0.95 + Math.random() * 0.1));

      forecasts.push({
        id: `fc-${dateStr}-${Date.now()}`,
        forecast_date: dateStr,
        model_version: 'mvp-v1.0',
        baseline_forecast: Math.round(baseAvg),
        ml_forecast: forecast,
        ml_confidence: 0.75,
        customer_forecast: 0,
        customer_weight: 0,
        final_forecast: forecast,
        lower_bound: Math.round(forecast * 0.85),
        upper_bound: Math.round(forecast * 1.2),
        is_peak_day: peakEvent ? 1 : 0,
        peak_multiplier: peakEvent ? (peakEvent.expected_multiplier as number) : 1.0,
        notes: peakEvent ? (peakEvent.event_name as string) : null,
      });
    }

    // Insert forecasts
    for (const fc of forecasts) {
      await DB.prepare(
        `INSERT OR REPLACE INTO daily_forecasts 
         (id, forecast_date, model_version, baseline_forecast, ml_forecast, ml_confidence,
          customer_forecast, customer_weight, final_forecast, lower_bound, upper_bound,
          is_peak_day, peak_multiplier, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          fc.id,
          fc.forecast_date,
          fc.model_version,
          fc.baseline_forecast,
          fc.ml_forecast,
          fc.ml_confidence,
          fc.customer_forecast,
          fc.customer_weight,
          fc.final_forecast,
          fc.lower_bound,
          fc.upper_bound,
          fc.is_peak_day,
          fc.peak_multiplier,
          fc.notes
        )
        .run();
    }

    return c.json({
      success: true,
      forecasts_generated: forecasts.length,
      message: `Generated ${forecasts.length} forecasts`,
    });
  } catch (error) {
    console.error('Error generating forecasts:', error);
    return c.json({ error: 'Failed to generate forecasts' }, 500);
  }
});

// Get alerts
app.get('/api/alerts', async (c) => {
  const { DB } = c.env;

  try {
    const alerts = await DB.prepare(
      `SELECT * FROM hiring_alerts 
       WHERE status = 'pending' 
       AND days_until_event > 0
       ORDER BY alert_date ASC LIMIT 10`
    ).all();

    return c.json({ alerts: alerts.results || [] });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return c.json({ error: 'Failed to fetch alerts' }, 500);
  }
});

// Get calendar data
app.get('/api/calendar', async (c) => {
  const { DB } = c.env;
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);

  try {
    const forecasts = await DB.prepare(
      `SELECT * FROM daily_forecasts 
       WHERE forecast_date LIKE '${month}%'
       ORDER BY forecast_date ASC`
    ).all();

    return c.json({ calendar: forecasts.results || [] });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return c.json({ error: 'Failed to fetch calendar' }, 500);
  }
});

// Calculate workforce requirements
app.post('/api/workforce/calculate', async (c) => {
  const { DB } = c.env;
  
  try {
    const { forecast_date } = await c.req.json();
    
    if (!forecast_date) {
      return c.json({ error: 'forecast_date is required' }, 400);
    }
    
    // Get forecast
    const forecast = await DB.prepare(
      'SELECT * FROM daily_forecasts WHERE forecast_date = ?'
    ).bind(forecast_date).first();
    
    if (!forecast) {
      return c.json({ error: 'Forecast not found for this date' }, 404);
    }
    
    const totalOrders = forecast.final_forecast || 0;
    
    // Get average productivity
    const avgProd = await DB.prepare(
      'SELECT AVG(orders_per_hour) as avg FROM productivity_standards'
    ).first<{ avg: number }>();
    
    const avgProductivity = avgProd?.avg || 30;
    
    // Calculate work hours by type (simplified)
    const totalHours = (totalOrders / avgProductivity) * 1.15; // 15% buffer
    const workHours = {
      pick: totalHours * 0.70,
      pack: totalHours * 0.20,
      moving: totalHours * 0.05,
      return: totalHours * 0.05,
      total: totalHours
    };
    
    // Calculate staff needed (8h shift)
    const totalStaff = Math.ceil(totalHours / 8);
    const staffNeeded = {
      boxme: Math.ceil(totalStaff * 0.70),
      veteran: Math.ceil(totalStaff * 0.20),
      seasonal: Math.ceil(totalStaff * 0.10),
      total: totalStaff
    };
    
    // Hardcoded availability (should come from roster)
    const availability = {
      boxme: 80,
      seasonal: 20,
      veteran: 30
    };
    
    // Calculate gap
    const totalAvailable = availability.boxme + availability.seasonal + availability.veteran;
    const gapTotal = Math.max(0, staffNeeded.total - totalAvailable);
    const contractorNeeded = Math.ceil(gapTotal * 1.2); // 20% buffer
    
    // Calculate costs (VND)
    const avgCostPerHour = 22000;
    const contractorBonusPerPerson = 50000;
    const mealCostPerPerson = 30000;
    
    const costs = {
      regular: Math.round(totalStaff * 8 * avgCostPerHour),
      contractorBonus: Math.round(contractorNeeded * contractorBonusPerPerson),
      meals: Math.round(contractorNeeded * mealCostPerPerson),
      total: 0
    };
    costs.total = costs.regular + costs.contractorBonus + costs.meals;
    
    // Determine alert level
    const alertLevel = contractorNeeded > 100 ? 'critical' :
                       contractorNeeded > 50 ? 'warning' : 'ok';
    
    // Build recommendation object
    const recommendation = {
      id: `wr-${forecast_date}-${Date.now()}`,
      forecast_date,
      forecast_id: forecast.id,
      total_orders: totalOrders,
      work_hours: workHours,
      staff_needed: staffNeeded,
      availability,
      gap_total: gapTotal,
      contractor_needed: contractorNeeded,
      costs,
      alert_level: alertLevel
    };
    
    // Save to database
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
      workHours.pick,
      workHours.pack,
      workHours.moving,
      workHours.return,
      workHours.total,
      staffNeeded.boxme,
      staffNeeded.seasonal,
      staffNeeded.veteran,
      staffNeeded.total,
      availability.boxme,
      availability.seasonal,
      availability.veteran,
      gapTotal,
      contractorNeeded,
      costs.regular,
      costs.contractorBonus,
      costs.meals,
      costs.total,
      alertLevel
    ).run();
    
    // Create hiring alert if needed
    if (alertLevel !== 'ok') {
      const today = new Date();
      const eventDate = new Date(forecast_date);
      const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
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

// ============================================
// CUSTOMER CONFIGURATION APIs
// ============================================

// GET /api/customers - List all customers
app.get('/api/customers', async (c) => {
  const { DB } = c.env;
  try {
    const customers = await DB.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM orders_history WHERE customer_id = c.id) as total_orders,
        (SELECT COUNT(*) FROM customer_sla WHERE customer_id = c.id) as sla_count,
        (SELECT COUNT(*) FROM customer_product_mix WHERE customer_id = c.id) as product_categories
      FROM customers c
      WHERE c.is_active = 1
      ORDER BY c.name
    `).all();
    
    return c.json({ customers: customers.results || [] });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return c.json({ error: 'Failed to fetch customers' }, 500);
  }
});

// GET /api/customers/:id - Get customer detail
app.get('/api/customers/:id', async (c) => {
  const { DB } = c.env;
  const customerId = c.req.param('id');
  
  try {
    const customer = await DB.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(customerId).first();
    
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    return c.json({ customer });
  } catch (error) {
    console.error('Error fetching customer:', error);
    return c.json({ error: 'Failed to fetch customer' }, 500);
  }
});

// GET /api/customers/:id/config - Get full customer configuration
app.get('/api/customers/:id/config', async (c) => {
  const { DB } = c.env;
  const customerId = c.req.param('id');
  
  try {
    // Get customer basic info
    const customer = await DB.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(customerId).first();
    
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // Get operations config
    const operations = await DB.prepare(
      'SELECT * FROM customer_operations WHERE customer_id = ?'
    ).bind(customerId).first();
    
    // Get SLA configs
    const sla = await DB.prepare(
      'SELECT * FROM customer_sla WHERE customer_id = ?'
    ).bind(customerId).all();
    
    // Get product mix
    const productMix = await DB.prepare(
      'SELECT * FROM customer_product_mix WHERE customer_id = ? ORDER BY percentage DESC'
    ).bind(customerId).all();
    
    return c.json({
      customer,
      operations,
      sla: sla.results || [],
      productMix: productMix.results || []
    });
  } catch (error) {
    console.error('Error fetching customer config:', error);
    return c.json({ error: 'Failed to fetch customer config' }, 500);
  }
});

// GET /api/customers/:id/stats - Get customer statistics
app.get('/api/customers/:id/stats', async (c) => {
  const { DB } = c.env;
  const customerId = c.req.param('id');
  
  try {
    // Get order statistics
    const stats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN order_date = date('now') THEN 1 END) as orders_today,
        COUNT(CASE WHEN order_date >= date('now', '-7 days') THEN 1 END) as orders_this_week,
        COUNT(CASE WHEN order_date >= date('now', '-30 days') THEN 1 END) as orders_this_month,
        AVG(CASE WHEN order_date >= date('now', '-30 days') THEN 1.0 ELSE 0 END) * 30 as avg_per_day,
        COUNT(CASE WHEN packing_method = 'FIELD_TABLE' THEN 1 END) as field_table_orders,
        COUNT(CASE WHEN packing_method = 'PREPACK' THEN 1 END) as prepack_orders,
        COUNT(CASE WHEN packing_method = 'STANDARD' THEN 1 END) as standard_orders
      FROM orders_history
      WHERE customer_id = ?
    `).bind(customerId).first();
    
    return c.json({ stats: stats || {} });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    return c.json({ error: 'Failed to fetch customer stats' }, 500);
  }
});

// ============================================
// PLATFORM SLA APIs
// ============================================

// GET /api/platforms - List all platforms with SLA configs
app.get('/api/platforms', async (c) => {
  const { DB } = c.env;
  try {
    const platforms = await DB.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM platform_service_tiers WHERE platform_id = p.id) as tiers_count,
        (SELECT COUNT(*) FROM platform_quality_requirements WHERE platform_id = p.id) as quality_metrics_count
      FROM platform_sla_config p
      WHERE p.is_active = 1
      ORDER BY p.platform_name
    `).all();
    
    return c.json({ platforms: platforms.results || [] });
  } catch (error) {
    console.error('Error fetching platforms:', error);
    return c.json({ error: 'Failed to fetch platforms' }, 500);
  }
});

// GET /api/platforms/:id - Get platform detail with all configs
app.get('/api/platforms/:id', async (c) => {
  const { DB } = c.env;
  const platformId = c.req.param('id');
  
  try {
    // Get platform basic info
    const platform = await DB.prepare(
      'SELECT * FROM platform_sla_config WHERE id = ?'
    ).bind(platformId).first();
    
    if (!platform) {
      return c.json({ error: 'Platform not found' }, 404);
    }
    
    // Get service tiers
    const tiers = await DB.prepare(
      'SELECT * FROM platform_service_tiers WHERE platform_id = ? ORDER BY tier_code'
    ).bind(platformId).all();
    
    // Get quality requirements
    const quality = await DB.prepare(
      'SELECT * FROM platform_quality_requirements WHERE platform_id = ?'
    ).bind(platformId).all();
    
    // Get notes
    const notes = await DB.prepare(
      'SELECT * FROM platform_notes WHERE platform_id = ? ORDER BY display_order'
    ).bind(platformId).all();
    
    return c.json({
      platform,
      tiers: tiers.results || [],
      quality: quality.results || [],
      notes: notes.results || []
    });
  } catch (error) {
    console.error('Error fetching platform detail:', error);
    return c.json({ error: 'Failed to fetch platform detail' }, 500);
  }
});

// ============================================
// SETTINGS MODULE APIs
// ============================================

// GET /api/settings/warehouses - List all warehouses with shifts
app.get('/api/settings/warehouses', async (c) => {
  const { DB } = c.env;
  try {
    const warehouses = await DB.prepare(`
      SELECT w.*,
        (SELECT COUNT(*) FROM shift_configurations WHERE warehouse_id = w.id AND is_active = 1) as shifts_count
      FROM warehouses w
      WHERE w.is_active = 1
      ORDER BY w.code
    `).all();
    
    return c.json({ warehouses: warehouses.results || [] });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return c.json({ error: 'Failed to fetch warehouses' }, 500);
  }
});

// GET /api/settings/warehouses/:id - Get warehouse detail with shifts
app.get('/api/settings/warehouses/:id', async (c) => {
  const { DB } = c.env;
  const warehouseId = c.req.param('id');
  
  try {
    // Get warehouse basic info
    const warehouse = await DB.prepare(
      'SELECT * FROM warehouses WHERE id = ?'
    ).bind(warehouseId).first();
    
    if (!warehouse) {
      return c.json({ error: 'Warehouse not found' }, 404);
    }
    
    // Get shifts
    const shifts = await DB.prepare(
      'SELECT * FROM shift_configurations WHERE warehouse_id = ? AND is_active = 1 ORDER BY start_time'
    ).bind(warehouseId).all();
    
    return c.json({
      warehouse,
      shifts: shifts.results || []
    });
  } catch (error) {
    console.error('Error fetching warehouse detail:', error);
    return c.json({ error: 'Failed to fetch warehouse detail' }, 500);
  }
});

// GET /api/settings/productivity - List all productivity standards
app.get('/api/settings/productivity', async (c) => {
  const { DB } = c.env;
  const staffLevel = c.req.query('staff_level');
  const workType = c.req.query('work_type');
  const productGroup = c.req.query('product_group');
  
  try {
    let query = 'SELECT * FROM productivity_standards_v2 WHERE is_active = 1';
    const bindings = [];
    
    if (staffLevel) {
      query += ' AND staff_level = ?';
      bindings.push(staffLevel);
    }
    if (workType) {
      query += ' AND work_type = ?';
      bindings.push(workType);
    }
    if (productGroup) {
      query += ' AND product_group = ?';
      bindings.push(productGroup);
    }
    
    query += ' ORDER BY staff_level, work_type, product_group';
    
    const standards = await DB.prepare(query).bind(...bindings).all();
    
    return c.json({ standards: standards.results || [] });
  } catch (error) {
    console.error('Error fetching productivity standards:', error);
    return c.json({ error: 'Failed to fetch productivity standards' }, 500);
  }
});

// PUT /api/settings/productivity/:id - Update productivity standard
app.put('/api/settings/productivity/:id', async (c) => {
  const { DB } = c.env;
  const standardId = c.req.param('id');
  
  try {
    const body = await c.req.json();
    const {
      orders_per_hour,
      percentile_50,
      percentile_75,
      percentile_90,
      min_threshold,
      max_threshold,
      field_table_multiplier,
      prepack_multiplier,
      rush_multiplier
    } = body;
    
    const result = await DB.prepare(`
      UPDATE productivity_standards_v2
      SET 
        orders_per_hour = ?,
        percentile_50 = ?,
        percentile_75 = ?,
        percentile_90 = ?,
        min_threshold = ?,
        max_threshold = ?,
        field_table_multiplier = ?,
        prepack_multiplier = ?,
        rush_multiplier = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      orders_per_hour,
      percentile_50,
      percentile_75,
      percentile_90,
      min_threshold,
      max_threshold,
      field_table_multiplier,
      prepack_multiplier,
      rush_multiplier,
      standardId
    ).run();
    
    if (result.meta.changes === 0) {
      return c.json({ error: 'Productivity standard not found' }, 404);
    }
    
    return c.json({ success: true, message: 'Productivity standard updated' });
  } catch (error) {
    console.error('Error updating productivity standard:', error);
    return c.json({ error: 'Failed to update productivity standard' }, 500);
  }
});

// GET /api/settings/carriers - List all carriers with pickup windows
app.get('/api/settings/carriers', async (c) => {
  const { DB } = c.env;
  try {
    const carriers = await DB.prepare(`
      SELECT 
        c.carrier_code,
        c.carrier_name,
        COUNT(*) as pickup_windows_count,
        SUM(c.capacity) as total_capacity
      FROM carrier_pickup_windows c
      WHERE c.is_active = 1
      GROUP BY c.carrier_code, c.carrier_name
      ORDER BY c.carrier_name
    `).all();
    
    return c.json({ carriers: carriers.results || [] });
  } catch (error) {
    console.error('Error fetching carriers:', error);
    return c.json({ error: 'Failed to fetch carriers' }, 500);
  }
});

// GET /api/settings/carriers/:code/windows - Get carrier pickup windows
app.get('/api/settings/carriers/:code/windows', async (c) => {
  const { DB } = c.env;
  const carrierCode = c.req.param('code');
  
  try {
    const windows = await DB.prepare(
      'SELECT * FROM carrier_pickup_windows WHERE carrier_code = ? AND is_active = 1 ORDER BY day_of_week, pickup_time'
    ).bind(carrierCode).all();
    
    return c.json({ windows: windows.results || [] });
  } catch (error) {
    console.error('Error fetching carrier windows:', error);
    return c.json({ error: 'Failed to fetch carrier windows' }, 500);
  }
});

// ============================================
// FRONTEND PAGES
// ============================================

// Calendar page
app.get('/calendar', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Calendar - Boxme Forecast MVP</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md hover:bg-blue-700">Dashboard</a>
                        <a href="/calendar" class="px-3 py-2 rounded-md bg-blue-700">Calendar</a>
                        <a href="/workforce" class="px-3 py-2 rounded-md hover:bg-blue-700">Workforce</a>
                        <a href="/alerts" class="px-3 py-2 rounded-md hover:bg-blue-700">Alerts</a>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-6">
                <i class="fas fa-calendar-alt mr-3"></i>
                Forecast Calendar
            </h1>

            <div class="bg-white rounded-lg shadow p-6" id="calendar-container">
                <div class="text-center py-8">Loading calendar...</div>
            </div>
        </div>

        <script>
            async function loadCalendar() {
                try {
                    const now = new Date();
                    const month = now.toISOString().slice(0, 7);
                    
                    const res = await axios.get('/api/calendar?month=' + month);
                    const data = res.data.calendar;

                    const container = document.getElementById('calendar-container');
                    
                    if (data.length === 0) {
                        container.innerHTML = '<div class="text-center py-8 text-gray-500">No forecast data available</div>';
                        return;
                    }

                    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
                    
                    data.forEach(day => {
                        const peakBadge = day.is_peak_day ? 
                            '<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">PEAK</span>' : 
                            '';
                        
                        const alertClass = day.is_peak_day ? 'border-l-4 border-red-500' : '';

                        html += \`
                            <div class="border rounded-lg p-4 hover:shadow-md transition \${alertClass}">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <div class="text-lg font-bold text-gray-800">\${day.forecast_date}</div>
                                        <div class="text-xs text-gray-500">\${day.notes || 'Normal day'}</div>
                                    </div>
                                    \${peakBadge}
                                </div>
                                <div class="text-3xl font-bold text-blue-600 mb-2">
                                    \${day.final_forecast.toLocaleString()}
                                </div>
                                <div class="text-sm text-gray-600">
                                    Range: \${day.lower_bound.toLocaleString()} - \${day.upper_bound.toLocaleString()}
                                </div>
                                <div class="text-xs text-gray-500 mt-2">
                                    Confidence: \${(day.ml_confidence * 100).toFixed(0)}%
                                </div>
                            </div>
                        \`;
                    });

                    html += '</div>';
                    container.innerHTML = html;
                } catch (error) {
                    console.error('Error loading calendar:', error);
                    document.getElementById('calendar-container').innerHTML = 
                        '<div class="text-center py-8 text-red-500">Error loading calendar</div>';
                }
            }

            document.addEventListener('DOMContentLoaded', loadCalendar);
        </script>
    </body>
    </html>
  `);
});

// Customers List page
app.get('/customers', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quản lý Khách hàng - Boxme Forecast</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md hover:bg-blue-700">Dashboard</a>
                        <a href="/calendar" class="px-3 py-2 rounded-md hover:bg-blue-700">Calendar</a>
                        <a href="/workforce" class="px-3 py-2 rounded-md hover:bg-blue-700">Workforce</a>
                        <a href="/customers" class="px-3 py-2 rounded-md bg-blue-700">Customers</a>
                        <a href="/settings" class="px-3 py-2 rounded-md hover:bg-blue-700">Settings</a>
                        <a href="/alerts" class="px-3 py-2 rounded-md hover:bg-blue-700">Alerts</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="flex justify-between items-center mb-6">
                <h1 class="text-3xl font-bold text-gray-800">
                    <i class="fas fa-users mr-3"></i>
                    Quản lý Khách hàng
                </h1>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-lg shadow p-4 mb-6">
                <div class="flex gap-4">
                    <div class="flex-1">
                        <input type="text" id="search" placeholder="🔍 Tìm kiếm khách hàng..." 
                               class="w-full border rounded px-4 py-2" onkeyup="filterCustomers()">
                    </div>
                    <select id="filter-tier" class="border rounded px-4 py-2" onchange="filterCustomers()">
                        <option value="">Tất cả tier</option>
                        <option value="PREMIUM">Premium</option>
                        <option value="STANDARD">Standard</option>
                        <option value="BASIC">Basic</option>
                    </select>
                    <select id="filter-platform" class="border rounded px-4 py-2" onchange="filterCustomers()">
                        <option value="">Tất cả platform</option>
                        <option value="SHOPEE">Shopee</option>
                        <option value="LAZADA">Lazada</option>
                        <option value="TIKTOK">TikTok</option>
                    </select>
                </div>
            </div>

            <!-- Customers Table -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <table class="min-w-full">
                    <thead class="bg-gray-50 border-b">
                        <tr>
                            <th class="text-left py-3 px-4 font-semibold text-sm">Customer</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm">Platform</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm">Tier</th>
                            <th class="text-right py-3 px-4 font-semibold text-sm">Tổng đơn</th>
                            <th class="text-center py-3 px-4 font-semibold text-sm">SLA</th>
                            <th class="text-center py-3 px-4 font-semibold text-sm">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="customers-table-body">
                        <tr>
                            <td colspan="6" class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <div>Loading customers...</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <script>
            let allCustomers = [];

            async function loadCustomers() {
                try {
                    const res = await axios.get('/api/customers');
                    allCustomers = res.data.customers;
                    renderCustomers(allCustomers);
                } catch (error) {
                    console.error('Error loading customers:', error);
                    document.getElementById('customers-table-body').innerHTML = \`
                        <tr><td colspan="6" class="text-center py-8 text-red-500">
                            Error loading customers
                        </td></tr>
                    \`;
                }
            }

            function renderCustomers(customers) {
                const tbody = document.getElementById('customers-table-body');
                
                if (customers.length === 0) {
                    tbody.innerHTML = \`
                        <tr><td colspan="6" class="text-center py-8 text-gray-500">
                            No customers found
                        </td></tr>
                    \`;
                    return;
                }

                tbody.innerHTML = customers.map(customer => {
                    const tierColors = {
                        'PREMIUM': 'bg-purple-100 text-purple-800',
                        'STANDARD': 'bg-blue-100 text-blue-800',
                        'BASIC': 'bg-gray-100 text-gray-800'
                    };
                    const tierColor = tierColors[customer.tier] || 'bg-gray-100 text-gray-800';
                    
                    return \`
                        <tr class="border-b hover:bg-gray-50 customer-row" 
                            data-name="\${customer.name.toLowerCase()}"
                            data-tier="\${customer.tier}"
                            data-platform="\${customer.primary_platform}">
                            <td class="py-3 px-4">
                                <div class="font-semibold text-gray-800">\${customer.name}</div>
                                <div class="text-xs text-gray-500">\${customer.code}</div>
                            </td>
                            <td class="py-3 px-4">
                                <span class="inline-block px-2 py-1 text-xs rounded bg-blue-50 text-blue-700">
                                    \${customer.primary_platform}
                                </span>
                            </td>
                            <td class="py-3 px-4">
                                <span class="inline-block px-2 py-1 text-xs rounded \${tierColor}">
                                    \${customer.tier}
                                </span>
                            </td>
                            <td class="text-right py-3 px-4 font-semibold">
                                \${(customer.total_orders || 0).toLocaleString()}
                            </td>
                            <td class="text-center py-3 px-4">
                                <span class="text-green-600">
                                    <i class="fas fa-check-circle"></i> \${customer.sla_count || 0}
                                </span>
                            </td>
                            <td class="text-center py-3 px-4">
                                <a href="/customers/\${customer.id}" 
                                   class="text-blue-600 hover:text-blue-800 font-semibold">
                                    <i class="fas fa-eye mr-1"></i>Detail
                                </a>
                            </td>
                        </tr>
                    \`;
                }).join('');
            }

            function filterCustomers() {
                const search = document.getElementById('search').value.toLowerCase();
                const tierFilter = document.getElementById('filter-tier').value;
                const platformFilter = document.getElementById('filter-platform').value;

                const filtered = allCustomers.filter(customer => {
                    const matchSearch = !search || customer.name.toLowerCase().includes(search) || 
                                       customer.code.toLowerCase().includes(search);
                    const matchTier = !tierFilter || customer.tier === tierFilter;
                    const matchPlatform = !platformFilter || customer.primary_platform === platformFilter;
                    
                    return matchSearch && matchTier && matchPlatform;
                });

                renderCustomers(filtered);
            }

            document.addEventListener('DOMContentLoaded', loadCustomers);
        </script>
    </body>
    </html>
  `);
});

// Customer Detail page
app.get('/customers/:id', (c) => {
  const customerId = c.req.param('id');
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chi tiết Khách hàng - Boxme Forecast</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md hover:bg-blue-700">Dashboard</a>
                        <a href="/customers" class="px-3 py-2 rounded-md bg-blue-700">Customers</a>
                        <a href="/settings" class="px-3 py-2 rounded-md hover:bg-blue-700">Settings</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center">
                    <a href="/customers" class="text-gray-600 hover:text-gray-800 mr-4">
                        <i class="fas fa-arrow-left text-xl"></i>
                    </a>
                    <h1 class="text-3xl font-bold text-gray-800" id="customer-name">
                        <i class="fas fa-spinner fa-spin mr-2"></i>Loading...
                    </h1>
                </div>
            </div>

            <!-- Tabs -->
            <div class="bg-white rounded-lg shadow mb-6">
                <div class="border-b">
                    <nav class="flex">
                        <button onclick="switchTab('overview')" 
                                class="tab-btn px-6 py-3 font-semibold border-b-2 border-blue-600 text-blue-600" 
                                data-tab="overview">
                            <i class="fas fa-chart-pie mr-2"></i>Overview
                        </button>
                        <button onclick="switchTab('operations')" 
                                class="tab-btn px-6 py-3 font-semibold text-gray-600 hover:text-gray-800" 
                                data-tab="operations">
                            <i class="fas fa-cogs mr-2"></i>Operations
                        </button>
                        <button onclick="switchTab('sla')" 
                                class="tab-btn px-6 py-3 font-semibold text-gray-600 hover:text-gray-800" 
                                data-tab="sla">
                            <i class="fas fa-clock mr-2"></i>SLA Config
                        </button>
                        <button onclick="switchTab('product-mix')" 
                                class="tab-btn px-6 py-3 font-semibold text-gray-600 hover:text-gray-800" 
                                data-tab="product-mix">
                            <i class="fas fa-box mr-2"></i>Product Mix
                        </button>
                        <button onclick="switchTab('stats')" 
                                class="tab-btn px-6 py-3 font-semibold text-gray-600 hover:text-gray-800" 
                                data-tab="stats">
                            <i class="fas fa-chart-bar mr-2"></i>Statistics
                        </button>
                    </nav>
                </div>

                <!-- Tab Content -->
                <div class="p-6">
                    <!-- Overview Tab -->
                    <div id="tab-overview" class="tab-content">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                            <div class="bg-blue-50 rounded-lg p-4">
                                <div class="text-sm text-gray-600 mb-1">Platform</div>
                                <div class="text-2xl font-bold text-blue-600" id="overview-platform">-</div>
                            </div>
                            <div class="bg-purple-50 rounded-lg p-4">
                                <div class="text-sm text-gray-600 mb-1">Tier</div>
                                <div class="text-2xl font-bold text-purple-600" id="overview-tier">-</div>
                            </div>
                            <div class="bg-green-50 rounded-lg p-4">
                                <div class="text-sm text-gray-600 mb-1">Total Orders</div>
                                <div class="text-2xl font-bold text-green-600" id="overview-orders">-</div>
                            </div>
                            <div class="bg-orange-50 rounded-lg p-4">
                                <div class="text-sm text-gray-600 mb-1">SLA Configs</div>
                                <div class="text-2xl font-bold text-orange-600" id="overview-sla">-</div>
                            </div>
                        </div>
                        <div id="overview-content" class="text-gray-600">
                            Loading overview data...
                        </div>
                    </div>

                    <!-- Operations Tab -->
                    <div id="tab-operations" class="tab-content hidden">
                        <div id="operations-content">Loading operations config...</div>
                    </div>

                    <!-- SLA Tab -->
                    <div id="tab-sla" class="tab-content hidden">
                        <div id="sla-content">Loading SLA configs...</div>
                    </div>

                    <!-- Product Mix Tab -->
                    <div id="tab-product-mix" class="tab-content hidden">
                        <div style="max-width: 500px; margin: 0 auto;">
                            <canvas id="productMixChart"></canvas>
                        </div>
                        <div id="product-mix-table" class="mt-6"></div>
                    </div>

                    <!-- Stats Tab -->
                    <div id="tab-stats" class="tab-content hidden">
                        <div id="stats-content">Loading statistics...</div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            const customerId = '${customerId}';
            let customerData = null;
            let productMixChart = null;

            async function loadCustomerData() {
                try {
                    const [configRes, statsRes] = await Promise.all([
                        axios.get(\`/api/customers/\${customerId}/config\`),
                        axios.get(\`/api/customers/\${customerId}/stats\`)
                    ]);
                    
                    customerData = configRes.data;
                    const stats = statsRes.data.stats;
                    
                    // Update header
                    document.getElementById('customer-name').innerHTML = 
                        \`<i class="fas fa-user-circle mr-2"></i>\${customerData.customer.name}\`;
                    
                    // Update overview cards
                    document.getElementById('overview-platform').textContent = customerData.customer.primary_platform || '-';
                    document.getElementById('overview-tier').textContent = customerData.customer.tier || '-';
                    document.getElementById('overview-orders').textContent = (stats.total_orders || 0).toLocaleString();
                    document.getElementById('overview-sla').textContent = customerData.sla.length;
                    
                    // Render tabs
                    renderOverview();
                    renderOperations();
                    renderSLA();
                    renderProductMix();
                    renderStats(stats);
                    
                } catch (error) {
                    console.error('Error loading customer data:', error);
                    alert('Failed to load customer data');
                }
            }

            function renderOverview() {
                const content = document.getElementById('overview-content');
                content.innerHTML = \`
                    <div class="space-y-4">
                        <div>
                            <label class="font-semibold text-gray-700">Code:</label>
                            <span class="ml-2">\${customerData.customer.code}</span>
                        </div>
                        <div>
                            <label class="font-semibold text-gray-700">Status:</label>
                            <span class="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                                \${customerData.customer.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div>
                            <label class="font-semibold text-gray-700">Created:</label>
                            <span class="ml-2">\${new Date(customerData.customer.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                    </div>
                \`;
            }

            function renderOperations() {
                const ops = customerData.operations;
                if (!ops) {
                    document.getElementById('operations-content').innerHTML = '<div class="text-gray-500">No operations config found</div>';
                    return;
                }
                
                const content = \`
                    <div class="space-y-6">
                        <div class="border rounded-lg p-4">
                            <h3 class="font-bold text-lg mb-3">Field Table Configuration</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-sm text-gray-600">Enabled:</label>
                                    <div class="font-semibold">\${ops.field_table_enabled ? '✅ Yes' : '❌ No'}</div>
                                </div>
                                <div>
                                    <label class="text-sm text-gray-600">Max SKU:</label>
                                    <div class="font-semibold">\${ops.field_table_max_sku}</div>
                                </div>
                                <div>
                                    <label class="text-sm text-gray-600">Max Items:</label>
                                    <div class="font-semibold">\${ops.field_table_max_items}</div>
                                </div>
                                <div>
                                    <label class="text-sm text-gray-600">Max Weight:</label>
                                    <div class="font-semibold">\${ops.field_table_max_weight} kg</div>
                                </div>
                            </div>
                        </div>

                        <div class="border rounded-lg p-4">
                            <h3 class="font-bold text-lg mb-3">Pre-pack Configuration</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-sm text-gray-600">Enabled:</label>
                                    <div class="font-semibold">\${ops.prepack_enabled ? '✅ Yes' : '❌ No'}</div>
                                </div>
                                <div>
                                    <label class="text-sm text-gray-600">Weekly Quota:</label>
                                    <div class="font-semibold">\${(ops.prepack_weekly_quota || 0).toLocaleString()}</div>
                                </div>
                                <div>
                                    <label class="text-sm text-gray-600">Min Weight:</label>
                                    <div class="font-semibold">\${ops.prepack_min_weight} kg</div>
                                </div>
                            </div>
                        </div>

                        <div class="border rounded-lg p-4">
                            <h3 class="font-bold text-lg mb-3">Quality Settings</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-sm text-gray-600">Requires Camera:</label>
                                    <div class="font-semibold">\${ops.requires_camera ? '✅ Yes' : '❌ No'}</div>
                                </div>
                                <div>
                                    <label class="text-sm text-gray-600">Quality Level:</label>
                                    <div class="font-semibold">\${ops.quality_check_level}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                \`;
                document.getElementById('operations-content').innerHTML = content;
            }

            function renderSLA() {
                const slaList = customerData.sla;
                if (slaList.length === 0) {
                    document.getElementById('sla-content').innerHTML = '<div class="text-gray-500">No SLA configs found</div>';
                    return;
                }
                
                const content = \`
                    <div class="space-y-4">
                        \${slaList.map(sla => \`
                            <div class="border rounded-lg p-4">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 class="font-bold text-lg">\${sla.platform}</h3>
                                        <span class="text-sm text-gray-600">\${sla.tier}</span>
                                    </div>
                                    <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                        Priority: \${sla.priority_level}
                                    </span>
                                </div>
                                <div class="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <label class="text-gray-600">Cutoff Time:</label>
                                        <div class="font-semibold">\${sla.cutoff_time}</div>
                                    </div>
                                    <div>
                                        <label class="text-gray-600">Buffer Hours:</label>
                                        <div class="font-semibold">\${sla.internal_buffer_hours}h</div>
                                    </div>
                                    <div>
                                        <label class="text-gray-600">Can Delay:</label>
                                        <div class="font-semibold">\${sla.can_delay_non_urgent ? 'Yes' : 'No'}</div>
                                    </div>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                \`;
                document.getElementById('sla-content').innerHTML = content;
            }

            function renderProductMix() {
                const productMix = customerData.productMix;
                if (productMix.length === 0) {
                    document.getElementById('product-mix-table').innerHTML = '<div class="text-gray-500">No product mix data</div>';
                    return;
                }
                
                // Render chart
                const ctx = document.getElementById('productMixChart');
                if (productMixChart) productMixChart.destroy();
                
                productMixChart = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: productMix.map(p => p.category_name),
                        datasets: [{
                            data: productMix.map(p => p.percentage),
                            backgroundColor: [
                                '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
                                '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
                
                // Render table
                const tableContent = \`
                    <table class="min-w-full border">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="text-left py-2 px-4">Category</th>
                                <th class="text-right py-2 px-4">Percentage</th>
                                <th class="text-right py-2 px-4">Avg Processing</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${productMix.map(p => \`
                                <tr class="border-b">
                                    <td class="py-2 px-4">\${p.category_name}</td>
                                    <td class="text-right py-2 px-4 font-semibold">\${p.percentage}%</td>
                                    <td class="text-right py-2 px-4">\${p.avg_processing_minutes} min</td>
                                </tr>
                            \`).join('')}
                        </tbody>
                    </table>
                \`;
                document.getElementById('product-mix-table').innerHTML = tableContent;
            }

            function renderStats(stats) {
                const content = \`
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div class="bg-blue-50 rounded-lg p-4">
                            <div class="text-sm text-gray-600 mb-1">Today</div>
                            <div class="text-3xl font-bold text-blue-600">\${(stats.orders_today || 0).toLocaleString()}</div>
                        </div>
                        <div class="bg-green-50 rounded-lg p-4">
                            <div class="text-sm text-gray-600 mb-1">This Week</div>
                            <div class="text-3xl font-bold text-green-600">\${(stats.orders_this_week || 0).toLocaleString()}</div>
                        </div>
                        <div class="bg-purple-50 rounded-lg p-4">
                            <div class="text-sm text-gray-600 mb-1">This Month</div>
                            <div class="text-3xl font-bold text-purple-600">\${(stats.orders_this_month || 0).toLocaleString()}</div>
                        </div>
                        <div class="bg-orange-50 rounded-lg p-4">
                            <div class="text-sm text-gray-600 mb-1">Avg/Day</div>
                            <div class="text-3xl font-bold text-orange-600">\${Math.round(stats.avg_per_day || 0).toLocaleString()}</div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <h3 class="font-bold text-lg mb-4">By Packing Method</h3>
                        <div class="grid grid-cols-3 gap-4">
                            <div class="border rounded-lg p-4">
                                <div class="text-sm text-gray-600 mb-1">Standard</div>
                                <div class="text-2xl font-bold">\${(stats.standard_orders || 0).toLocaleString()}</div>
                            </div>
                            <div class="border rounded-lg p-4">
                                <div class="text-sm text-gray-600 mb-1">Field Table</div>
                                <div class="text-2xl font-bold text-blue-600">\${(stats.field_table_orders || 0).toLocaleString()}</div>
                            </div>
                            <div class="border rounded-lg p-4">
                                <div class="text-sm text-gray-600 mb-1">Pre-pack</div>
                                <div class="text-2xl font-bold text-green-600">\${(stats.prepack_orders || 0).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                \`;
                document.getElementById('stats-content').innerHTML = content;
            }

            function switchTab(tabName) {
                // Hide all tabs
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.add('hidden');
                });
                
                // Remove active class from all buttons
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.remove('border-blue-600', 'text-blue-600');
                    btn.classList.add('text-gray-600');
                });
                
                // Show selected tab
                document.getElementById(\`tab-\${tabName}\`).classList.remove('hidden');
                
                // Add active class to clicked button
                const activeBtn = document.querySelector(\`[data-tab="\${tabName}"]\`);
                activeBtn.classList.add('border-blue-600', 'text-blue-600');
                activeBtn.classList.remove('text-gray-600');
            }

            document.addEventListener('DOMContentLoaded', loadCustomerData);
        </script>
    </body>
    </html>
  `);
});

// Workforce Planning page
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
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md hover:bg-blue-700">Dashboard</a>
                        <a href="/calendar" class="px-3 py-2 rounded-md hover:bg-blue-700">Calendar</a>
                        <a href="/workforce" class="px-3 py-2 rounded-md bg-blue-700">Workforce</a>
                        <a href="/alerts" class="px-3 py-2 rounded-md hover:bg-blue-700">Alerts</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-6">
                <i class="fas fa-users mr-3"></i>
                Workforce Planning
            </h1>

            <!-- Date Selector -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <div class="flex flex-col md:flex-row gap-4 items-center">
                    <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Chọn ngày cần lập kế hoạch</label>
                        <input type="date" id="plan-date" class="border rounded px-4 py-2 w-full" />
                    </div>
                    <div class="flex gap-2">
                        <button onclick="selectTomorrow()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                            <i class="fas fa-calendar-day mr-2"></i>Ngày mai
                        </button>
                        <button onclick="selectNextWeek()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                            <i class="fas fa-calendar-week mr-2"></i>Tuần sau
                        </button>
                        <button onclick="loadWorkforce()" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
                            <i class="fas fa-calculator mr-2"></i>Tính toán
                        </button>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm font-medium mb-2">Tổng đơn hàng</div>
                    <div class="text-3xl font-bold text-blue-600" id="total-orders">-</div>
                    <div class="text-sm text-gray-400 mt-1">orders</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm font-medium mb-2">Nhân viên cần</div>
                    <div class="text-3xl font-bold text-green-600" id="staff-needed">-</div>
                    <div class="text-sm text-gray-400 mt-1">người</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm font-medium mb-2">Thiếu hụt</div>
                    <div class="text-3xl font-bold text-orange-600" id="workforce-gap">-</div>
                    <div class="text-sm text-gray-400 mt-1">thời vụ cần tuyển</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm font-medium mb-2">Tổng chi phí</div>
                    <div class="text-3xl font-bold text-purple-600" id="total-cost">-</div>
                    <div class="text-sm text-gray-400 mt-1">VND</div>
                </div>
            </div>

            <!-- Two Column Layout -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- Staff Breakdown Table -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-list mr-2"></i>Chi tiết phân bổ
                    </h2>
                    <div id="breakdown-table" class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="border-b bg-gray-50">
                                    <th class="text-left py-3 px-4 font-semibold text-sm">Loại nhân viên</th>
                                    <th class="text-right py-3 px-4 font-semibold text-sm">Cần</th>
                                    <th class="text-right py-3 px-4 font-semibold text-sm">Có</th>
                                    <th class="text-right py-3 px-4 font-semibold text-sm">Gap</th>
                                </tr>
                            </thead>
                            <tbody id="breakdown-body">
                                <tr>
                                    <td colspan="4" class="text-center py-8 text-gray-500">
                                        Chọn ngày và nhấn "Tính toán"
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Staff Mix Chart -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-chart-pie mr-2"></i>Cơ cấu nhân sự
                    </h2>
                    <div style="height: 250px; position: relative;">
                        <canvas id="staffMixChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Work Hours Breakdown -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-clock mr-2"></i>Phân bổ giờ công
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="border rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Pick (Nhặt hàng)</div>
                        <div class="text-2xl font-bold text-blue-600" id="hours-pick">-</div>
                        <div class="text-xs text-gray-400 mt-1">giờ</div>
                    </div>
                    <div class="border rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Pack (Đóng gói)</div>
                        <div class="text-2xl font-bold text-green-600" id="hours-pack">-</div>
                        <div class="text-xs text-gray-400 mt-1">giờ</div>
                    </div>
                    <div class="border rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Moving (Di chuyển)</div>
                        <div class="text-2xl font-bold text-yellow-600" id="hours-moving">-</div>
                        <div class="text-xs text-gray-400 mt-1">giờ</div>
                    </div>
                    <div class="border rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Return (Trả hàng)</div>
                        <div class="text-2xl font-bold text-red-600" id="hours-return">-</div>
                        <div class="text-xs text-gray-400 mt-1">giờ</div>
                    </div>
                </div>
            </div>

            <!-- Cost Breakdown -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-money-bill-wave mr-2"></i>Chi tiết chi phí
                </h2>
                <div class="space-y-3">
                    <div class="flex justify-between items-center py-2 border-b">
                        <span class="text-gray-700">Lương cơ bản (regular wages)</span>
                        <span class="font-semibold" id="cost-regular">-</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b">
                        <span class="text-gray-700">Thưởng thời vụ (contractor bonus)</span>
                        <span class="font-semibold" id="cost-bonus">-</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b">
                        <span class="text-gray-700">Chi phí ăn uống (meals)</span>
                        <span class="font-semibold" id="cost-meals">-</span>
                    </div>
                    <div class="flex justify-between items-center py-3 bg-blue-50 rounded px-4">
                        <span class="text-lg font-bold text-blue-900">TỔNG CỘNG</span>
                        <span class="text-xl font-bold text-blue-600" id="cost-total-detail">-</span>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let staffChart = null;

            // Set default date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('plan-date').valueAsDate = tomorrow;

            function selectTomorrow() {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                document.getElementById('plan-date').valueAsDate = tomorrow;
            }

            function selectNextWeek() {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                document.getElementById('plan-date').valueAsDate = nextWeek;
            }

            async function loadWorkforce() {
                const date = document.getElementById('plan-date').value;
                if (!date) {
                    alert('Vui lòng chọn ngày');
                    return;
                }

                try {
                    // Show loading
                    document.getElementById('total-orders').textContent = '...';
                    document.getElementById('staff-needed').textContent = '...';
                    document.getElementById('workforce-gap').textContent = '...';
                    document.getElementById('total-cost').textContent = '...';

                    // Calculate workforce
                    const res = await axios.post('/api/workforce/calculate', {
                        forecast_date: date
                    });

                    if (!res.data.success) {
                        alert('Error: ' + (res.data.error || 'Unknown error'));
                        return;
                    }

                    const data = res.data.recommendation;

                    // Update summary cards
                    document.getElementById('total-orders').textContent = data.total_orders.toLocaleString();
                    document.getElementById('staff-needed').textContent = data.staff_needed.total;
                    document.getElementById('workforce-gap').textContent = data.contractor_needed || 0;
                    document.getElementById('total-cost').textContent = (data.costs.total / 1000000).toFixed(1) + 'M';

                    // Update breakdown table
                    const tbody = document.getElementById('breakdown-body');
                    tbody.innerHTML = \`
                        <tr class="border-b hover:bg-gray-50">
                            <td class="py-3 px-4">
                                <span class="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                                Boxme (Full-time)
                            </td>
                            <td class="text-right py-3 px-4 font-semibold">\${data.staff_needed.boxme}</td>
                            <td class="text-right py-3 px-4">\${data.availability.boxme}</td>
                            <td class="text-right py-3 px-4 font-semibold text-green-600">
                                \${data.availability.boxme - data.staff_needed.boxme}
                            </td>
                        </tr>
                        <tr class="border-b hover:bg-gray-50">
                            <td class="py-3 px-4">
                                <span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                                Dã chiến (Veteran)
                            </td>
                            <td class="text-right py-3 px-4 font-semibold">\${data.staff_needed.veteran}</td>
                            <td class="text-right py-3 px-4">\${data.availability.veteran}</td>
                            <td class="text-right py-3 px-4 font-semibold text-green-600">
                                \${data.availability.veteran - data.staff_needed.veteran}
                            </td>
                        </tr>
                        <tr class="border-b hover:bg-gray-50">
                            <td class="py-3 px-4">
                                <span class="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                                Thời vụ (Seasonal)
                            </td>
                            <td class="text-right py-3 px-4 font-semibold">\${data.staff_needed.seasonal}</td>
                            <td class="text-right py-3 px-4">\${data.availability.seasonal}</td>
                            <td class="text-right py-3 px-4 font-semibold text-green-600">
                                \${data.availability.seasonal - data.staff_needed.seasonal}
                            </td>
                        </tr>
                        <tr class="bg-gray-50 font-bold">
                            <td class="py-3 px-4">TỔNG CỘNG</td>
                            <td class="text-right py-3 px-4">\${data.staff_needed.total}</td>
                            <td class="text-right py-3 px-4">\${data.availability.boxme + data.availability.veteran + data.availability.seasonal}</td>
                            <td class="text-right py-3 px-4 \${data.gap_total > 0 ? 'text-red-600' : 'text-green-600'}">
                                \${-data.gap_total}
                            </td>
                        </tr>
                    \`;

                    // Update work hours
                    document.getElementById('hours-pick').textContent = data.work_hours.pick.toFixed(1);
                    document.getElementById('hours-pack').textContent = data.work_hours.pack.toFixed(1);
                    document.getElementById('hours-moving').textContent = data.work_hours.moving.toFixed(1);
                    document.getElementById('hours-return').textContent = data.work_hours.return.toFixed(1);

                    // Update cost breakdown
                    document.getElementById('cost-regular').textContent = (data.costs.regular / 1000000).toFixed(2) + 'M VND';
                    document.getElementById('cost-bonus').textContent = (data.costs.contractorBonus / 1000000).toFixed(2) + 'M VND';
                    document.getElementById('cost-meals').textContent = (data.costs.meals / 1000000).toFixed(2) + 'M VND';
                    document.getElementById('cost-total-detail').textContent = (data.costs.total / 1000000).toFixed(2) + 'M VND';

                    // Update staff mix chart
                    updateStaffChart(data.staff_needed);

                    // Show alert if needed
                    if (data.alert_level === 'critical') {
                        alert(\`⚠️ CẢNH BÁO: Cần tuyển \${data.contractor_needed} thời vụ! Bắt đầu tuyển dụng ngay.\`);
                    } else if (data.alert_level === 'warning') {
                        alert(\`⚡ Chú ý: Cần tuyển \${data.contractor_needed} thời vụ trong thời gian tới.\`);
                    }

                } catch (error) {
                    console.error('Error:', error);
                    alert('Lỗi khi tính toán: ' + (error.response?.data?.error || error.message));
                }
            }

            function updateStaffChart(staffNeeded) {
                const ctx = document.getElementById('staffMixChart');
                if (!ctx) return;

                if (staffChart) {
                    staffChart.destroy();
                }

                staffChart = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Boxme', 'Dã chiến', 'Thời vụ'],
                        datasets: [{
                            data: [staffNeeded.boxme, staffNeeded.veteran, staffNeeded.seasonal],
                            backgroundColor: [
                                'rgb(59, 130, 246)',
                                'rgb(34, 197, 94)',
                                'rgb(234, 179, 8)'
                            ],
                            borderWidth: 2,
                            borderColor: '#fff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 15,
                                    boxWidth: 12
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return label + ': ' + value + ' người (' + percentage + '%)';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        </script>
    </body>
    </html>
  `);
});

// Settings page - Main navigation
app.get('/settings', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cấu hình Hệ thống - Boxme Forecast</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md hover:bg-blue-700">Dashboard</a>
                        <a href="/customers" class="px-3 py-2 rounded-md hover:bg-blue-700">Customers</a>
                        <a href="/settings" class="px-3 py-2 rounded-md bg-blue-700">Settings</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-8">
                <i class="fas fa-cog mr-3"></i>
                Cấu hình Hệ thống
            </h1>

            <!-- Settings Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Warehouses & Staff -->
                <a href="/settings/warehouses" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition block">
                    <div class="flex items-center mb-4">
                        <div class="bg-blue-100 rounded-full p-3 mr-4">
                            <i class="fas fa-warehouse text-2xl text-blue-600"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">Kho & Nhân sự</h3>
                            <p class="text-sm text-gray-600">Warehouse & Staff</p>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm">
                        Quản lý kho hàng, ca làm việc, và nhân sự
                    </p>
                </a>

                <!-- Productivity Standards -->
                <a href="/settings/productivity" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition block">
                    <div class="flex items-center mb-4">
                        <div class="bg-green-100 rounded-full p-3 mr-4">
                            <i class="fas fa-chart-line text-2xl text-green-600"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">Định mức Năng suất</h3>
                            <p class="text-sm text-gray-600">Productivity Standards</p>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm">
                        Cấu hình năng suất theo level, công việc, sản phẩm
                    </p>
                </a>

                <!-- Carriers -->
                <a href="/settings/carriers" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition block">
                    <div class="flex items-center mb-4">
                        <div class="bg-orange-100 rounded-full p-3 mr-4">
                            <i class="fas fa-truck text-2xl text-orange-600"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">Hãng vận chuyển</h3>
                            <p class="text-sm text-gray-600">Carriers</p>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm">
                        Quản lý ĐVVC, giờ lấy hàng, capacity
                    </p>
                </a>

                <!-- Platform SLA -->
                <a href="/settings/platform-sla" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition block">
                    <div class="flex items-center mb-4">
                        <div class="bg-purple-100 rounded-full p-3 mr-4">
                            <i class="fas fa-clock text-2xl text-purple-600"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">Quy định Sàn (SLA)</h3>
                            <p class="text-sm text-gray-600">Platform SLA</p>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm">
                        Shopee, Lazada, TikTok SLA & quality metrics
                    </p>
                </a>

                <!-- Working Hours -->
                <a href="/settings/shifts" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition block">
                    <div class="flex items-center mb-4">
                        <div class="bg-red-100 rounded-full p-3 mr-4">
                            <i class="fas fa-calendar-alt text-2xl text-red-600"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">Thời gian làm việc</h3>
                            <p class="text-sm text-gray-600">Working Hours</p>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm">
                        Cấu hình ca làm việc (Sáng, Chiều, Đêm)
                    </p>
                </a>

                <!-- Alerts & Notifications -->
                <a href="/settings/alerts-config" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition block">
                    <div class="flex items-center mb-4">
                        <div class="bg-yellow-100 rounded-full p-3 mr-4">
                            <i class="fas fa-bell text-2xl text-yellow-600"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">Cảnh báo & Thông báo</h3>
                            <p class="text-sm text-gray-600">Alerts & Notifications</p>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm">
                        Cấu hình ngưỡng cảnh báo, thông báo
                    </p>
                </a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Settings - Productivity Standards
app.get('/settings/productivity', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Định mức Năng suất - Boxme Forecast</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md hover:bg-blue-700">Dashboard</a>
                        <a href="/settings" class="px-3 py-2 rounded-md bg-blue-700">Settings</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center">
                    <a href="/settings" class="text-gray-600 hover:text-gray-800 mr-4">
                        <i class="fas fa-arrow-left text-xl"></i>
                    </a>
                    <h1 class="text-3xl font-bold text-gray-800">
                        <i class="fas fa-chart-line mr-3"></i>
                        Định mức Năng suất
                    </h1>
                </div>
                <div class="flex gap-2">
                    <button onclick="showCalculateModal()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        <i class="fas fa-calculator mr-2"></i>Auto-calculate
                    </button>
                    <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        <i class="fas fa-download mr-2"></i>Export CSV
                    </button>
                </div>
            </div>

            <!-- Info Card -->
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
                <div class="flex">
                    <i class="fas fa-info-circle text-blue-600 mt-1 mr-3"></i>
                    <div>
                        <p class="font-semibold text-blue-900">Productivity Standards Matrix</p>
                        <p class="text-sm text-blue-800 mt-1">
                            Định mức năng suất theo level nhân viên, công việc, nhóm sản phẩm.
                            Sử dụng Median (P50), P75, P90 để tracking performance.
                            Click "Auto-calculate" để cập nhật từ lịch sử 90 ngày.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-lg shadow p-4 mb-6">
                <div class="flex gap-4">
                    <select id="filter-staff-level" class="border rounded px-4 py-2" onchange="filterStandards()">
                        <option value="">All Staff Levels</option>
                        <option value="BOXME">Boxme (Full-time)</option>
                        <option value="VETERAN">Veteran (Dã chiến)</option>
                        <option value="SEASONAL">Seasonal (Thời vụ)</option>
                        <option value="CONTRACTOR">Contractor</option>
                    </select>
                    <select id="filter-work-type" class="border rounded px-4 py-2" onchange="filterStandards()">
                        <option value="">All Work Types</option>
                        <option value="PICK">Pick (Nhặt hàng)</option>
                        <option value="PACK">Pack (Đóng gói)</option>
                        <option value="MOVING">Moving (Di chuyển)</option>
                        <option value="RETURN">Return (Trả hàng)</option>
                    </select>
                    <select id="filter-product-group" class="border rounded px-4 py-2" onchange="filterStandards()">
                        <option value="">All Product Groups</option>
                        <option value="COSMETICS">Cosmetics</option>
                        <option value="FASHION">Fashion</option>
                        <option value="BABY">Baby Products</option>
                        <option value="ELECTRONICS">Electronics</option>
                    </select>
                </div>
            </div>

            <!-- Productivity Table -->
            <div class="bg-white rounded-lg shadow overflow-x-auto">
                <table class="min-w-full" id="productivity-table">
                    <thead class="bg-gray-50 border-b">
                        <tr>
                            <th class="text-left py-3 px-4 font-semibold text-sm w-32">Staff Level</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm w-28">Work Type</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm w-32">Product Group</th>
                            <th class="text-right py-3 px-4 font-semibold text-sm w-24">Median<br><span class="text-xs font-normal text-gray-500">(P50)</span></th>
                            <th class="text-right py-3 px-4 font-semibold text-sm w-24">Good<br><span class="text-xs font-normal text-gray-500">(P75)</span></th>
                            <th class="text-right py-3 px-4 font-semibold text-sm w-24">Excellent<br><span class="text-xs font-normal text-gray-500">(P90)</span></th>
                            <th class="text-right py-3 px-4 font-semibold text-sm w-20">Min</th>
                            <th class="text-right py-3 px-4 font-semibold text-sm w-20">Max</th>
                            <th class="text-center py-3 px-4 font-semibold text-sm w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="standards-tbody">
                        <tr>
                            <td colspan="9" class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <div>Loading productivity standards...</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Summary Stats -->
            <div class="grid grid-cols-4 gap-4 mt-6">
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Total Standards</div>
                    <div class="text-2xl font-bold text-blue-600" id="stat-total">-</div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Last Updated</div>
                    <div class="text-lg font-bold text-gray-800" id="stat-updated">-</div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Avg Orders/Hour</div>
                    <div class="text-2xl font-bold text-green-600" id="stat-avg">-</div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Sample Size</div>
                    <div class="text-2xl font-bold text-purple-600" id="stat-sample">-</div>
                </div>
            </div>
        </div>

        <!-- Calculate Modal -->
        <div id="calculate-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-xl font-bold mb-4">Auto-calculate from History</h3>
                <p class="text-gray-600 mb-4">
                    Tính toán lại productivity standards từ dữ liệu lịch sử.
                    Hệ thống sẽ phân tích orders history để tính Median, P75, P90.
                </p>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Date Range</label>
                    <select class="w-full border rounded px-3 py-2" id="calc-date-range">
                        <option value="30">Last 30 days</option>
                        <option value="60">Last 60 days</option>
                        <option value="90" selected>Last 90 days</option>
                    </select>
                </div>
                <div class="flex gap-2">
                    <button onclick="closeCalculateModal()" class="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
                        Cancel
                    </button>
                    <button onclick="calculateStandards()" class="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        <i class="fas fa-calculator mr-2"></i>Calculate
                    </button>
                </div>
            </div>
        </div>

        <script>
            let allStandards = [];

            async function loadStandards() {
                try {
                    // Use existing productivity_standards data
                    const res = await axios.get('/api/productivity/standards');
                    allStandards = res.data.standards || [];
                    renderStandards(allStandards);
                    updateStats();
                } catch (error) {
                    console.error('Error loading standards:', error);
                    // If API not ready, load from mock data
                    loadMockStandards();
                }
            }

            function loadMockStandards() {
                // Mock data based on seed data
                allStandards = [
                    { staff_type: 'BOXME', work_type: 'PICK', product_group: 'COSMETICS', orders_per_hour: 45, p75: 55, p90: 65, min: 30, max: 80 },
                    { staff_type: 'BOXME', work_type: 'PACK', product_group: 'COSMETICS', orders_per_hour: 30, p75: 38, p90: 45, min: 20, max: 60 },
                    { staff_type: 'BOXME', work_type: 'PICK', product_group: 'FASHION', orders_per_hour: 40, p75: 50, p90: 60, min: 25, max: 75 },
                    { staff_type: 'BOXME', work_type: 'PACK', product_group: 'FASHION', orders_per_hour: 35, p75: 42, p90: 50, min: 22, max: 65 },
                    { staff_type: 'VETERAN', work_type: 'PICK', product_group: 'COSMETICS', orders_per_hour: 50, p75: 60, p90: 70, min: 35, max: 90 },
                    { staff_type: 'VETERAN', work_type: 'PACK', product_group: 'COSMETICS', orders_per_hour: 35, p75: 43, p90: 50, min: 25, max: 65 },
                    { staff_type: 'SEASONAL', work_type: 'PICK', product_group: 'BABY', orders_per_hour: 35, p75: 42, p90: 48, min: 20, max: 60 },
                    { staff_type: 'SEASONAL', work_type: 'PACK', product_group: 'BABY', orders_per_hour: 25, p75: 30, p90: 35, min: 15, max: 45 },
                ];
                renderStandards(allStandards);
                updateStats();
            }

            function renderStandards(standards) {
                const tbody = document.getElementById('standards-tbody');
                
                if (standards.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-500">No standards found</td></tr>';
                    return;
                }

                tbody.innerHTML = standards.map((std, idx) => \`
                    <tr class="border-b hover:bg-gray-50" data-id="\${idx}">
                        <td class="py-3 px-4">
                            <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                \${std.staff_type}
                            </span>
                        </td>
                        <td class="py-3 px-4 text-sm">\${std.work_type}</td>
                        <td class="py-3 px-4 text-sm">\${std.product_group}</td>
                        <td class="text-right py-3 px-4 font-semibold">\${std.orders_per_hour}/h</td>
                        <td class="text-right py-3 px-4 text-green-600">\${std.p75 || '-'}</td>
                        <td class="text-right py-3 px-4 text-blue-600">\${std.p90 || '-'}</td>
                        <td class="text-right py-3 px-4 text-gray-600 text-sm">\${std.min || '-'}</td>
                        <td class="text-right py-3 px-4 text-gray-600 text-sm">\${std.max || '-'}</td>
                        <td class="text-center py-3 px-4">
                            <button onclick="editStandard(\${idx})" class="text-blue-600 hover:text-blue-800 text-sm">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>
                \`).join('');
            }

            function filterStandards() {
                const staffLevel = document.getElementById('filter-staff-level').value;
                const workType = document.getElementById('filter-work-type').value;
                const productGroup = document.getElementById('filter-product-group').value;

                const filtered = allStandards.filter(std => {
                    return (!staffLevel || std.staff_type === staffLevel) &&
                           (!workType || std.work_type === workType) &&
                           (!productGroup || std.product_group === productGroup);
                });

                renderStandards(filtered);
            }

            function updateStats() {
                document.getElementById('stat-total').textContent = allStandards.length;
                document.getElementById('stat-updated').textContent = 'Today';
                const avgOrders = allStandards.reduce((sum, std) => sum + std.orders_per_hour, 0) / allStandards.length;
                document.getElementById('stat-avg').textContent = Math.round(avgOrders);
                document.getElementById('stat-sample').textContent = '~10K';
            }

            function showCalculateModal() {
                document.getElementById('calculate-modal').classList.remove('hidden');
            }

            function closeCalculateModal() {
                document.getElementById('calculate-modal').classList.add('hidden');
            }

            function calculateStandards() {
                const days = document.getElementById('calc-date-range').value;
                alert(\`Will calculate from last \${days} days. Feature coming soon!\`);
                closeCalculateModal();
            }

            function editStandard(idx) {
                const std = allStandards[idx];
                alert(\`Edit \${std.staff_type} - \${std.work_type} - \${std.product_group}\\nFeature coming soon!\`);
            }

            document.addEventListener('DOMContentLoaded', loadStandards);
        </script>
    </body>
    </html>
  `);
});

// Alerts page
app.get('/alerts', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alerts - Boxme Forecast MVP</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md hover:bg-blue-700">Dashboard</a>
                        <a href="/calendar" class="px-3 py-2 rounded-md hover:bg-blue-700">Calendar</a>
                        <a href="/workforce" class="px-3 py-2 rounded-md hover:bg-blue-700">Workforce</a>
                        <a href="/alerts" class="px-3 py-2 rounded-md bg-blue-700">Alerts</a>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-6">
                <i class="fas fa-exclamation-triangle mr-3"></i>
                Hiring Alerts
            </h1>

            <div class="bg-white rounded-lg shadow p-6" id="alerts-container">
                <div class="text-center py-8">Loading alerts...</div>
            </div>
        </div>

        <script>
            async function loadAlerts() {
                try {
                    const res = await axios.get('/api/alerts');
                    const alerts = res.data.alerts;

                    const container = document.getElementById('alerts-container');
                    
                    if (alerts.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-12">
                                <i class="fas fa-check-circle text-6xl text-green-500 mb-4"></i>
                                <div class="text-xl text-gray-600">No pending alerts</div>
                                <div class="text-sm text-gray-400 mt-2">All workforce needs are covered</div>
                            </div>
                        \`;
                        return;
                    }

                    let html = '<div class="space-y-4">';
                    
                    alerts.forEach(alert => {
                        const levelIcons = {
                            'critical': 'fa-times-circle text-red-600',
                            'warning': 'fa-exclamation-triangle text-yellow-600',
                            'info': 'fa-info-circle text-blue-600'
                        };
                        
                        const levelColors = {
                            'critical': 'bg-red-50 border-red-200 border-l-4 border-l-red-600',
                            'warning': 'bg-yellow-50 border-yellow-200 border-l-4 border-l-yellow-600',
                            'info': 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-600'
                        };

                        const icon = levelIcons[alert.alert_level] || levelIcons.info;
                        const colorClass = levelColors[alert.alert_level] || levelColors.info;

                        html += \`
                            <div class="border rounded-lg p-6 \${colorClass}">
                                <div class="flex items-start justify-between">
                                    <div class="flex items-start space-x-4">
                                        <i class="fas \${icon} text-3xl mt-1"></i>
                                        <div>
                                            <div class="font-bold text-lg mb-1">
                                                \${alert.forecast_date}
                                            </div>
                                            <div class="text-sm text-gray-600 mb-2">
                                                <i class="fas fa-clock mr-2"></i>
                                                In \${alert.days_until_event} days
                                            </div>
                                            <div class="text-base">
                                                <i class="fas fa-users mr-2"></i>
                                                Need to recruit <strong>\${alert.contractors_needed}</strong> contractors
                                            </div>
                                            \${alert.notes ? \`<div class="text-sm text-gray-500 mt-2">\${alert.notes}</div>\` : ''}
                                        </div>
                                    </div>
                                    <div>
                                        <span class="bg-white px-3 py-1 rounded text-xs font-bold uppercase">
                                            \${alert.alert_level}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        \`;
                    });

                    html += '</div>';
                    container.innerHTML = html;
                } catch (error) {
                    console.error('Error loading alerts:', error);
                    document.getElementById('alerts-container').innerHTML = 
                        '<div class="text-center py-8 text-red-500">Error loading alerts</div>';
                }
            }

            document.addEventListener('DOMContentLoaded', loadAlerts);
        </script>
    </body>
    </html>
  `);
});

// Dashboard page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Boxme Forecast MVP</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md bg-blue-700">Dashboard</a>
                        <a href="/calendar" class="px-3 py-2 rounded-md hover:bg-blue-700">Calendar</a>
                        <a href="/workforce" class="px-3 py-2 rounded-md hover:bg-blue-700">Workforce</a>
                        <a href="/alerts" class="px-3 py-2 rounded-md hover:bg-blue-700">Alerts</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- KPI Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm font-medium mb-2">Today's Forecast</div>
                    <div class="text-3xl font-bold text-blue-600" id="kpi-today">-</div>
                    <div class="text-sm text-gray-400 mt-1">orders</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm font-medium mb-2">Next Peak Day</div>
                    <div class="text-3xl font-bold text-red-600" id="kpi-peak-date">-</div>
                    <div class="text-sm text-gray-400 mt-1" id="kpi-peak-name">-</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm font-medium mb-2">Workforce Gap</div>
                    <div class="text-3xl font-bold text-orange-600" id="kpi-gap">-</div>
                    <div class="text-sm text-gray-400 mt-1">contractors needed</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-gray-500 text-sm font-medium mb-2">Forecast Accuracy</div>
                    <div class="text-3xl font-bold text-green-600" id="kpi-accuracy">-</div>
                    <div class="text-sm text-gray-400 mt-1">% accuracy</div>
                </div>
            </div>

            <!-- Chart -->
            <div class="bg-white rounded-lg shadow p-6 mb-8">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-chart-area mr-2"></i>
                        Forecast Overview (Next 7-14 Days)
                    </h2>
                    <button onclick="generateForecast()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        <i class="fas fa-sync mr-2"></i>Generate Forecast
                    </button>
                </div>
                <div style="height: 300px; position: relative;">
                    <canvas id="forecastChart"></canvas>
                </div>
            </div>

            <!-- Recent Alerts -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    Recent Alerts
                </h2>
                <div id="alerts-list">
                    <div class="text-gray-500 text-center py-8">Loading alerts...</div>
                </div>
            </div>
        </div>

        <script>
            let forecastChart = null;

            // Load KPIs
            async function loadKPIs() {
                try {
                    const res = await axios.get('/api/dashboard/kpis');
                    const data = res.data;

                    document.getElementById('kpi-today').textContent = data.todayForecast.toLocaleString();
                    
                    if (data.nextPeakDay) {
                        document.getElementById('kpi-peak-date').textContent = 
                            data.nextPeakDay.date + ' (' + data.nextPeakDay.daysUntil + 'd)';
                        document.getElementById('kpi-peak-name').textContent = data.nextPeakDay.name;
                    }
                    
                    document.getElementById('kpi-gap').textContent = data.workforceGap.toLocaleString();
                    document.getElementById('kpi-accuracy').textContent = data.forecastAccuracy.toFixed(1) + '%';
                } catch (error) {
                    console.error('Error loading KPIs:', error);
                }
            }

            // Load Chart - Simplified version
            async function loadChart() {
                try {
                    const res = await axios.get('/api/forecast/chart?days=7');
                    const chartData = res.data.data || [];

                    if (chartData.length === 0) {
                        document.getElementById('forecastChart').parentElement.innerHTML = 
                            '<div class="text-center py-8 text-gray-500">No data available. Click "Generate Forecast" to create forecasts.</div>';
                        return;
                    }

                    // Limit to 14 days max to prevent lag
                    const limitedData = chartData.slice(0, 14);
                    
                    const labels = limitedData.map(d => {
                        const date = new Date(d.date);
                        return date.getMonth() + 1 + '/' + date.getDate();
                    });
                    
                    const actual = limitedData.map(d => d.actual || null);
                    const forecast = limitedData.map(d => d.forecast || null);

                    const ctx = document.getElementById('forecastChart');
                    if (!ctx) return;
                    
                    // Destroy old chart if exists
                    if (forecastChart) {
                        forecastChart.destroy();
                        forecastChart = null;
                    }

                    forecastChart = new Chart(ctx.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [
                                {
                                    label: 'Actual Orders',
                                    data: actual,
                                    borderColor: 'rgb(59, 130, 246)',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    borderWidth: 2,
                                    tension: 0.1,
                                    spanGaps: true
                                },
                                {
                                    label: 'Forecast',
                                    data: forecast,
                                    borderColor: 'rgb(139, 92, 246)',
                                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                    borderWidth: 2,
                                    borderDash: [5, 5],
                                    tension: 0.1,
                                    spanGaps: true
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            aspectRatio: 2.5,
                            animation: {
                                duration: 500
                            },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: {
                                        boxWidth: 12,
                                        padding: 10
                                    }
                                },
                                tooltip: {
                                    mode: 'index',
                                    intersect: false,
                                    callbacks: {
                                        label: function(context) {
                                            let label = context.dataset.label || '';
                                            if (label) {
                                                label += ': ';
                                            }
                                            if (context.parsed.y !== null) {
                                                label += context.parsed.y.toLocaleString() + ' orders';
                                            }
                                            return label;
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: function(value) {
                                            return (value / 1000).toFixed(0) + 'k';
                                        },
                                        maxTicksLimit: 6
                                    },
                                    grid: {
                                        color: 'rgba(0, 0, 0, 0.05)'
                                    }
                                },
                                x: {
                                    grid: {
                                        display: false
                                    },
                                    ticks: {
                                        maxRotation: 0,
                                        autoSkip: true,
                                        maxTicksLimit: 7
                                    }
                                }
                            },
                            interaction: {
                                mode: 'nearest',
                                axis: 'x',
                                intersect: false
                            }
                        }
                    });
                } catch (error) {
                    console.error('Error loading chart:', error);
                    const container = document.getElementById('forecastChart').parentElement;
                    if (container) {
                        container.innerHTML = '<div class="text-center py-8 text-red-500">Error loading chart. Please try again.</div>';
                    }
                }
            }

            // Load Alerts
            async function loadAlerts() {
                try {
                    const res = await axios.get('/api/alerts');
                    const alerts = res.data.alerts;

                    const alertsList = document.getElementById('alerts-list');
                    
                    if (alerts.length === 0) {
                        alertsList.innerHTML = '<div class="text-gray-500 text-center py-8">No pending alerts</div>';
                        return;
                    }

                    alertsList.innerHTML = alerts.map(alert => {
                        const levelColors = {
                            'critical': 'bg-red-100 text-red-800 border-red-200',
                            'warning': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                            'info': 'bg-blue-100 text-blue-800 border-blue-200'
                        };
                        const colorClass = levelColors[alert.alert_level] || levelColors.info;

                        return \`
                            <div class="border-l-4 \${colorClass} p-4 mb-3">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <div class="font-semibold">\${alert.forecast_date} (in \${alert.days_until_event} days)</div>
                                        <div class="text-sm">Need \${alert.contractors_needed} contractors</div>
                                    </div>
                                    <div class="text-xs uppercase font-bold">\${alert.alert_level}</div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading alerts:', error);
                }
            }

            // Generate Forecast
            async function generateForecast() {
                try {
                    const btn = event.target;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';

                    await axios.post('/api/forecast/generate', { horizon: 30 });

                    await loadKPIs();
                    await loadChart();
                    
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-sync mr-2"></i>Generate Forecast';
                    
                    alert('Forecast generated successfully!');
                } catch (error) {
                    console.error('Error generating forecast:', error);
                    alert('Error generating forecast');
                }
            }

            // Initialize
            document.addEventListener('DOMContentLoaded', async () => {
                await loadKPIs();
                await loadChart();
                await loadAlerts();
            });
        </script>
    </body>
    </html>
  `);
});

// Settings page
app.get('/settings', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Settings - Boxme Forecast MVP</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <nav class="bg-blue-600 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-2xl mr-3"></i>
                        <span class="font-bold text-xl">Boxme Forecast MVP</span>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="px-3 py-2 rounded-md hover:bg-blue-700">Dashboard</a>
                        <a href="/calendar" class="px-3 py-2 rounded-md hover:bg-blue-700">Calendar</a>
                        <a href="/workforce" class="px-3 py-2 rounded-md hover:bg-blue-700">Workforce</a>
                        <a href="/customers" class="px-3 py-2 rounded-md hover:bg-blue-700">Customers</a>
                        <a href="/settings" class="px-3 py-2 rounded-md bg-blue-700">Settings</a>
                        <a href="/alerts" class="px-3 py-2 rounded-md hover:bg-blue-700">Alerts</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="mb-6">
                <h1 class="text-3xl font-bold text-gray-800">
                    <i class="fas fa-cog mr-3"></i>
                    Cấu hình Hệ thống
                </h1>
                <p class="text-gray-600 mt-2">Quản lý cấu hình kho, năng suất, và quy định SLA</p>
            </div>

            <!-- Settings Tabs -->
            <div class="bg-white rounded-lg shadow-md mb-6">
                <div class="border-b border-gray-200">
                    <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                        <button onclick="switchTab('warehouses')" 
                                id="tab-warehouses"
                                class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                            <i class="fas fa-warehouse mr-2"></i>
                            Kho & Nhân sự
                        </button>
                        <button onclick="switchTab('productivity')" 
                                id="tab-productivity"
                                class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                            <i class="fas fa-chart-bar mr-2"></i>
                            Định mức Năng suất
                        </button>
                        <button onclick="switchTab('carriers')" 
                                id="tab-carriers"
                                class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                            <i class="fas fa-truck mr-2"></i>
                            Hãng vận chuyển
                        </button>
                        <button onclick="switchTab('platform-sla')" 
                                id="tab-platform-sla"
                                class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                            <i class="fas fa-tasks mr-2"></i>
                            Quy định Sàn (SLA)
                        </button>
                    </nav>
                </div>

                <!-- Tab Content -->
                <div class="p-6">
                    <!-- Warehouses Tab -->
                    <div id="content-warehouses" class="tab-content">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-semibold text-gray-800">Danh sách Kho</h2>
                            <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                <i class="fas fa-plus mr-2"></i>Thêm Kho
                            </button>
                        </div>
                        <div id="warehouses-list"></div>
                    </div>

                    <!-- Productivity Tab -->
                    <div id="content-productivity" class="tab-content hidden">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-semibold text-gray-800">Định mức Năng suất</h2>
                            <div class="space-x-2">
                                <select id="filter-staff-level" class="border rounded px-3 py-2">
                                    <option value="">All Staff Levels</option>
                                    <option value="BOXME">BOXME</option>
                                    <option value="VETERAN">VETERAN</option>
                                    <option value="SEASONAL">SEASONAL</option>
                                    <option value="CONTRACTOR">CONTRACTOR</option>
                                </select>
                                <select id="filter-work-type" class="border rounded px-3 py-2">
                                    <option value="">All Work Types</option>
                                    <option value="PICK">PICK</option>
                                    <option value="PACK">PACK</option>
                                    <option value="MOVING">MOVING</option>
                                    <option value="RETURN">RETURN</option>
                                    <option value="HANDOVER">HANDOVER</option>
                                </select>
                                <button onclick="loadProductivity()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                    <i class="fas fa-sync mr-2"></i>Refresh
                                </button>
                            </div>
                        </div>
                        <div id="productivity-list" class="overflow-x-auto"></div>
                    </div>

                    <!-- Carriers Tab -->
                    <div id="content-carriers" class="tab-content hidden">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-semibold text-gray-800">Hãng vận chuyển</h2>
                            <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                <i class="fas fa-plus mr-2"></i>Thêm ĐVVC
                            </button>
                        </div>
                        <div id="carriers-list"></div>
                    </div>

                    <!-- Platform SLA Tab -->
                    <div id="content-platform-sla" class="tab-content hidden">
                        <div class="mb-4">
                            <h2 class="text-xl font-semibold text-gray-800 mb-2">Quy định Sàn TMĐT</h2>
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                <div class="flex items-start">
                                    <i class="fas fa-exclamation-triangle text-yellow-600 mt-1 mr-3"></i>
                                    <div>
                                        <h3 class="font-semibold text-yellow-800 mb-2">⚠️ Lưu ý Quan trọng [Cập nhật 2025]</h3>
                                        <ul class="text-sm text-yellow-700 space-y-1">
                                            <li>• <strong>Shopee:</strong> PQR < 20% (Product Quality Rate). Hỏa tốc cắt lúc 21h.</li>
                                            <li>• <strong>Lazada:</strong> FFR >= 75% cho LazMall (Fast Fulfillment Rate).</li>
                                            <li>• <strong>TikTok:</strong> Đơn trước 18h phải giao trước 12h hôm sau.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="platform-sla-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let currentTab = 'warehouses';
            let editingStandardId = null;

            // Switch Tab
            function switchTab(tabName) {
                currentTab = tabName;
                
                // Update tab buttons
                document.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('border-blue-500', 'text-blue-600');
                    btn.classList.add('border-transparent', 'text-gray-500');
                });
                const activeBtn = document.getElementById('tab-' + tabName);
                activeBtn.classList.remove('border-transparent', 'text-gray-500');
                activeBtn.classList.add('border-blue-500', 'text-blue-600');
                
                // Update content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                document.getElementById('content-' + tabName).classList.remove('hidden');
                
                // Load data for tab
                if (tabName === 'warehouses') loadWarehouses();
                else if (tabName === 'productivity') loadProductivity();
                else if (tabName === 'carriers') loadCarriers();
                else if (tabName === 'platform-sla') loadPlatformSLA();
            }

            // Load Warehouses
            async function loadWarehouses() {
                try {
                    const res = await axios.get('/api/settings/warehouses');
                    const warehouses = res.data.warehouses || [];
                    
                    const list = document.getElementById('warehouses-list');
                    
                    if (warehouses.length === 0) {
                        list.innerHTML = '<div class="text-gray-500 text-center py-8">No warehouses configured</div>';
                        return;
                    }
                    
                    list.innerHTML = warehouses.map(wh => \`
                        <div class="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200 hover:border-blue-300 cursor-pointer"
                             onclick="viewWarehouseDetail('\${wh.id}')">
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <div class="flex items-center mb-2">
                                        <span class="font-semibold text-lg text-gray-800">\${wh.name}</span>
                                        <span class="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">\${wh.code}</span>
                                        \${wh.is_active ? '<span class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Active</span>' : ''}
                                    </div>
                                    <div class="text-sm text-gray-600 mb-2">
                                        <i class="fas fa-map-marker-alt mr-1"></i> \${wh.location || 'N/A'}
                                    </div>
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                        <div>
                                            <span class="text-gray-500">Capacity:</span>
                                            <span class="font-medium">\${(wh.max_capacity_per_day || 0).toLocaleString()}/day</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500">Max Staff:</span>
                                            <span class="font-medium">\${wh.max_staff || 0}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500">Packing Stations:</span>
                                            <span class="font-medium">\${wh.packing_stations || 0}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500">Shifts:</span>
                                            <span class="font-medium">\${wh.shifts_count || 0} shifts</span>
                                        </div>
                                    </div>
                                </div>
                                <button onclick="event.stopPropagation(); editWarehouse('\${wh.id}')" 
                                        class="ml-4 text-blue-600 hover:text-blue-800">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error loading warehouses:', error);
                    document.getElementById('warehouses-list').innerHTML = 
                        '<div class="text-red-500 text-center py-8">Error loading warehouses</div>';
                }
            }

            // View Warehouse Detail
            async function viewWarehouseDetail(warehouseId) {
                try {
                    const res = await axios.get(\`/api/settings/warehouses/\${warehouseId}\`);
                    const { warehouse, shifts } = res.data;
                    
                    const shiftsHTML = shifts.map(s => \`
                        <div class="bg-white border rounded p-3 mb-2">
                            <div class="flex justify-between items-center">
                                <div>
                                    <span class="font-medium">\${s.shift_name}</span>
                                    <span class="text-gray-600 ml-2">\${s.start_time} - \${s.end_time}</span>
                                    <span class="text-sm text-gray-500 ml-2">(\${s.duration_hours}h)</span>
                                </div>
                                <div class="text-sm">
                                    <span class="text-gray-600">Capacity: \${s.capacity_percentage}%</span>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                    
                    alert(\`Warehouse Detail: \${warehouse.name}\\n\\nShifts:\\n\${shifts.length} shifts configured\`);
                } catch (error) {
                    console.error('Error:', error);
                }
            }

            function editWarehouse(id) {
                alert('Edit warehouse: ' + id + ' (Coming soon)');
            }

            // Load Productivity Standards
            async function loadProductivity() {
                try {
                    const staffLevel = document.getElementById('filter-staff-level').value;
                    const workType = document.getElementById('filter-work-type').value;
                    
                    let url = '/api/settings/productivity?';
                    if (staffLevel) url += 'staff_level=' + staffLevel + '&';
                    if (workType) url += 'work_type=' + workType;
                    
                    const res = await axios.get(url);
                    const standards = res.data.standards || [];
                    
                    const list = document.getElementById('productivity-list');
                    
                    if (standards.length === 0) {
                        list.innerHTML = '<div class="text-gray-500 text-center py-8">No productivity standards found</div>';
                        return;
                    }
                    
                    list.innerHTML = \`
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Level</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Type</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Orders/h</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">P50</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">P75</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">P90</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Min</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Max</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                \${standards.map(std => \`
                                    <tr class="hover:bg-gray-50" id="row-\${std.id}">
                                        <td class="px-4 py-3 text-sm">
                                            <span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">\${std.staff_level}</span>
                                        </td>
                                        <td class="px-4 py-3 text-sm font-medium text-gray-900">\${std.work_type}</td>
                                        <td class="px-4 py-3 text-sm text-gray-600">\${std.product_group}</td>
                                        <td class="px-4 py-3 text-sm text-center font-semibold">\${std.orders_per_hour}</td>
                                        <td class="px-4 py-3 text-sm text-center">\${std.percentile_50}</td>
                                        <td class="px-4 py-3 text-sm text-center">\${std.percentile_75}</td>
                                        <td class="px-4 py-3 text-sm text-center">\${std.percentile_90}</td>
                                        <td class="px-4 py-3 text-sm text-center text-gray-500">\${std.min_threshold}</td>
                                        <td class="px-4 py-3 text-sm text-center text-gray-500">\${std.max_threshold}</td>
                                        <td class="px-4 py-3 text-sm text-center">
                                            <button onclick="editProductivityStandard('\${std.id}')" 
                                                    class="text-blue-600 hover:text-blue-800">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                } catch (error) {
                    console.error('Error loading productivity standards:', error);
                    document.getElementById('productivity-list').innerHTML = 
                        '<div class="text-red-500 text-center py-8">Error loading productivity standards</div>';
                }
            }

            // Edit Productivity Standard (inline editing)
            function editProductivityStandard(id) {
                alert('Edit productivity standard: ' + id + '\\n(Inline editing coming soon)');
            }

            // Load Carriers
            async function loadCarriers() {
                try {
                    const res = await axios.get('/api/settings/carriers');
                    const carriers = res.data.carriers || [];
                    
                    const list = document.getElementById('carriers-list');
                    
                    if (carriers.length === 0) {
                        list.innerHTML = '<div class="text-gray-500 text-center py-8">No carriers configured</div>';
                        return;
                    }
                    
                    list.innerHTML = \`
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hãng vận chuyển</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pickup Windows</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Capacity</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                \${carriers.map(c => \`
                                    <tr class="hover:bg-gray-50">
                                        <td class="px-4 py-3">
                                            <div class="text-sm font-medium text-gray-900">\${c.carrier_name}</div>
                                            <div class="text-xs text-gray-500">\${c.carrier_code}</div>
                                        </td>
                                        <td class="px-4 py-3 text-sm text-center">\${c.pickup_windows_count || 0} windows</td>
                                        <td class="px-4 py-3 text-sm text-center font-semibold">\${(c.total_capacity || 0).toLocaleString()}</td>
                                        <td class="px-4 py-3 text-sm text-center">
                                            <button onclick="viewCarrierWindows('\${c.carrier_code}')" 
                                                    class="text-blue-600 hover:text-blue-800 mr-2">
                                                <i class="fas fa-clock"></i>
                                            </button>
                                            <button onclick="editCarrier('\${c.carrier_code}')" 
                                                    class="text-blue-600 hover:text-blue-800">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                } catch (error) {
                    console.error('Error loading carriers:', error);
                    document.getElementById('carriers-list').innerHTML = 
                        '<div class="text-red-500 text-center py-8">Error loading carriers</div>';
                }
            }

            async function viewCarrierWindows(carrierCode) {
                try {
                    const res = await axios.get(\`/api/settings/carriers/\${carrierCode}/windows\`);
                    const windows = res.data.windows || [];
                    alert(\`Pickup Windows for \${carrierCode}:\\n\\n\${windows.length} windows configured\`);
                } catch (error) {
                    console.error('Error:', error);
                }
            }

            function editCarrier(code) {
                alert('Edit carrier: ' + code + ' (Coming soon)');
            }

            // Load Platform SLA
            async function loadPlatformSLA() {
                try {
                    const res = await axios.get('/api/platforms');
                    const platforms = res.data.platforms || [];
                    
                    const container = document.getElementById('platform-sla-cards');
                    
                    if (platforms.length === 0) {
                        container.innerHTML = '<div class="text-gray-500 text-center py-8 col-span-3">No platform SLA configured</div>';
                        return;
                    }
                    
                    container.innerHTML = platforms.map(p => \`
                        <div class="bg-white border-2 border-\${getPlatformColor(p.platform_code)}-300 rounded-lg p-4 hover:shadow-md cursor-pointer"
                             onclick="viewPlatformDetail('\${p.id}')">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="font-semibold text-lg text-gray-800">\${p.platform_name}</h3>
                                <span class="px-2 py-1 text-xs bg-\${getPlatformColor(p.platform_code)}-100 text-\${getPlatformColor(p.platform_code)}-800 rounded font-medium">
                                    \${p.platform_code}
                                </span>
                            </div>
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Service Tiers:</span>
                                    <span class="font-medium">\${p.tiers_count || 0}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Quality Metrics:</span>
                                    <span class="font-medium">\${p.quality_metrics_count || 0}</span>
                                </div>
                            </div>
                            <div class="mt-3 pt-3 border-t">
                                <button onclick="event.stopPropagation(); editPlatform('\${p.id}')" 
                                        class="text-blue-600 hover:text-blue-800 text-sm">
                                    <i class="fas fa-edit mr-1"></i>Edit SLA Rules
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error loading platform SLA:', error);
                    document.getElementById('platform-sla-cards').innerHTML = 
                        '<div class="text-red-500 text-center py-8 col-span-3">Error loading platform SLA</div>';
                }
            }

            function getPlatformColor(code) {
                const colors = {
                    'SHOPEE': 'orange',
                    'LAZADA': 'blue',
                    'TIKTOK': 'purple'
                };
                return colors[code] || 'gray';
            }

            async function viewPlatformDetail(platformId) {
                alert('View platform detail: ' + platformId + ' (Coming soon)');
            }

            function editPlatform(id) {
                alert('Edit platform: ' + id + ' (Coming soon)');
            }

            // Initialize
            document.addEventListener('DOMContentLoaded', () => {
                switchTab('warehouses');
            });
        </script>
    </body>
    </html>
  `);
});

export default app;
