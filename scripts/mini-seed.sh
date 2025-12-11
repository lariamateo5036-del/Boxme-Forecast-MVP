#!/bin/bash
# Mini seed - Only 90 days for faster testing
# ~45,000 orders total

cd /home/user/webapp

echo "🚀 Generating 90 days of orders (mini dataset)..."

cat > /tmp/mini-orders.sql << 'EOF'
-- Mini dataset: 90 days, avg 500 orders/day = ~45,000 orders

INSERT INTO orders_history (id, order_id, order_date, order_time, fulfillment_center_id, customer_id, marketplace, product_group, sku_complexity, service_level, shipping_carrier, num_items, is_delayed_allowed) VALUES
EOF

COUNTER=0
for i in $(seq 89 -1 0); do
  DATE=$(date -d "$i days ago" +%Y-%m-%d)
  
  # Generate 500 orders per day
  for j in $(seq 1 500); do
    UUID=$(cat /proc/sys/kernel/random/uuid)
    ORDER_ID="ORD-${DATE//-/}-$(printf '%06d' $j)"
    
    MARKETPLACES=("Shopee" "Lazada" "TikTok Shop" "Tiki" "Sendo")
    MP_IDX=$((RANDOM % 5))
    
    CARRIERS=("GHTK" "Ninja Van" "Viettel Post" "GHN" "J&T Express")
    CARRIER_IDX=$((RANDOM % 5))
    
    SERVICES=("fast" "express" "same_day" "economy" "bulky")
    SVC_IDX=$((RANDOM % 5))
    
    PRODUCT_GROUP=$((1 + RANDOM % 4))
    
    COUNTER=$((COUNTER + 1))
    
    if [ $COUNTER -eq 45000 ]; then
      echo "('$UUID', '$ORDER_ID', '$DATE', '12:00:00', 'FC-HCM-01', 'CUST-1', '${MARKETPLACES[$MP_IDX]}', $PRODUCT_GROUP, 'simple', '${SERVICES[$SVC_IDX]}', '${CARRIERS[$CARRIER_IDX]}', 2, 0);" >> /tmp/mini-orders.sql
    else
      echo "('$UUID', '$ORDER_ID', '$DATE', '12:00:00', 'FC-HCM-01', 'CUST-1', '${MARKETPLACES[$MP_IDX]}', $PRODUCT_GROUP, 'simple', '${SERVICES[$SVC_IDX]}', '${CARRIERS[$CARRIER_IDX]}', 2, 0)," >> /tmp/mini-orders.sql
    fi
  done
  
  if [ $((i % 10)) -eq 0 ]; then
    echo "  → $((90 - i))/90 days processed..."
  fi
done

echo ""
echo "✅ Generated $COUNTER orders"
echo "📦 File size: $(du -h /tmp/mini-orders.sql | cut -f1)"
echo ""
echo "🔄 Loading into database..."
wrangler d1 execute boxme-forecast-production --local --file=/tmp/mini-orders.sql

echo ""
echo "✅ Verifying..."
wrangler d1 execute boxme-forecast-production --local --command="SELECT COUNT(*) as total, MIN(order_date) as first_date, MAX(order_date) as last_date FROM orders_history"
