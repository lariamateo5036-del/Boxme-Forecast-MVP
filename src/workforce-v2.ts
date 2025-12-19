/**
 * WORKFORCE CALCULATION v2.0
 * 
 * Multi-dimensional workforce planning with:
 * - Order routing (Field Table, Pre-pack, Standard)
 * - Customer-specific productivity
 * - Priority-based staff allocation
 * - Smart recommendations & cost analysis
 * 
 * @module workforce-v2
 * @version 2.0.0
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export type PackingMethod = 'FIELD_TABLE' | 'PREPACK' | 'STANDARD';
export type StaffType = 'boxme' | 'seasonal' | 'veteran' | 'contractor';
export type AlertLevel = 'ok' | 'warning' | 'critical';
export type Priority = 1 | 2 | 3 | 4 | 5 | 6;

// ============================================
// INTERFACES
// ============================================

export interface CustomerConfig {
  id: string;
  code: string;
  name: string;
  tier: string;
  operations: {
    field_table_enabled: boolean;
    field_table_max_sku: number;
    field_table_max_items: number;
    field_table_max_weight: number;
    field_table_hero_skus: string[];
    prepack_enabled: boolean;
    prepack_categories: string[];
    prepack_min_weight: number;
    prepack_weekly_quota: number;
    requires_camera: boolean;
    quality_check_level: string;
  };
  product_mix: Array<{
    category_code: string;
    category_name: string;
    percentage: number;
    avg_processing_minutes: number;
  }>;
}

export interface OrderRoutingInput {
  order_count: number;
  customer_id: string;
  category_code?: string;
  sku_count?: number;
  item_count?: number;
  weight_kg?: number;
  is_hero_sku?: boolean;
}

export interface RoutingDecision {
  method: PackingMethod;
  orders: number;
  reason: string;
  eligible: boolean;
  time_saved_percentage?: number;
}

export interface ProductivityRate {
  category_code: string;
  packing_method: PackingMethod;
  staff_type: StaffType;
  avg_processing_minutes: number;
  efficiency_rate: number; // 0.8 - 1.2
}

export interface WorkHoursBreakdown {
  pick: number;
  pack: number;
  moving: number;
  return: number;
  total: number;
}

export interface StaffAllocation {
  needed: number;
  available: number;
  gap: number;
}

export interface StaffBreakdown {
  boxme: StaffAllocation;
  seasonal: StaffAllocation;
  veteran: StaffAllocation;
  total_needed: number;
  total_available: number;
  total_gap: number;
  contractor_needed: number;
}

export interface PriorityBucket {
  priority: Priority;
  name: string;
  description: string;
  cutoff_time?: string;
  orders: number;
  hours: number;
  staff_needed: number;
  staff_allocated: {
    boxme: number;
    seasonal: number;
    veteran: number;
  };
}

export interface CostBreakdown {
  regular_staff: number;
  contractor_bonus: number;
  meals: number;
  total: number;
}

export interface CostAnalysis {
  by_method: {
    [key in PackingMethod]: {
      hours: number;
      staff: number;
      cost: number;
    };
  };
  by_staff_type: {
    [key in StaffType]: {
      count: number;
      cost_per_hour: number;
      total: number;
    };
  };
  total_cost: number;
  savings_potential: {
    field_table_boost: number;
    prepack_boost: number;
    total: number;
  };
}

export interface Recommendation {
  type: 'OPTIMIZATION' | 'ALERT' | 'INSIGHT';
  category: 'FIELD_TABLE' | 'PREPACK' | 'STAFF' | 'COST' | 'PRIORITY';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  impact?: {
    orders_affected?: number;
    time_saved_hours?: number;
    cost_saved_vnd?: number;
    gap_total?: number;
    orders_at_risk?: number;
  };
  action?: string;
}

export interface MethodBreakdown {
  method: PackingMethod;
  orders: number;
  hours: number;
  staff: number;
  cost: number;
  percentage: number;
}

export interface CustomerBreakdown {
  customer_id: string;
  customer_name: string;
  orders: number;
  methods: {
    field_table: number;
    prepack: number;
    standard: number;
  };
  hours: number;
  staff: number;
  cost: number;
}

export interface WorkforceCalculationInput {
  forecast_date: string;
  forecast_orders?: number; // If not provided, fetch from daily_forecasts
  customer_breakdown?: boolean;
  priority_analysis?: boolean;
  include_recommendations?: boolean;
}

export interface WorkforceCalculationResult {
  success: boolean;
  forecast_date: string;
  summary: {
    total_orders: number;
    total_hours: number;
    total_staff: number;
    total_cost: number;
    alert_level: AlertLevel;
    contractor_needed: number;
  };
  breakdown_by_method: MethodBreakdown[];
  breakdown_by_customer?: CustomerBreakdown[];
  breakdown_by_priority?: PriorityBucket[];
  staff_allocation: StaffBreakdown;
  work_hours: WorkHoursBreakdown;
  cost_analysis: CostAnalysis;
  recommendations: Recommendation[];
}

// ============================================
// CONSTANTS
// ============================================

export const PACKING_METHOD_EFFICIENCY = {
  FIELD_TABLE: 0.30, // 70% faster = 30% of standard time
  PREPACK: 0.50,     // 50% time saved = 50% of standard time
  STANDARD: 1.00     // Baseline
} as const;

export const STAFF_COST_PER_HOUR = {
  boxme: 25000,      // VND/hour
  seasonal: 20000,
  veteran: 24000,
  contractor: 22000
} as const;

export const CONTRACTOR_COSTS = {
  bonus_per_person: 50000,  // VND
  meal_per_person: 30000    // VND
} as const;

export const WORK_TYPE_DISTRIBUTION = {
  pick: 0.70,    // 70% of total hours
  pack: 0.20,    // 20%
  moving: 0.05,  // 5%
  return: 0.05   // 5%
} as const;

export const STAFF_TYPE_DISTRIBUTION = {
  boxme: 0.70,     // 70% of total staff
  veteran: 0.20,   // 20%
  seasonal: 0.10   // 10%
} as const;

export const DEFAULT_PRODUCTIVITY = {
  avg_orders_per_hour: 30,
  avg_processing_minutes: 2.0
} as const;

export const ALERT_THRESHOLDS = {
  contractor_warning: 50,
  contractor_critical: 100,
  gap_warning: 30,
  gap_critical: 60
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate total work hours needed for given orders
 */
export function calculateWorkHours(
  orders: number,
  avgProcessingMinutes: number,
  efficiency: number = 1.0
): number {
  const baseHours = (orders * avgProcessingMinutes) / 60;
  const adjustedHours = baseHours * efficiency;
  const withBuffer = adjustedHours * 1.15; // 15% buffer for breaks, delays
  return Math.round(adjustedHours * 100) / 100;
}

/**
 * Distribute work hours by work type (pick, pack, moving, return)
 */
export function distributeWorkHours(totalHours: number): WorkHoursBreakdown {
  return {
    pick: Math.round(totalHours * WORK_TYPE_DISTRIBUTION.pick * 100) / 100,
    pack: Math.round(totalHours * WORK_TYPE_DISTRIBUTION.pack * 100) / 100,
    moving: Math.round(totalHours * WORK_TYPE_DISTRIBUTION.moving * 100) / 100,
    return: Math.round(totalHours * WORK_TYPE_DISTRIBUTION.return * 100) / 100,
    total: totalHours
  };
}

/**
 * Calculate staff needed based on work hours (8-hour shifts)
 */
export function calculateStaffNeeded(hours: number, shiftHours: number = 8): number {
  return Math.ceil(hours / shiftHours);
}

/**
 * Determine alert level based on contractor needs and gaps
 */
export function determineAlertLevel(
  contractorNeeded: number,
  gapTotal: number
): AlertLevel {
  if (
    contractorNeeded >= ALERT_THRESHOLDS.contractor_critical ||
    gapTotal >= ALERT_THRESHOLDS.gap_critical
  ) {
    return 'critical';
  }
  if (
    contractorNeeded >= ALERT_THRESHOLDS.contractor_warning ||
    gapTotal >= ALERT_THRESHOLDS.gap_warning
  ) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Calculate costs for staff allocation
 */
export function calculateCosts(
  staffBreakdown: StaffBreakdown,
  totalHours: number
): CostBreakdown {
  const regularStaffCost = Math.round(
    staffBreakdown.boxme.needed * 8 * STAFF_COST_PER_HOUR.boxme +
    staffBreakdown.seasonal.needed * 8 * STAFF_COST_PER_HOUR.seasonal +
    staffBreakdown.veteran.needed * 8 * STAFF_COST_PER_HOUR.veteran
  );

  const contractorBonus = Math.round(
    staffBreakdown.contractor_needed * CONTRACTOR_COSTS.bonus_per_person
  );

  const mealCost = Math.round(
    staffBreakdown.contractor_needed * CONTRACTOR_COSTS.meal_per_person
  );

  const total = regularStaffCost + contractorBonus + mealCost;

  return {
    regular_staff: regularStaffCost,
    contractor_bonus: contractorBonus,
    meals: mealCost,
    total
  };
}

/**
 * Format number as Vietnamese currency
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

// ============================================
// ORDER ROUTING LOGIC
// ============================================

/**
 * Determine packing method for orders based on customer config
 */
export function routeOrders(
  input: OrderRoutingInput,
  customerConfig: CustomerConfig
): RoutingDecision {
  const { operations } = customerConfig;
  const {
    order_count,
    sku_count = 1,
    item_count = 1,
    weight_kg = 0.5,
    is_hero_sku = false,
    category_code
  } = input;

  // Check Field Table eligibility
  if (operations.field_table_enabled) {
    const isEligible =
      sku_count <= operations.field_table_max_sku &&
      item_count <= operations.field_table_max_items &&
      weight_kg <= operations.field_table_max_weight &&
      (operations.field_table_hero_skus.length === 0 || is_hero_sku);

    if (isEligible) {
      return {
        method: 'FIELD_TABLE',
        orders: order_count,
        reason: 'Eligible for Field Table: Single SKU, lightweight, simple',
        eligible: true,
        time_saved_percentage: 70
      };
    }
  }

  // Check Pre-pack eligibility
  if (operations.prepack_enabled && category_code) {
    const isEligible =
      operations.prepack_categories.includes(category_code) &&
      weight_kg >= operations.prepack_min_weight;

    if (isEligible) {
      return {
        method: 'PREPACK',
        orders: order_count,
        reason: `Eligible for Pre-pack: ${category_code} category, heavy item`,
        eligible: true,
        time_saved_percentage: 50
      };
    }
  }

  // Default to Standard
  return {
    method: 'STANDARD',
    orders: order_count,
    reason: 'Standard processing required',
    eligible: true,
    time_saved_percentage: 0
  };
}

/**
 * Route all orders for a forecast date based on customer mix
 */
export async function routeAllOrders(
  totalOrders: number,
  customers: CustomerConfig[]
): Promise<MethodBreakdown[]> {
  const methodTotals: Record<PackingMethod, { orders: number; hours: number }> = {
    FIELD_TABLE: { orders: 0, hours: 0 },
    PREPACK: { orders: 0, hours: 0 },
    STANDARD: { orders: 0, hours: 0 }
  };

  // Handle case with no customers - use default standard processing
  if (customers.length === 0) {
    const hours = calculateWorkHours(
      totalOrders,
      DEFAULT_PRODUCTIVITY.avg_processing_minutes,
      PACKING_METHOD_EFFICIENCY.STANDARD
    );
    
    return [
      {
        method: 'STANDARD',
        orders: totalOrders,
        hours: Math.round(hours * 100) / 100,
        staff: calculateStaffNeeded(hours),
        cost: 0,
        percentage: 100
      }
    ];
  }

  // Distribute orders across customers (simplified - equal distribution)
  const ordersPerCustomer = Math.floor(totalOrders / customers.length);

  for (const customer of customers) {
    let customerOrders = ordersPerCustomer;

    // Fallback: If customer has no product mix, use default
    let productMix = customer.product_mix;
    if (productMix.length === 0) {
      productMix = [
        {
          category_code: 'GENERAL',
          category_name: 'General Products',
          percentage: 100,
          avg_processing_minutes: DEFAULT_PRODUCTIVITY.avg_processing_minutes
        }
      ];
    }

    // Route by product mix
    for (const product of productMix) {
      const productOrders = Math.floor(customerOrders * (product.percentage / 100));

      // Determine routing
      const routing = routeOrders(
        {
          order_count: productOrders,
          customer_id: customer.id,
          category_code: product.category_code,
          sku_count: 1, // Simplified assumption
          item_count: 1,
          weight_kg: 0.5
        },
        customer
      );

      // Calculate hours based on method efficiency
      const efficiency = PACKING_METHOD_EFFICIENCY[routing.method];
      const hours = calculateWorkHours(
        productOrders,
        product.avg_processing_minutes,
        efficiency
      );

      methodTotals[routing.method].orders += productOrders;
      methodTotals[routing.method].hours += hours;
    }
  }

  // Convert to breakdown format
  const breakdown: MethodBreakdown[] = [];
  let totalHours = 0;

  for (const [method, data] of Object.entries(methodTotals)) {
    if (data.orders > 0) {
      totalHours += data.hours;
      breakdown.push({
        method: method as PackingMethod,
        orders: data.orders,
        hours: Math.round(data.hours * 100) / 100,
        staff: calculateStaffNeeded(data.hours),
        cost: 0, // Will be calculated later
        percentage: 0 // Will be calculated later
      });
    }
  }

  // Calculate percentages
  breakdown.forEach((item) => {
    item.percentage = Math.round((item.orders / totalOrders) * 100 * 10) / 10;
  });

  return breakdown;
}

// ============================================
// STAFF ALLOCATION LOGIC
// ============================================

/**
 * Allocate staff based on total needs and availability
 */
export function allocateStaff(
  totalStaffNeeded: number,
  availability: { boxme: number; seasonal: number; veteran: number }
): StaffBreakdown {
  // Calculate needed by type based on distribution
  const neededBoxme = Math.ceil(totalStaffNeeded * STAFF_TYPE_DISTRIBUTION.boxme);
  const neededVeteran = Math.ceil(totalStaffNeeded * STAFF_TYPE_DISTRIBUTION.veteran);
  const neededSeasonal = Math.ceil(totalStaffNeeded * STAFF_TYPE_DISTRIBUTION.seasonal);

  // Calculate gaps
  const gapBoxme = Math.max(0, neededBoxme - availability.boxme);
  const gapSeasonal = Math.max(0, neededSeasonal - availability.seasonal);
  const gapVeteran = Math.max(0, neededVeteran - availability.veteran);
  const totalGap = gapBoxme + gapSeasonal + gapVeteran;

  // Contractor needed (with 20% buffer)
  const contractorNeeded = Math.ceil(totalGap * 1.2);

  return {
    boxme: {
      needed: neededBoxme,
      available: availability.boxme,
      gap: gapBoxme
    },
    seasonal: {
      needed: neededSeasonal,
      available: availability.seasonal,
      gap: gapSeasonal
    },
    veteran: {
      needed: neededVeteran,
      available: availability.veteran,
      gap: gapVeteran
    },
    total_needed: totalStaffNeeded,
    total_available: availability.boxme + availability.seasonal + availability.veteran,
    total_gap: totalGap,
    contractor_needed: contractorNeeded
  };
}

// ============================================
// PRIORITY-BASED ALLOCATION
// ============================================

/**
 * Allocate orders and staff by priority buckets (P1-P6)
 */
export async function allocateByPriority(
  totalOrders: number,
  totalHours: number,
  totalStaff: number,
  staffBreakdown: StaffBreakdown,
  priorityDistribution?: Record<Priority, number> // Percentage by priority
): Promise<PriorityBucket[]> {
  // Default distribution if not provided (based on typical e-commerce)
  const defaultDistribution: Record<Priority, number> = {
    1: 10,  // P1 - Instant (Mall same-day < 4h) - 10%
    2: 20,  // P2 - Same Day (6pm cutoff) - 20%
    3: 35,  // P3 - Next Day - 35%
    4: 20,  // P4 - Standard (2-3 days) - 20%
    5: 10,  // P5 - Economy (3-5 days) - 10%
    6: 5    // P6 - Delayed (can delay) - 5%
  };

  const distribution = priorityDistribution || defaultDistribution;

  const priorityBuckets: PriorityBucket[] = [];

  // Priority bucket definitions
  const bucketDefinitions = [
    { priority: 1 as Priority, name: 'P1 - Instant', description: 'Mall same-day < 4h', cutoff_time: '08:00' },
    { priority: 2 as Priority, name: 'P2 - Same Day', description: 'Standard same-day', cutoff_time: '18:00' },
    { priority: 3 as Priority, name: 'P3 - Next Day', description: 'Next-day delivery', cutoff_time: '21:00' },
    { priority: 4 as Priority, name: 'P4 - Standard', description: '2-3 day delivery', cutoff_time: undefined },
    { priority: 5 as Priority, name: 'P5 - Economy', description: '3-5 day delivery', cutoff_time: undefined },
    { priority: 6 as Priority, name: 'P6 - Delayed', description: 'Can delay if needed', cutoff_time: undefined }
  ];

  let remainingBoxme = staffBreakdown.boxme.available;
  let remainingVeteran = staffBreakdown.veteran.available;
  let remainingSeasonal = staffBreakdown.seasonal.available;

  for (const bucket of bucketDefinitions) {
    const percentage = distribution[bucket.priority] || 0;
    const orders = Math.floor(totalOrders * (percentage / 100));
    const hours = Math.round((totalHours * (percentage / 100)) * 100) / 100;
    const staffNeeded = calculateStaffNeeded(hours);

    // Allocate staff by priority (higher priority gets better staff)
    let allocatedBoxme = 0;
    let allocatedVeteran = 0;
    let allocatedSeasonal = 0;

    if (bucket.priority <= 2) {
      // P1-P2: Prioritize Boxme + Veterans
      const targetBoxme = Math.ceil(staffNeeded * 0.6);
      const targetVeteran = Math.ceil(staffNeeded * 0.3);
      const targetSeasonal = Math.ceil(staffNeeded * 0.1);

      allocatedBoxme = Math.min(targetBoxme, remainingBoxme);
      allocatedVeteran = Math.min(targetVeteran, remainingVeteran);
      allocatedSeasonal = Math.min(targetSeasonal, remainingSeasonal);
    } else if (bucket.priority <= 4) {
      // P3-P4: Balanced mix
      const targetBoxme = Math.ceil(staffNeeded * 0.5);
      const targetVeteran = Math.ceil(staffNeeded * 0.2);
      const targetSeasonal = Math.ceil(staffNeeded * 0.3);

      allocatedBoxme = Math.min(targetBoxme, remainingBoxme);
      allocatedVeteran = Math.min(targetVeteran, remainingVeteran);
      allocatedSeasonal = Math.min(targetSeasonal, remainingSeasonal);
    } else {
      // P5-P6: Seasonal + remaining staff
      const targetBoxme = Math.ceil(staffNeeded * 0.3);
      const targetVeteran = Math.ceil(staffNeeded * 0.1);
      const targetSeasonal = Math.ceil(staffNeeded * 0.6);

      allocatedBoxme = Math.min(targetBoxme, remainingBoxme);
      allocatedVeteran = Math.min(targetVeteran, remainingVeteran);
      allocatedSeasonal = Math.min(targetSeasonal, remainingSeasonal);
    }

    // Deduct allocated staff
    remainingBoxme -= allocatedBoxme;
    remainingVeteran -= allocatedVeteran;
    remainingSeasonal -= allocatedSeasonal;

    priorityBuckets.push({
      priority: bucket.priority,
      name: bucket.name,
      description: bucket.description,
      cutoff_time: bucket.cutoff_time,
      orders,
      hours,
      staff_needed: staffNeeded,
      staff_allocated: {
        boxme: allocatedBoxme,
        seasonal: allocatedSeasonal,
        veteran: allocatedVeteran
      }
    });
  }

  return priorityBuckets;
}

// ============================================
// EXPORT MODULE
// ============================================

export default {
  calculateWorkHours,
  distributeWorkHours,
  calculateStaffNeeded,
  determineAlertLevel,
  calculateCosts,
  routeOrders,
  routeAllOrders,
  allocateStaff,
  allocateByPriority,
  formatVND,
  formatNumber
};
