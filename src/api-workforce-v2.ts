/**
 * WORKFORCE CALCULATION v2.0 API ENDPOINT
 * 
 * Handles POST /api/workforce/calculate/v2
 * 
 * @module api-workforce-v2
 */

import { Context } from 'hono';
import {
  WorkforceCalculationInput,
  WorkforceCalculationResult,
  CustomerConfig,
  MethodBreakdown,
  CustomerBreakdown,
  PriorityBucket,
  CostAnalysis,
  calculateWorkHours,
  distributeWorkHours,
  calculateStaffNeeded,
  determineAlertLevel,
  calculateCosts,
  routeAllOrders,
  allocateStaff,
  PACKING_METHOD_EFFICIENCY,
  STAFF_COST_PER_HOUR,
  DEFAULT_PRODUCTIVITY
} from './workforce-v2';

import { generateAllRecommendations } from './workforce-recommendations';

type Bindings = {
  DB: D1Database;
};

/**
 * Fetch customer configurations from database
 */
async function fetchCustomerConfigs(DB: D1Database): Promise<CustomerConfig[]> {
  const customers: CustomerConfig[] = [];

  // Get all active customers
  const customersResult = await DB.prepare(`
    SELECT c.*, co.*
    FROM customers c
    LEFT JOIN customer_operations co ON c.id = co.customer_id
    WHERE c.is_active = 1
  `).all();

  if (!customersResult.results) {
    return customers;
  }

  for (const row of customersResult.results) {
    // Get product mix for customer
    const productMixResult = await DB.prepare(`
      SELECT category_code, category_name, percentage, avg_processing_minutes
      FROM customer_product_mix
      WHERE customer_id = ?
    `)
      .bind(row.id)
      .all();

    // Parse JSON fields
    const heroSkus = row.field_table_hero_skus
      ? JSON.parse(row.field_table_hero_skus as string)
      : [];
    const prepackCategories = row.prepack_categories
      ? JSON.parse(row.prepack_categories as string)
      : [];

    customers.push({
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      tier: (row.tier as string) || 'STANDARD',
      operations: {
        field_table_enabled: Boolean(row.field_table_enabled),
        field_table_max_sku: (row.field_table_max_sku as number) || 1,
        field_table_max_items: (row.field_table_max_items as number) || 5,
        field_table_max_weight: (row.field_table_max_weight as number) || 1.0,
        field_table_hero_skus: heroSkus,
        prepack_enabled: Boolean(row.prepack_enabled),
        prepack_categories: prepackCategories,
        prepack_min_weight: (row.prepack_min_weight as number) || 5.0,
        prepack_weekly_quota: (row.prepack_weekly_quota as number) || 0,
        requires_camera: Boolean(row.requires_camera),
        quality_check_level: (row.quality_check_level as string) || 'STANDARD'
      },
      product_mix:
        productMixResult.results?.map((pm: any) => ({
          category_code: pm.category_code as string,
          category_name: pm.category_name as string,
          percentage: pm.percentage as number,
          avg_processing_minutes: (pm.avg_processing_minutes as number) || 2.5
        })) || []
    });
  }

  return customers;
}

/**
 * Fetch staff availability from database (or use defaults)
 */
async function fetchStaffAvailability(
  DB: D1Database,
  date: string
): Promise<{ boxme: number; seasonal: number; veteran: number }> {
  // TODO: Query actual staff roster when available
  // For now, return hardcoded availability
  return {
    boxme: 150,
    seasonal: 50,
    veteran: 30
  };
}

/**
 * Calculate cost analysis by method and staff type
 */
function calculateCostAnalysis(
  methodBreakdown: MethodBreakdown[],
  staffBreakdown: any,
  totalHours: number
): CostAnalysis {
  const costAnalysis: CostAnalysis = {
    by_method: {
      FIELD_TABLE: { hours: 0, staff: 0, cost: 0 },
      PREPACK: { hours: 0, staff: 0, cost: 0 },
      STANDARD: { hours: 0, staff: 0, cost: 0 }
    },
    by_staff_type: {
      boxme: {
        count: staffBreakdown.boxme.needed,
        cost_per_hour: STAFF_COST_PER_HOUR.boxme,
        total: staffBreakdown.boxme.needed * 8 * STAFF_COST_PER_HOUR.boxme
      },
      seasonal: {
        count: staffBreakdown.seasonal.needed,
        cost_per_hour: STAFF_COST_PER_HOUR.seasonal,
        total: staffBreakdown.seasonal.needed * 8 * STAFF_COST_PER_HOUR.seasonal
      },
      veteran: {
        count: staffBreakdown.veteran.needed,
        cost_per_hour: STAFF_COST_PER_HOUR.veteran,
        total: staffBreakdown.veteran.needed * 8 * STAFF_COST_PER_HOUR.veteran
      },
      contractor: {
        count: staffBreakdown.contractor_needed,
        cost_per_hour: STAFF_COST_PER_HOUR.contractor,
        total: staffBreakdown.contractor_needed * 8 * STAFF_COST_PER_HOUR.contractor
      }
    },
    total_cost: 0,
    savings_potential: {
      field_table_boost: 0,
      prepack_boost: 0,
      total: 0
    }
  };

  // Calculate costs by method
  for (const method of methodBreakdown) {
    const avgCost = (STAFF_COST_PER_HOUR.boxme + STAFF_COST_PER_HOUR.seasonal) / 2;
    const cost = Math.round(method.hours * avgCost);

    costAnalysis.by_method[method.method] = {
      hours: method.hours,
      staff: method.staff,
      cost
    };
  }

  // Calculate total cost
  costAnalysis.total_cost =
    costAnalysis.by_staff_type.boxme.total +
    costAnalysis.by_staff_type.seasonal.total +
    costAnalysis.by_staff_type.veteran.total +
    costAnalysis.by_staff_type.contractor.total;

  // Calculate savings potential (if all standard orders could use Field Table)
  const standardBreakdown = methodBreakdown.find((m) => m.method === 'STANDARD');
  if (standardBreakdown) {
    const standardHours = standardBreakdown.hours;
    const potentialFieldTableHours = standardHours * PACKING_METHOD_EFFICIENCY.FIELD_TABLE;
    const hoursSaved = standardHours - potentialFieldTableHours;
    costAnalysis.savings_potential.field_table_boost = Math.round(
      hoursSaved * (STAFF_COST_PER_HOUR.boxme / 8)
    );

    const potentialPrepackHours = standardHours * PACKING_METHOD_EFFICIENCY.PREPACK;
    const prepackHoursSaved = standardHours - potentialPrepackHours;
    costAnalysis.savings_potential.prepack_boost = Math.round(
      prepackHoursSaved * (STAFF_COST_PER_HOUR.boxme / 8)
    );

    costAnalysis.savings_potential.total =
      costAnalysis.savings_potential.field_table_boost +
      costAnalysis.savings_potential.prepack_boost;
  }

  return costAnalysis;
}

/**
 * Main workforce calculation v2 handler
 */
export async function workforceCalculateV2(
  c: Context<{ Bindings: Bindings }>
): Promise<Response> {
  const { DB } = c.env;

  try {
    const input: WorkforceCalculationInput = await c.req.json();
    const {
      forecast_date,
      forecast_orders,
      customer_breakdown = true,
      priority_analysis = false,
      include_recommendations = true
    } = input;

    if (!forecast_date) {
      return c.json({ error: 'forecast_date is required' }, 400);
    }

    // Step 1: Get forecast orders
    let totalOrders = forecast_orders;

    if (!totalOrders) {
      const forecast = await DB.prepare(
        'SELECT final_forecast FROM daily_forecasts WHERE forecast_date = ?'
      )
        .bind(forecast_date)
        .first<{ final_forecast: number }>();

      if (!forecast || !forecast.final_forecast) {
        return c.json(
          {
            error: `No forecast found for date ${forecast_date}. Please generate forecast first.`
          },
          404
        );
      }

      totalOrders = forecast.final_forecast;
    }

    // Step 2: Fetch customer configurations
    const customers = await fetchCustomerConfigs(DB);

    if (customers.length === 0) {
      return c.json(
        { error: 'No customer configurations found. Please seed customer data.' },
        500
      );
    }

    // Step 3: Route orders by method
    const methodBreakdown = await routeAllOrders(totalOrders, customers);

    // Calculate total hours
    const totalHours = methodBreakdown.reduce((sum, m) => sum + m.hours, 0);
    const totalStaffNeeded = calculateStaffNeeded(totalHours);

    // Step 4: Fetch staff availability
    const availability = await fetchStaffAvailability(DB, forecast_date);

    // Step 5: Allocate staff
    const staffBreakdown = allocateStaff(totalStaffNeeded, availability);

    // Step 6: Calculate work hours distribution
    const workHours = distributeWorkHours(totalHours);

    // Step 7: Calculate costs
    const costBreakdown = calculateCosts(staffBreakdown, totalHours);
    const costAnalysis = calculateCostAnalysis(methodBreakdown, staffBreakdown, totalHours);

    // Step 8: Determine alert level
    const alertLevel = determineAlertLevel(
      staffBreakdown.contractor_needed,
      staffBreakdown.total_gap
    );

    // Step 9: Generate recommendations
    const recommendations = include_recommendations
      ? generateAllRecommendations(
          customers,
          methodBreakdown,
          staffBreakdown,
          costAnalysis,
          forecast_date
        )
      : [];

    // Step 10: Build response
    const result: WorkforceCalculationResult = {
      success: true,
      forecast_date,
      summary: {
        total_orders: totalOrders,
        total_hours: Math.round(totalHours * 100) / 100,
        total_staff: totalStaffNeeded,
        total_cost: costBreakdown.total,
        alert_level: alertLevel,
        contractor_needed: staffBreakdown.contractor_needed
      },
      breakdown_by_method: methodBreakdown,
      staff_allocation: staffBreakdown,
      work_hours: workHours,
      cost_analysis: costAnalysis,
      recommendations
    };

    // Optional: Add customer breakdown
    if (customer_breakdown) {
      result.breakdown_by_customer = customers.map((customer) => ({
        customer_id: customer.id,
        customer_name: customer.name,
        orders: Math.floor(totalOrders / customers.length), // Simplified
        methods: {
          field_table: customer.operations.field_table_enabled
            ? Math.floor(totalOrders / customers.length / 3)
            : 0,
          prepack: customer.operations.prepack_enabled
            ? Math.floor(totalOrders / customers.length / 4)
            : 0,
          standard: Math.floor(totalOrders / customers.length / 2)
        },
        hours: Math.round((totalHours / customers.length) * 100) / 100,
        staff: Math.ceil(totalStaffNeeded / customers.length),
        cost: Math.round(costBreakdown.total / customers.length)
      }));
    }

    // Optional: Add priority analysis
    if (priority_analysis) {
      // TODO: Implement priority-based breakdown
      result.breakdown_by_priority = [];
    }

    return c.json(result);
  } catch (error) {
    console.error('Error in workforce calculation v2:', error);
    return c.json(
      {
        error: 'Failed to calculate workforce',
        details: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
}

export default workforceCalculateV2;
