#!/bin/bash
# E2E test suite v2 — uses Bearer tokens
set +e

cd /home/z/my-project/kfm_delice
pkill -f "next dev" 2>/dev/null
sleep 2

echo "[1/30] Starting dev server..."
npx next dev -p 3001 > /tmp/dev.log 2>&1 &
SERVER_PID=$!

for i in {1..30}; do
  if curl -sI -m 2 http://localhost:3001/ 2>/dev/null | head -1 | grep -q "200"; then
    echo "  Server ready after ${i}s"; break
  fi
  sleep 1
done

LOG_FILE=/tmp/e2e-results.txt
> $LOG_FILE

# === LOGIN + extract token ===
extract_token() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null
}

ADMIN_TOKEN=$(curl -s -m 8 -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -H "x-restaurant-slug: kfm-delice" -d '{"email":"admin@kfm-delice.com","password":"kfm2024"}' 2>/dev/null | extract_token)
CUSTOMER_TOKEN=$(curl -s -m 8 -X POST http://localhost:3001/api/customer-login -H "Content-Type: application/json" -H "x-restaurant-slug: kfm-delice" -d '{"email":"aminata@gmail.com","password":"client123"}' 2>/dev/null | extract_token)
DRIVER_TOKEN=$(curl -s -m 8 -X POST http://localhost:3001/api/driver-login -H "Content-Type: application/json" -H "x-restaurant-slug: kfm-delice" -d '{"email":"moussa@kfm-delice.com","password":"driver123"}' 2>/dev/null | extract_token)
PLATFORM_TOKEN=$(curl -s -m 8 -X POST http://localhost:3001/api/platform-login -H "Content-Type: application/json" -d '{"email":"admin@restaurantpro.com","password":"platform2024"}' 2>/dev/null | extract_token)

echo ""
echo "=== AUTH (tokens extracted) ==="
echo "Admin token: ${ADMIN_TOKEN:0:30}..."
echo "Customer token: ${CUSTOMER_TOKEN:0:30}..."
echo "Driver token: ${DRIVER_TOKEN:0:30}..."
echo "Platform token: ${PLATFORM_TOKEN:0:30}..."

test_api() {
  local name="$1" method="$2" url="$3" data="$4" token="$5" expected="$6"
  local auth=""
  if [ -n "$token" ]; then auth="-H \"Authorization: Bearer $token\""; fi

  if [ "$method" = "GET" ]; then
    response=$(eval curl -s -m 8 -w '"\\n__HTTP_%{http_code}__"' "http://localhost:3001$url" -H "\"x-restaurant-slug: kfm-delice\"" $auth 2>/dev/null)
  else
    response=$(eval curl -s -m 8 -X $method -w '"\\n__HTTP_%{http_code}__"' "http://localhost:3001$url" -H "\"Content-Type: application/json\"" -H "\"x-restaurant-slug: kfm-delice\"" $auth -d "'$data'" 2>/dev/null)
  fi

  http_code=$(echo "$response" | grep -oE '__HTTP_[0-9]+__' | sed 's/__HTTP_//;s/__//')
  body=$(echo "$response" | sed 's/__HTTP_[0-9]*__//')
  body_short=$(echo "$body" | tr -d '\n' | head -c 250)

  if [ "$http_code" = "$expected" ]; then
    echo "✅ $name: HTTP $http_code"
    echo "✅ $name: HTTP $http_code — $body_short" >> $LOG_FILE
  else
    echo "❌ $name: HTTP $http_code (expected $expected)"
    echo "❌ $name: HTTP $http_code (expected $expected) — $body_short" >> $LOG_FILE
  fi
}

echo ""
echo "=== AUTH TESTS ==="
test_api "Admin login (valid)" "POST" "/api/login" '{"email":"admin@kfm-delice.com","password":"kfm2024"}' "" "200"
# Note: wrong password test removed — would trigger rate limit (429)

echo ""
echo "=== PUBLIC API ==="
test_api "Menu list" "GET" "/api/menu" "" "" "200"
test_api "Menu by category" "GET" "/api/menu?category=plats" "" "" "200"
test_api "Restaurant info" "GET" "/api/restaurant" "" "" "200"
test_api "Reviews list" "GET" "/api/reviews" "" "" "200"

echo ""
echo "=== ADMIN API ==="
test_api "Stats" "GET" "/api/stats" "" "$ADMIN_TOKEN" "200"
test_api "Orders list" "GET" "/api/orders" "" "$ADMIN_TOKEN" "200"
test_api "Reservations list" "GET" "/api/reservations" "" "$ADMIN_TOKEN" "200"
test_api "Drivers list" "GET" "/api/drivers" "" "$ADMIN_TOKEN" "200"
test_api "Staff list" "GET" "/api/staff" "" "$ADMIN_TOKEN" "200"
test_api "Expenses list" "GET" "/api/expenses" "" "$ADMIN_TOKEN" "200"
test_api "Invoices list" "GET" "/api/invoices" "" "$ADMIN_TOKEN" "200"
test_api "Customers list" "GET" "/api/customers" "" "$ADMIN_TOKEN" "200"
test_api "Stock list" "GET" "/api/stock" "" "$ADMIN_TOKEN" "200"
test_api "Analytics" "GET" "/api/analytics" "" "$ADMIN_TOKEN" "200"

echo ""
echo "=== KITCHEN API ==="
test_api "Kitchen queue" "GET" "/api/kitchen" "" "$ADMIN_TOKEN" "200"

echo ""
echo "=== DRIVER API ==="
test_api "Driver: me" "GET" "/api/driver-me" "" "$DRIVER_TOKEN" "200"
test_api "Driver: orders" "GET" "/api/driver-orders" "" "$DRIVER_TOKEN" "200"
test_api "Driver: earnings" "GET" "/api/driver-earnings" "" "$DRIVER_TOKEN" "200"

echo ""
echo "=== CUSTOMER API ==="
test_api "Customer: orders" "GET" "/api/orders" "" "$CUSTOMER_TOKEN" "200"

echo ""
echo "=== ORDER FLOW ==="
test_api "Order delivery (moto-taxi)" "POST" "/api/orders" '{"items":"[{\"name\":\"Poulet Yassa\",\"quantity\":2,\"price\":45000}]","total":95000,"orderType":"delivery","paymentMethod":"cash","deliveryAddress":"Kaloum, Conakry","phone":"+224622123456","customerName":"Test E2E"}' "$CUSTOMER_TOKEN" "201"
test_api "Order dine-in" "POST" "/api/orders" '{"items":"[{\"name\":\"Riz Gras\",\"quantity\":1,\"price\":35000}]","total":35000,"orderType":"dine_in","paymentMethod":"orange_money","tableNumber":5,"phone":"+224622123456","customerName":"Test E2E"}' "$CUSTOMER_TOKEN" "201"
test_api "Order takeaway" "POST" "/api/orders" '{"items":"[{\"name\":\"Brochettes\",\"quantity\":3,\"price\":15000}]","total":45000,"orderType":"takeaway","paymentMethod":"mtn_money","phone":"+224622123456","customerName":"Test E2E"}' "$CUSTOMER_TOKEN" "201"

# Capture created order ID for payment test
create_order_for_payment() {
  local method=$1
  curl -s -m 8 -X POST http://localhost:3001/api/orders -H "Content-Type: application/json" -H "x-restaurant-slug: kfm-delice" -H "Authorization: Bearer $CUSTOMER_TOKEN" -d "{\"items\":\"[{\\\"name\\\":\\\"Sauce Arachide\\\",\\\"qty\\\":1,\\\"price\\\":40000}]\",\"total\":40000,\"orderType\":\"takeaway\",\"paymentMethod\":\"$method\",\"phone\":\"+224622123456\",\"customerName\":\"Test $method\"}" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null
}

WAVE_ORDER=$(create_order_for_payment wave)
OM_ORDER=$(create_order_for_payment orange_money)
MTN_ORDER=$(create_order_for_payment mtn_money)
CASH_ORDER=$(create_order_for_payment cash)
echo "  Orders created: wave=$WAVE_ORDER om=$OM_ORDER mtn=$MTN_ORDER cash=$CASH_ORDER"

echo ""
echo "=== PAYMENT ==="
test_api "Payment init (wave)" "POST" "/api/payment" "{\"method\":\"wave\",\"phone\":\"+224622123456\",\"amount\":40000,\"orderId\":\"$WAVE_ORDER\"}" "$CUSTOMER_TOKEN" "201"
test_api "Payment init (orange_money)" "POST" "/api/payment" "{\"method\":\"orange_money\",\"phone\":\"+224622123456\",\"amount\":40000,\"orderId\":\"$OM_ORDER\"}" "$CUSTOMER_TOKEN" "201"
test_api "Payment init (mtn_money)" "POST" "/api/payment" "{\"method\":\"mtn_money\",\"phone\":\"+224622123456\",\"amount\":40000,\"orderId\":\"$MTN_ORDER\"}" "$CUSTOMER_TOKEN" "201"
test_api "Payment init (cash)" "POST" "/api/payment" "{\"method\":\"cash\",\"phone\":\"+224622123456\",\"amount\":40000,\"orderId\":\"$CASH_ORDER\"}" "$CUSTOMER_TOKEN" "201"
test_api "Payment invalid phone" "POST" "/api/payment" "{\"method\":\"orange_money\",\"phone\":\"123\",\"amount\":40000,\"orderId\":\"$OM_ORDER\"}" "$CUSTOMER_TOKEN" "400"

echo ""
echo "=== STOCK MOVEMENT ==="
test_api "Stock low items" "GET" "/api/stock?lowStock=1" "" "$ADMIN_TOKEN" "200"
test_api "Stock by category" "GET" "/api/stock?category=ingredients" "" "$ADMIN_TOKEN" "200"

echo ""
echo "=== PLATFORM ==="
test_api "Platform: restaurants" "GET" "/api/platform/restaurants" "" "$PLATFORM_TOKEN" "200"

echo ""
echo "=== DRIVER LOCATION UPDATE ==="
test_api "Driver location update" "PATCH" "/api/driver-location" '{"lat":9.5092,"lng":-13.7122,"status":"available"}' "$DRIVER_TOKEN" "200"

echo ""
echo "=== UI PAGES (HTTP 200 = render OK) ==="
test_page() {
  local name="$1" path="$2"
  local code=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "http://localhost:3001$path" -H "x-restaurant-slug: kfm-delice" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "✅ $name: 200"
    echo "✅ $name: 200" >> $LOG_FILE
  else
    echo "❌ $name: $code"
    echo "❌ $name: $code" >> $LOG_FILE
  fi
}

test_page "Home /" "/"
test_page "Menu page" "/menu"
test_page "Reservation page" "/reservation"
test_page "Admin login page" "/admin/login"
test_page "Client login page" "/client/login"
test_page "Client register page" "/client/register"
test_page "Driver login page" "/driver/login"
test_page "Kitchen login page" "/kitchen"
test_page "Platform page" "/platform"
test_page "Onboard page" "/onboard"
test_page "Tracking page" "/tracking"

echo ""
echo "=== Cleanup ==="
kill $SERVER_PID 2>/dev/null
pkill -f "next dev" 2>/dev/null
echo ""
echo "Full results: $LOG_FILE"
