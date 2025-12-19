/**
 * Generate 24 months of fake historical data for MVP testing (OPTIMIZED)
 * Run with: npx tsx scripts/generate-fake-data-optimized.ts
 * 
 * This version writes to file in chunks to avoid memory issues
 */

import * as fs from 'fs';

// Helper function to generate UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

// Check if date is a peak day
function isPeakDay(dateStr: string, peakEvents: any[]): any {
  return peakEvents.find((e) => e.event_date === dateStr);
}

// Check if date is weekend
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

// Generate orders for a single day and write to stream
function generateOrdersForDay(
  date: Date,
  peakEvent: any,
  startingId: number,
  writeStream: fs.WriteStream,
  batchBuffer: any[],
  batchSize: number
): number {
  const dateStr = formatDate(date);
  const isWeekendDay = isWeekend(date);

  // Determine base order count
  let baseOrders = 15000; // Average between 10k-30k

  // Apply multipliers
  if (peakEvent) {
    baseOrders = Math.floor(baseOrders * peakEvent.expected_multiplier);
  } else if (isWeekendDay) {
    baseOrders = Math.floor(baseOrders * 1.3); // 30% increase on weekends
  }

  // Add randomness (±15%)
  const orderCount = Math.floor(baseOrders * (0.85 + Math.random() * 0.3));

  const marketplaces = ['Shopee', 'Lazada', 'TikTok Shop', 'Tiki', 'Sendo'];
  const serviceLevels = ['fast', 'express', 'same_day', 'economy', 'bulky'];
  const carriers = ['GHTK', 'Ninja Van', 'Viettel Post', 'GHN', 'J&T Express'];

  for (let i = 0; i < orderCount; i++) {
    const orderHour = Math.floor(Math.random() * 24);
    const orderMinute = Math.floor(Math.random() * 60);
    const orderSecond = Math.floor(Math.random() * 60);

    const productGroup = Math.ceil(Math.random() * 4);
    const marketplace = marketplaces[Math.floor(Math.random() * marketplaces.length)];
    const serviceLevel = serviceLevels[Math.floor(Math.random() * serviceLevels.length)];
    const carrier = carriers[Math.floor(Math.random() * carriers.length)];

    batchBuffer.push({
      id: generateUUID(),
      order_id: `ORD-${dateStr.replace(/-/g, '')}-${String(startingId + i).padStart(6, '0')}`,
      order_date: dateStr,
      order_time: `${String(orderHour).padStart(2, '0')}:${String(orderMinute).padStart(2, '0')}:${String(orderSecond).padStart(2, '0')}`,
      fulfillment_center_id: 'FC-HCM-01',
      customer_id: `CUST-${Math.floor(Math.random() * 1000)}`,
      marketplace,
      product_group: productGroup,
      sku_complexity: Math.random() > 0.7 ? 'complex' : Math.random() > 0.5 ? 'medium' : 'simple',
      service_level: serviceLevel,
      shipping_carrier: carrier,
      num_items: Math.ceil(Math.random() * 5),
      is_delayed_allowed: serviceLevel === 'economy' ? 1 : 0,
      sla_deadline: new Date(date.getTime() + (serviceLevel === 'same_day' ? 8 : 24) * 3600000).toISOString(),
      completion_time: new Date(date.getTime() + Math.random() * 12 * 3600000).toISOString(),
    });

    // Write batch when full
    if (batchBuffer.length >= batchSize) {
      writeBatch(writeStream, batchBuffer);
      batchBuffer.length = 0; // Clear buffer
    }
  }

  return orderCount;
}

// Write a batch of orders to stream
function writeBatch(writeStream: fs.WriteStream, batch: any[]) {
  if (batch.length === 0) return;

  let sql = 'INSERT OR IGNORE INTO orders_history (\n';
  sql += '  id, order_id, order_date, order_time, fulfillment_center_id, customer_id,\n';
  sql += '  marketplace, product_group, sku_complexity, service_level, shipping_carrier,\n';
  sql += '  num_items, is_delayed_allowed, sla_deadline, completion_time\n';
  sql += ') VALUES\n';

  const values = batch.map((order, idx) => {
    const isLast = idx === batch.length - 1;
    return (
      `  ('${order.id}', '${order.order_id}', '${order.order_date}', '${order.order_time}', ` +
      `'${order.fulfillment_center_id}', '${order.customer_id}', '${order.marketplace}', ` +
      `${order.product_group}, '${order.sku_complexity}', '${order.service_level}', ` +
      `'${order.shipping_carrier}', ${order.num_items}, ${order.is_delayed_allowed}, ` +
      `'${order.sla_deadline}', '${order.completion_time}')${isLast ? ';' : ','}`
    );
  });

  sql += values.join('\n') + '\n\n';
  writeStream.write(sql);
}

// Main function
async function main() {
  console.log('🚀 Generating 24 months of fake data (OPTIMIZED)...\n');

  // Get peak events
  const peakEvents = [
    // 2024
    { event_date: '2024-01-01', expected_multiplier: 2.05 },
    { event_date: '2024-01-02', expected_multiplier: 3.5 },
    { event_date: '2024-01-03', expected_multiplier: 2.25 },
    { event_date: '2024-01-04', expected_multiplier: 1.5 },
    { event_date: '2024-02-01', expected_multiplier: 1.84 },
    { event_date: '2024-02-02', expected_multiplier: 2.8 },
    { event_date: '2024-02-03', expected_multiplier: 1.9 },
    { event_date: '2024-02-04', expected_multiplier: 1.36 },
    { event_date: '2024-02-10', expected_multiplier: 3.5 }, // Tet
    { event_date: '2024-03-02', expected_multiplier: 1.78 },
    { event_date: '2024-03-03', expected_multiplier: 2.6 },
    { event_date: '2024-03-04', expected_multiplier: 1.8 },
    { event_date: '2024-03-05', expected_multiplier: 1.32 },
    { event_date: '2024-04-03', expected_multiplier: 1.75 },
    { event_date: '2024-04-04', expected_multiplier: 2.5 },
    { event_date: '2024-04-05', expected_multiplier: 1.75 },
    { event_date: '2024-04-06', expected_multiplier: 1.3 },
    { event_date: '2024-05-04', expected_multiplier: 1.81 },
    { event_date: '2024-05-05', expected_multiplier: 2.7 },
    { event_date: '2024-05-06', expected_multiplier: 1.85 },
    { event_date: '2024-05-07', expected_multiplier: 1.34 },
    { event_date: '2024-06-05', expected_multiplier: 1.96 },
    { event_date: '2024-06-06', expected_multiplier: 3.2 },
    { event_date: '2024-06-07', expected_multiplier: 2.1 },
    { event_date: '2024-06-08', expected_multiplier: 1.44 },
    { event_date: '2024-07-06', expected_multiplier: 1.87 },
    { event_date: '2024-07-07', expected_multiplier: 2.9 },
    { event_date: '2024-07-08', expected_multiplier: 1.95 },
    { event_date: '2024-07-09', expected_multiplier: 1.38 },
    { event_date: '2024-08-07', expected_multiplier: 1.9 },
    { event_date: '2024-08-08', expected_multiplier: 3.0 },
    { event_date: '2024-08-09', expected_multiplier: 2.0 },
    { event_date: '2024-08-10', expected_multiplier: 1.4 },
    { event_date: '2024-09-08', expected_multiplier: 2.14 },
    { event_date: '2024-09-09', expected_multiplier: 3.8 },
    { event_date: '2024-09-10', expected_multiplier: 2.4 },
    { event_date: '2024-09-11', expected_multiplier: 1.56 },
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
    // 2025
    { event_date: '2025-01-01', expected_multiplier: 3.5 },
    { event_date: '2025-01-02', expected_multiplier: 2.25 },
    { event_date: '2025-01-03', expected_multiplier: 1.5 },
    { event_date: '2025-01-29', expected_multiplier: 3.5 }, // Tet
  ];

  // Generate data for last 24 months (730 days)
  const endDate = new Date();
  const startDate = addDays(endDate, -730);

  console.log(`Generating orders from ${formatDate(startDate)} to ${formatDate(endDate)}`);
  console.log(`Writing directly to file to avoid memory issues...\n`);

  const sqlFile = './generated-orders.sql';
  const writeStream = fs.createWriteStream(sqlFile);

  // Write header
  writeStream.write('-- Generated fake orders data\n');
  writeStream.write(`-- Generated at: ${new Date().toISOString()}\n`);
  writeStream.write('-- Period: 24 months (730 days)\n\n');

  let totalOrders = 0;
  let totalDays = 0;
  const batchBuffer: any[] = [];
  const batchSize = 500;

  let currentDate = startDate;
  let orderId = 0;

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    const peakEvent = isPeakDay(dateStr, peakEvents);

    const dayOrders = generateOrdersForDay(currentDate, peakEvent, orderId, writeStream, batchBuffer, batchSize);

    totalOrders += dayOrders;
    orderId += dayOrders;
    totalDays++;

    if (totalDays % 30 === 0) {
      console.log(`  → Processed ${totalDays} days, ${totalOrders.toLocaleString()} orders...`);
    }

    currentDate = addDays(currentDate, 1);
  }

  // Write remaining buffer
  if (batchBuffer.length > 0) {
    writeBatch(writeStream, batchBuffer);
  }

  // Close stream
  writeStream.end();

  console.log(`\n✓ Generated ${totalOrders.toLocaleString()} orders over ${totalDays} days`);
  console.log(`Average: ${Math.round(totalOrders / totalDays).toLocaleString()} orders/day\n`);
  console.log(`✓ SQL file written to ${sqlFile}`);
  console.log(`\nTo load data into local database, run:`);
  console.log(`  wrangler d1 execute boxme-forecast-production --local --file=${sqlFile}\n`);
}

// Run with: npx tsx scripts/generate-fake-data-optimized.ts
main().catch(console.error);
