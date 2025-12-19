/**
 * WORKFORCE RECOMMENDATIONS ENGINE
 * 
 * Generates smart recommendations for workforce optimization:
 * - Field Table opportunities
 * - Pre-pack optimization
 * - Staff hiring alerts
 * - Cost savings analysis
 * 
 * @module workforce-recommendations
 * @version 2.0.0
 */

import {
  Recommendation,
  CustomerConfig,
  MethodBreakdown,
  StaffBreakdown,
  CostAnalysis,
  PACKING_METHOD_EFFICIENCY,
  STAFF_COST_PER_HOUR,
  CONTRACTOR_COSTS,
  ALERT_THRESHOLDS,
  DEFAULT_PRODUCTIVITY
} from './workforce-v2';

// ============================================
// RECOMMENDATION GENERATORS
// ============================================

/**
 * Generate Field Table optimization recommendations
 */
export function generateFieldTableRecommendations(
  customers: CustomerConfig[],
  methodBreakdown: MethodBreakdown[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const customer of customers) {
    // Check if Field Table is disabled but could benefit
    if (!customer.operations.field_table_enabled) {
      // Estimate potential orders that could use Field Table
      const singleSKUPercentage = customer.product_mix
        .filter((p) => p.category_code === 'COSMETICS' || p.category_code === 'BABY')
        .reduce((sum, p) => sum + p.percentage, 0);

      if (singleSKUPercentage > 30) {
        // Significant portion could benefit
        const standardBreakdown = methodBreakdown.find((m) => m.method === 'STANDARD');
        const potentialOrders = standardBreakdown
          ? Math.floor(standardBreakdown.orders * (singleSKUPercentage / 100))
          : 0;

        if (potentialOrders > 1000) {
          // Calculate savings
          const currentHours = (potentialOrders * DEFAULT_PRODUCTIVITY.avg_processing_minutes) / 60;
          const fieldTableHours = currentHours * PACKING_METHOD_EFFICIENCY.FIELD_TABLE;
          const timeSaved = currentHours - fieldTableHours;
          const costSaved = Math.round(
            timeSaved * (STAFF_COST_PER_HOUR.boxme / 8) * 30 // 30 days
          );

          recommendations.push({
            type: 'OPTIMIZATION',
            category: 'FIELD_TABLE',
            priority: costSaved > 1000000 ? 'HIGH' : 'MEDIUM',
            message: `Enable Field Table for ${customer.name}`,
            impact: {
              orders_affected: potentialOrders,
              time_saved_hours: Math.round(timeSaved * 10) / 10,
              cost_saved_vnd: costSaved
            },
            action: `UPDATE customer_operations SET field_table_enabled = 1 WHERE customer_id = '${customer.id}'`
          });
        }
      }
    }

    // Check if Field Table is enabled but underutilized
    if (customer.operations.field_table_enabled) {
      const fieldTableBreakdown = methodBreakdown.find((m) => m.method === 'FIELD_TABLE');
      const totalOrders = methodBreakdown.reduce((sum, m) => sum + m.orders, 0);
      const fieldTablePercentage = fieldTableBreakdown
        ? (fieldTableBreakdown.orders / totalOrders) * 100
        : 0;

      if (fieldTablePercentage < 20) {
        recommendations.push({
          type: 'INSIGHT',
          category: 'FIELD_TABLE',
          priority: 'LOW',
          message: `Field Table underutilized for ${customer.name} (${Math.round(fieldTablePercentage)}%)`,
          impact: {
            orders_affected: fieldTableBreakdown?.orders || 0
          },
          action: `Review SKU/weight limits or expand hero SKU list for customer ${customer.code}`
        });
      }
    }
  }

  return recommendations;
}

/**
 * Generate Pre-pack optimization recommendations
 */
export function generatePrepackRecommendations(
  customers: CustomerConfig[],
  methodBreakdown: MethodBreakdown[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const customer of customers) {
    // Check if Pre-pack is disabled but could benefit
    if (!customer.operations.prepack_enabled) {
      const heavyCategoryPercentage = customer.product_mix
        .filter((p) => p.category_code === 'BABY' || p.category_code === 'FOOD')
        .reduce((sum, p) => sum + p.percentage, 0);

      if (heavyCategoryPercentage > 20) {
        const standardBreakdown = methodBreakdown.find((m) => m.method === 'STANDARD');
        const potentialOrders = standardBreakdown
          ? Math.floor(standardBreakdown.orders * (heavyCategoryPercentage / 100))
          : 0;

        if (potentialOrders > 500) {
          const currentHours = (potentialOrders * DEFAULT_PRODUCTIVITY.avg_processing_minutes) / 60;
          const prepackHours = currentHours * PACKING_METHOD_EFFICIENCY.PREPACK;
          const timeSaved = currentHours - prepackHours;
          const costSaved = Math.round(timeSaved * (STAFF_COST_PER_HOUR.boxme / 8) * 30);

          recommendations.push({
            type: 'OPTIMIZATION',
            category: 'PREPACK',
            priority: costSaved > 500000 ? 'HIGH' : 'MEDIUM',
            message: `Enable Pre-pack for ${customer.name}`,
            impact: {
              orders_affected: potentialOrders,
              time_saved_hours: Math.round(timeSaved * 10) / 10,
              cost_saved_vnd: costSaved
            },
            action: `UPDATE customer_operations SET prepack_enabled = 1, prepack_weekly_quota = 2000 WHERE customer_id = '${customer.id}'`
          });
        }
      }
    }

    // Check quota utilization
    if (customer.operations.prepack_enabled && customer.operations.prepack_weekly_quota > 0) {
      const prepackBreakdown = methodBreakdown.find((m) => m.method === 'PREPACK');
      const weeklyOrders = prepackBreakdown ? prepackBreakdown.orders * 7 : 0; // Daily to weekly
      const quotaUtilization = (weeklyOrders / customer.operations.prepack_weekly_quota) * 100;

      if (quotaUtilization > 90) {
        recommendations.push({
          type: 'ALERT',
          category: 'PREPACK',
          priority: 'MEDIUM',
          message: `Pre-pack quota almost full for ${customer.name} (${Math.round(quotaUtilization)}%)`,
          impact: {
            orders_affected: Math.floor(weeklyOrders - customer.operations.prepack_weekly_quota)
          },
          action: `Increase prepack_weekly_quota to ${Math.ceil(customer.operations.prepack_weekly_quota * 1.5)}`
        });
      }
    }
  }

  return recommendations;
}

/**
 * Generate staff hiring alerts
 */
export function generateStaffAlerts(
  staffBreakdown: StaffBreakdown,
  forecastDate: string
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const today = new Date();
  const eventDate = new Date(forecastDate);
  const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Critical staff shortage
  if (staffBreakdown.total_gap >= ALERT_THRESHOLDS.gap_critical) {
    recommendations.push({
      type: 'ALERT',
      category: 'STAFF',
      priority: 'HIGH',
      message: `Critical staff shortage on ${forecastDate} (${daysUntil} days away)`,
      impact: {
        gap_total: staffBreakdown.total_gap,
        orders_at_risk: Math.floor(staffBreakdown.total_gap * 8 * DEFAULT_PRODUCTIVITY.avg_orders_per_hour)
      },
      action: `Hire ${staffBreakdown.contractor_needed} contractors immediately. Lead time: 7 days minimum.`
    });
  } else if (staffBreakdown.total_gap >= ALERT_THRESHOLDS.gap_warning) {
    recommendations.push({
      type: 'ALERT',
      category: 'STAFF',
      priority: 'MEDIUM',
      message: `Staff shortage warning for ${forecastDate}`,
      impact: {
        gap_total: staffBreakdown.total_gap,
        orders_at_risk: Math.floor(staffBreakdown.total_gap * 8 * DEFAULT_PRODUCTIVITY.avg_orders_per_hour)
      },
      action: `Plan to hire ${staffBreakdown.contractor_needed} contractors. Recommended hiring date: ${new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
    });
  }

  // Boxme staff shortage
  if (staffBreakdown.boxme.gap > 20) {
    recommendations.push({
      type: 'INSIGHT',
      category: 'STAFF',
      priority: 'MEDIUM',
      message: `Boxme staff shortage: ${staffBreakdown.boxme.gap} needed`,
      impact: {
        gap_total: staffBreakdown.boxme.gap
      },
      action: 'Consider hiring full-time Boxme staff or training seasonal workers'
    });
  }

  // Contractor cost warning
  const contractorCost =
    staffBreakdown.contractor_needed * CONTRACTOR_COSTS.bonus_per_person +
    staffBreakdown.contractor_needed * CONTRACTOR_COSTS.meal_per_person;

  if (contractorCost > 5000000) {
    // > 5M VND
    recommendations.push({
      type: 'INSIGHT',
      category: 'COST',
      priority: 'LOW',
      message: `High contractor costs expected: ${Math.round(contractorCost / 1000000)}M VND`,
      impact: {
        cost_saved_vnd: contractorCost
      },
      action: 'Consider negotiating bulk contractor rates or hiring permanent staff'
    });
  }

  return recommendations;
}

/**
 * Generate cost optimization recommendations
 */
export function generateCostRecommendations(
  costAnalysis: CostAnalysis,
  methodBreakdown: MethodBreakdown[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Check if savings potential is significant
  if (costAnalysis.savings_potential.total > 1000000) {
    // > 1M VND/day
    const dailySavings = costAnalysis.savings_potential.total;
    const monthlySavings = dailySavings * 30;

    recommendations.push({
      type: 'OPTIMIZATION',
      category: 'COST',
      priority: 'HIGH',
      message: `Potential cost savings: ${Math.round(dailySavings / 1000000 * 10) / 10}M VND/day`,
      impact: {
        cost_saved_vnd: monthlySavings
      },
      action: 'Enable Field Table and Pre-pack for eligible customers to achieve these savings'
    });
  }

  // Check method efficiency
  const standardBreakdown = methodBreakdown.find((m) => m.method === 'STANDARD');
  const totalOrders = methodBreakdown.reduce((sum, m) => sum + m.orders, 0);

  if (standardBreakdown && standardBreakdown.orders / totalOrders > 0.7) {
    // > 70% standard
    recommendations.push({
      type: 'INSIGHT',
      category: 'COST',
      priority: 'MEDIUM',
      message: `${Math.round((standardBreakdown.orders / totalOrders) * 100)}% orders use Standard packing`,
      impact: {
        orders_affected: standardBreakdown.orders
      },
      action: 'Review customer configurations to enable more efficient packing methods'
    });
  }

  return recommendations;
}

/**
 * Generate priority-based recommendations
 */
export function generatePriorityRecommendations(
  priorityBreakdown: Array<{
    priority: number;
    name: string;
    orders: number;
    hours: number;
    staff_needed: number;
  }>
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Check P1 (Instant) volume
  const p1 = priorityBreakdown.find((p) => p.priority === 1);
  if (p1 && p1.orders > 5000) {
    recommendations.push({
      type: 'ALERT',
      category: 'PRIORITY',
      priority: 'HIGH',
      message: `High P1 (Instant) volume: ${p1.orders} orders`,
      impact: {
        orders_affected: p1.orders
      },
      action: 'Allocate best staff (Boxme + Veterans) to P1 orders. Process before 8am cutoff.'
    });
  }

  // Check P5-P6 (Delayable) volume
  const delayable = priorityBreakdown
    .filter((p) => p.priority >= 5)
    .reduce((sum, p) => sum + p.orders, 0);

  if (delayable > 0) {
    const totalOrders = priorityBreakdown.reduce((sum, p) => sum + p.orders, 0);
    const delayablePercentage = (delayable / totalOrders) * 100;

    if (delayablePercentage > 15) {
      recommendations.push({
        type: 'INSIGHT',
        category: 'PRIORITY',
        priority: 'LOW',
        message: `${Math.round(delayablePercentage)}% orders are delayable (P5-P6)`,
        impact: {
          orders_affected: delayable
        },
        action: 'Consider delaying non-urgent orders if capacity constrained'
      });
    }
  }

  return recommendations;
}

/**
 * Generate all recommendations
 */
export function generateAllRecommendations(
  customers: CustomerConfig[],
  methodBreakdown: MethodBreakdown[],
  staffBreakdown: StaffBreakdown,
  costAnalysis: CostAnalysis,
  forecastDate: string,
  priorityBreakdown?: Array<{
    priority: number;
    name: string;
    orders: number;
    hours: number;
    staff_needed: number;
  }>
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Field Table recommendations
  recommendations.push(...generateFieldTableRecommendations(customers, methodBreakdown));

  // Pre-pack recommendations
  recommendations.push(...generatePrepackRecommendations(customers, methodBreakdown));

  // Staff alerts
  recommendations.push(...generateStaffAlerts(staffBreakdown, forecastDate));

  // Cost recommendations
  recommendations.push(...generateCostRecommendations(costAnalysis, methodBreakdown));

  // Priority recommendations (if provided)
  if (priorityBreakdown) {
    recommendations.push(...generatePriorityRecommendations(priorityBreakdown));
  }

  // Sort by priority (HIGH -> MEDIUM -> LOW)
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

// ============================================
// EXPORT MODULE
// ============================================

export default {
  generateFieldTableRecommendations,
  generatePrepackRecommendations,
  generateStaffAlerts,
  generateCostRecommendations,
  generatePriorityRecommendations,
  generateAllRecommendations
};
