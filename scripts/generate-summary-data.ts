/**
 * Generate 3 months of fake historical data (lighter version for MVP)
 * Creates aggregate daily summaries instead of individual orders
 * Run with: npx tsx scripts/generate-summary-data.ts
 */

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper function to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

//  function to generate UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Check if date is a peak day
function isPeakDay(dateStr: string, peakEvents: any[]): any {
  return peakEvents.find((e) => e.event_date === dateStr);
}

// Check if date is weekend
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Main function
async function main() {
  console.log('🚀 Generating daily forecast summaries for 3 months...\n');

  const peakEvents = [
    { event_date: '2024-10-09', expected_multiplier: 2.05 },
    { event_date: '2024-10-10', expected_multiplier: 3.5 },
    { event_date: '2024-10-11', expected_multiplier: 2.25 },
    { event_date: '2024-10-12', expected_multiplier: 1.5 },
    { event_date: '2024-11-10', expected_multiplier: 2.26 },
    { event_date: '2024-11-11', expected_multiplier: 4.2 },
    { event_date: '2024-11-12', expected_multiplier: 2.6 },
    { event_date: '2024-11-13', expected_multiplier: 1.64 },
    { event_date: '2024-12-11', expected_multiplier: 2.17 },
    { event_date: '2024-12-12', expected_multiplier: 3.9 },
    { event_date: '2024-12-13', expected_multiplier: 2.45 },
    { event_date: '2024-12-14', expected_multiplier: 1.58 },
    { event_date: '2024-12-31', expected_multiplier: 2.05 },
  ];

  // Generate last 3 months + next 1 month for forecasting
  const today = new Date();
  const startDate = addDays(today, -90); // 3 months ago
  const endDate = addDays(today, 30); // 1 month forward

  console.log(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`);
  console.log(`Generating daily forecast records...\n`);

  const sqlStatements: string[] = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    const peakEvent = isPeakDay(dateStr, peakEvents);
    const isWeekendDay = isWeekend(currentDate);
    const isHistorical = currentDate < today;

    // Calculate orders
    let baseOrders = 15000;
    if (peakEvent) {
      baseOrders = Math.floor(baseOrders * peakEvent.expected_multiplier);
    } else if (isWeekendDay) {
      baseOrders = Math.floor(baseOrders * 1.3);
    }

    const actualOrders = isHistorical ? Math.floor(baseOrders * (0.85 + Math.random() * 0.3)) : null;
    const forecastOrders = Math.floor(baseOrders * (0.90 + Math.random() * 0.2));
    const mlForecast = Math.floor(baseOrders * (0.88 + Math.random() * 0.24));
    const confidence = 0.70 + Math.random() * 0.25;

    const mape = isHistorical && actualOrders ? Math.abs((forecastOrders - actualOrders) / actualOrders) * 100 : null;

    // Insert daily forecast
    sqlStatements.push(`
INSERT OR REPLACE INTO daily_forecasts (
  id, forecast_date, generated_at, model_version,
  baseline_forecast, ml_forecast, ml_confidence,
  final_forecast, lower_bound, upper_bound,
  actual_orders, mape, is_peak_day, peak_multiplier, notes
) VALUES (
  '${generateUUID()}',
  '${dateStr}',
  '${new Date().toISOString()}',
  'baseline+ml-v1.0',
  ${forecastOrders},
  ${mlForecast},
  ${confidence.toFixed(2)},
  ${forecastOrders},
  ${Math.floor(forecastOrders * 0.8)},
  ${Math.floor(forecastOrders * 1.2)},
  ${actualOrders},
  ${mape ? mape.toFixed(2) : 'NULL'},
  ${peakEvent ? 1 : 0},
  ${peakEvent ? peakEvent.expected_multiplier : 'NULL'},
  ${peakEvent ? `'${peakEvent.expected_multiplier}x peak'` : 'NULL'}
);`);

    currentDate = addDays(currentDate, 1);
  }

  // Write SQL file
  const sqlContent = `-- Daily forecast summaries
-- Generated at: ${new Date().toISOString()}
-- Period: ${formatDate(startDate)} to ${formatDate(endDate)}
-- Records: ${sqlStatements.length}

${sqlStatements.join('\n')}
`;

  const fs = await import('fs');
  const sqlFile = './generated-forecasts.sql';
  await fs.promises.writeFile(sqlFile, sqlContent);

  console.log(`✓ Generated ${sqlStatements.length} daily forecast records`);
  console.log(`✓ Written to ${sqlFile}\n`);
  console.log(`To load into local database:`);
  console.log(`  wrangler d1 execute boxme-forecast-production --local --file=${sqlFile}\n`);
}

main().catch(console.error);
