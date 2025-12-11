#!/bin/bash
# Quick seed script to generate sample orders for last 30 days

cd /home/user/webapp

echo "Generating sample orders for last 30 days..."

# Create a temporary SQL file
cat > /tmp/quick-orders.sql << 'EOF'
-- Sample orders for last 30 days
INSERT OR IGNORE INTO orders_history (id, order_id, order_date, order_time, fulfillment_center_id, customer_id, marketplace, product_group, sku_complexity, service_level, shipping_carrier, num_items, is_delayed_allowed) VALUES
EOF

# Generate 30 days of sample orders (simplified)
for i in {0..29}; do
  DATE=$(date -d "$i days ago" +%Y-%m-%d)
  
  # Generate ~500 orders per day for testing
  for j in {1..500}; do
    ORDER_ID="ORD-$(date -d "$i days ago" +%Y%m%d)-$(printf '%06d' $j)"
    PRODUCT_GROUP=$((1 + RANDOM % 4))
    MARKETPLACE=("Shopee" "Lazada" "TikTok Shop" "Tiki" "Sendo")
    MARKETPLACE_IDX=$((RANDOM % 5))
    SERVICE_LEVEL=("fast" "express" "same_day" "economy" "bulky")
    SERVICE_IDX=$((RANDOM % 5))
    
    UUID=$(cat /proc/sys/kernel/random/uuid)
    
    if [ $i -eq 0 ] && [ $j -eq 500 ]; then
      # Last row, no comma
      echo "('$UUID', '$ORDER_ID', '$DATE', '12:00:00', 'FC-HCM-01', 'CUST-1', '${MARKETPLACE[$MARKETPLACE_IDX]}', $PRODUCT_GROUP, 'simple', '${SERVICE_LEVEL[$SERVICE_IDX]}', 'GHTK', 2, 0);" >> /tmp/quick-orders.sql
    else
      echo "('$UUID', '$ORDER_ID', '$DATE', '12:00:00', 'FC-HCM-01', 'CUST-1', '${MARKETPLACE[$MARKETPLACE_IDX]}', $PRODUCT_GROUP, 'simple', '${SERVICE_LEVEL[$SERVICE_IDX]}', 'GHTK', 2, 0)," >> /tmp/quick-orders.sql
    fi
  done
done

echo "Loading orders into database..."
wrangler d1 execute boxme-forecast-production --local --file=/tmp/quick-orders.sql

echo "✓ Sample data loaded!"
