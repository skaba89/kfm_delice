#!/bin/bash
# Comprehensive E2E test for KFM Delice API
# Starts dev server, runs all tests, kills server

set -uo pipefail
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/data/kfm-delice.db"
BASE=http://localhost:3000

# Start dev server in background
echo "[1/4] Starting dev server..."
npx next dev -p 3000 > /tmp/dev.log 2>&1 &
SERVER_PID=$!
trap "kill -9 $SERVER_PID 2>/dev/null; pkill -9 -P $SERVER_PID 2>/dev/null" EXIT

# Wait for server to be ready (up to 60s)
for i in {1..60}; do
  if curl -s -m 2 "$BASE/api/health" > /dev/null 2>&1; then
    echo "  Server ready after ${i}s"
    break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo "  [FAIL] Server not ready in 60s"
    tail -20 /tmp/dev.log
    exit 1
  fi
done

# Allow extra warm-up for first compile
sleep 5

# Test results array
declare -a RESULTS
PASS=0
FAIL=0

test_endpoint() {
  local name="$1"
  local expected_status="$2"
  local actual_status="$3"
  local detail="$4"
  if [ "$actual_status" = "$expected_status" ]; then
    RESULTS+=("PASS | $name | $actual_status | $detail")
    PASS=$((PASS+1))
  else
    RESULTS+=("FAIL | $name | expected=$expected_status actual=$actual_status | $detail")
    FAIL=$((FAIL+1))
  fi
}

call() {
  local method="$1"
  local path="$2"
  local data="$3"
  local auth="$4"
  local slug="$5"
  
  local headers="-H 'Content-Type: application/json'"
  [ -n "$auth" ] && headers="$headers -H 'Authorization: Bearer $auth'"
  [ -n "$slug" ] && headers="$headers -H 'x-restaurant-slug: $slug'"
  
  if [ -n "$data" ]; then
    eval curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" "$headers" -d "'$data'" "$BASE$path"
  else
    eval curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" "$headers" "$BASE$path"
  fi
}

echo ""
echo "[2/4] Running E2E tests..."
echo "================================"

# ============= AUTH TESTS =============
echo ""
echo "--- AUTH ---"

# Admin login
STATUS=$(curl -s -o /tmp/admin_token.json -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@monrestaurant.com","password":"Admin2024!"}' \
  "$BASE/api/login")
ADMIN_TOKEN=$(jq -r '.token // .data.token // empty' /tmp/admin_token.json 2>/dev/null)
test_endpoint "Admin Login" 200 "$STATUS" "token=${ADMIN_TOKEN:0:20}..."

# Customer login
STATUS=$(curl -s -o /tmp/cust_token.json -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d '{"email":"client@test.com","password":"Client2024!"}' \
  "$BASE/api/customer-login")
CUST_TOKEN=$(jq -r '.token // .data.token // empty' /tmp/cust_token.json 2>/dev/null)
test_endpoint "Customer Login" 200 "$STATUS" "token=${CUST_TOKEN:0:20}..."

# Driver login
STATUS=$(curl -s -o /tmp/drv_token.json -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d '{"email":"driver@test.com","password":"Driver2024!"}' \
  "$BASE/api/driver-login")
DRV_TOKEN=$(jq -r '.token // .data.token // empty' /tmp/drv_token.json 2>/dev/null)
test_endpoint "Driver Login" 200 "$STATUS" "token=${DRV_TOKEN:0:20}..."

# Platform login
STATUS=$(curl -s -o /tmp/plat_token.json -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@platform.com","password":"Platform2024!"}' \
  "$BASE/api/platform-login")
PLAT_TOKEN=$(jq -r '.token // .data.token // empty' /tmp/plat_token.json 2>/dev/null)
test_endpoint "Platform Login" 200 "$STATUS" "token=${PLAT_TOKEN:0:20}..."

# Invalid login
STATUS=$(curl -s -o /tmp/bad.json -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d '{"email":"bad@test.com","password":"bad"}' \
  "$BASE/api/login")
test_endpoint "Invalid Login Rejected" 401 "$STATUS" "blocked"

# Unauth dashboard
STATUS=$(curl -s -o /tmp/nada.json -w '%{http_code}' "$BASE/api/dashboard")
test_endpoint "Unauth Dashboard Blocked" 401 "$STATUS" "blocked"

# ============= PUBLIC ROUTES =============
echo ""
echo "--- PUBLIC ---"

# Restaurant info
STATUS=$(curl -s -o /tmp/resto.json -w '%{http_code}' -H "x-restaurant-slug: mon-restaurant" "$BASE/api/restaurant")
RESTO_NAME=$(jq -r '.name // .data.name // "N/A"' /tmp/resto.json 2>/dev/null)
test_endpoint "Get Restaurant Info" 200 "$STATUS" "name=$RESTO_NAME"

# List restaurants
STATUS=$(curl -s -o /tmp/restos.json -w '%{http_code}' "$BASE/api/restaurants")
RESTO_COUNT=$(jq -r 'if type=="array" then length else (.data | length) end // 0' /tmp/restos.json 2>/dev/null)
test_endpoint "List Restaurants" 200 "$STATUS" "count=$RESTO_COUNT"

# List menu
STATUS=$(curl -s -o /tmp/menu.json -w '%{http_code}' -H "x-restaurant-slug: mon-restaurant" "$BASE/api/menu")
MENU_COUNT=$(jq -r 'if type=="array" then length else (.data | length) end // 0' /tmp/menu.json 2>/dev/null)
test_endpoint "List Menu Items" 200 "$STATUS" "count=$MENU_COUNT"

# Health
STATUS=$(curl -s -o /tmp/health.json -w '%{http_code}' "$BASE/api/health")
test_endpoint "Health Endpoint" 200 "$STATUS" "ok"

# ============= MENU CRUD (admin) =============
echo ""
echo "--- MENU CRUD ---"

# Create menu item
STATUS=$(curl -s -o /tmp/menu_created.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" \
  -d '{"name":"Test Item E2E","description":"Created by E2E","price":15000,"category":"plats","badge":"Test","popular":false,"order":99}' \
  "$BASE/api/menu")
MENU_ID=$(jq -r '.id // .data.id // empty' /tmp/menu_created.json 2>/dev/null)
test_endpoint "Create Menu Item" 200 "$STATUS" "id=${MENU_ID:0:8}..."

# ============= ORDERS =============
echo ""
echo "--- ORDERS ---"

# Create order
STATUS=$(curl -s -o /tmp/order.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "x-restaurant-slug: mon-restaurant" \
  -d '{"customerName":"E2E Client","customerPhone":"+224600000000","items":[{"name":"Test","price":15000,"quantity":2}],"total":30000,"type":"delivery","address":"Conakry","status":"pending"}' \
  "$BASE/api/orders")
ORDER_ID=$(jq -r '.id // .data.id // empty' /tmp/order.json 2>/dev/null)
test_endpoint "Create Order" 200 "$STATUS" "id=${ORDER_ID:0:8}..."

# List orders
STATUS=$(curl -s -o /tmp/orders.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/orders")
ORDERS_COUNT=$(jq -r 'if type=="array" then length else (.data | length) end // 0' /tmp/orders.json 2>/dev/null)
test_endpoint "List Orders" 200 "$STATUS" "count=$ORDERS_COUNT"

# ============= RESERVATIONS =============
echo ""
echo "--- RESERVATIONS ---"

# Create reservation
TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d 2>/dev/null)
STATUS=$(curl -s -o /tmp/res.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "x-restaurant-slug: mon-restaurant" \
  -d "{\"name\":\"E2E Test\",\"phone\":\"+224600000000\",\"email\":\"e2e@test.com\",\"date\":\"$TOMORROW\",\"time\":\"19:00\",\"guests\":2,\"status\":\"pending\"}" \
  "$BASE/api/reservations")
RES_ID=$(jq -r '.id // .data.id // empty' /tmp/res.json 2>/dev/null)
test_endpoint "Create Reservation" 200 "$STATUS" "id=${RES_ID:0:8}..."

# List reservations
STATUS=$(curl -s -o /tmp/ress.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/reservations")
RESS_COUNT=$(jq -r 'if type=="array" then length else (.data | length) end // 0' /tmp/ress.json 2>/dev/null)
test_endpoint "List Reservations" 200 "$STATUS" "count=$RESS_COUNT"

# ============= DRIVERS =============
echo ""
echo "--- DRIVERS ---"

STATUS=$(curl -s -o /tmp/drvs.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/drivers")
DRVS_COUNT=$(jq -r 'if type=="array" then length else (.data | length) end // 0' /tmp/drvs.json 2>/dev/null)
test_endpoint "List Drivers" 200 "$STATUS" "count=$DRVS_COUNT"

# Driver-me (auth)
STATUS=$(curl -s -o /tmp/drvme.json -w '%{http_code}' -H "Authorization: Bearer $DRV_TOKEN" "$BASE/api/driver-me")
test_endpoint "Driver Profile (me)" 200 "$STATUS" "auth ok"

# ============= INVOICES =============
echo ""
echo "--- INVOICES ---"

STATUS=$(curl -s -o /tmp/inv.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" \
  -d '{"clientName":"E2E Client","clientEmail":"e2e@test.com","items":[{"description":"Service","quantity":1,"price":50000}],"taxRate":0,"status":"draft"}' \
  "$BASE/api/invoices")
INV_ID=$(jq -r '.id // .data.id // empty' /tmp/inv.json 2>/dev/null)
test_endpoint "Create Invoice" 200 "$STATUS" "id=${INV_ID:0:8}..."

STATUS=$(curl -s -o /tmp/invs.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/invoices")
test_endpoint "List Invoices" 200 "$STATUS" ""

# ============= QUOTES =============
echo ""
echo "--- QUOTES ---"

STATUS=$(curl -s -o /tmp/qt.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" \
  -d '{"clientName":"E2E Quote","clientEmail":"q@test.com","items":[{"description":"Item","quantity":1,"price":10000}],"status":"draft"}' \
  "$BASE/api/quotes")
QT_ID=$(jq -r '.id // .data.id // empty' /tmp/qt.json 2>/dev/null)
test_endpoint "Create Quote" 200 "$STATUS" "id=${QT_ID:0:8}..."

STATUS=$(curl -s -o /tmp/qts.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/quotes")
test_endpoint "List Quotes" 200 "$STATUS" ""

# ============= EXPENSES =============
echo ""
echo "--- EXPENSES ---"

STATUS=$(curl -s -o /tmp/ex.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" \
  -d '{"description":"E2E Test Expense","amount":25000,"category":"operations","date":"'$(date +%Y-%m-%d)'"}' \
  "$BASE/api/expenses")
EX_ID=$(jq -r '.id // .data.id // empty' /tmp/ex.json 2>/dev/null)
test_endpoint "Create Expense" 200 "$STATUS" "id=${EX_ID:0:8}..."

STATUS=$(curl -s -o /tmp/exs.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/expenses")
test_endpoint "List Expenses" 200 "$STATUS" ""

# ============= PAYMENTS =============
echo ""
echo "--- PAYMENTS ---"

STATUS=$(curl -s -o /tmp/pay.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" \
  -d '{"method":"orange_money","amount":15000,"reference":"E2E-PAY-001","status":"completed","orderId":"'"$ORDER_ID"'"}' \
  "$BASE/api/payment")
test_endpoint "Create Payment" 200 "$STATUS" ""

# ============= REVIEWS =============
echo ""
echo "--- REVIEWS ---"

STATUS=$(curl -s -o /tmp/rev.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "x-restaurant-slug: mon-restaurant" \
  -d '{"author":"E2E Client","rating":5,"comment":"Excellent service","status":"pending"}' \
  "$BASE/api/reviews")
test_endpoint "Create Review" 200 "$STATUS" ""

STATUS=$(curl -s -o /tmp/revs.json -w '%{http_code}' -H "x-restaurant-slug: mon-restaurant" "$BASE/api/reviews")
test_endpoint "List Reviews" 200 "$STATUS" ""

# ============= LOYALTY =============
echo ""
echo "--- LOYALTY ---"

STATUS=$(curl -s -o /tmp/lr.json -w '%{http_code}' -H "x-restaurant-slug: mon-restaurant" "$BASE/api/loyalty/rewards")
test_endpoint "List Loyalty Rewards" 200 "$STATUS" ""

# ============= STAFF =============
echo ""
echo "--- STAFF ---"

STATUS=$(curl -s -o /tmp/staff.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/staff")
test_endpoint "List Staff" 200 "$STATUS" ""

# ============= CUSTOMERS =============
echo ""
echo "--- CUSTOMERS ---"

STATUS=$(curl -s -o /tmp/custs.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/customers")
test_endpoint "List Customers" 200 "$STATUS" ""

# ============= DASHBOARD / ANALYTICS / STATS =============
echo ""
echo "--- DASHBOARD/STATS ---"

STATUS=$(curl -s -o /tmp/dash.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/dashboard")
test_endpoint "Dashboard Stats" 200 "$STATUS" ""

STATUS=$(curl -s -o /tmp/an.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/analytics")
test_endpoint "Analytics" 200 "$STATUS" ""

STATUS=$(curl -s -o /tmp/st.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/stats")
test_endpoint "Stats" 200 "$STATUS" ""

# ============= PLATFORM =============
echo ""
echo "--- PLATFORM ---"

STATUS=$(curl -s -o /tmp/plat.json -w '%{http_code}' -H "Authorization: Bearer $PLAT_TOKEN" "$BASE/api/platform/restaurants")
test_endpoint "Platform List Restaurants" 200 "$STATUS" ""

# ============= ADMIN ADMINS =============
echo ""
echo "--- ADMINS ---"

STATUS=$(curl -s -o /tmp/ads.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/admins")
test_endpoint "List Admins" 200 "$STATUS" ""

# ============= WEBSOCKET POLL =============
echo ""
echo "--- WEBSOCKET ---"

STATUS=$(curl -s -o /tmp/ws.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" "$BASE/api/ws-poll?since=0")
test_endpoint "WS Poll Events" 200 "$STATUS" ""

# ============= DRIVER ORDERS =============
echo ""
echo "--- DRIVER ORDERS ---"

STATUS=$(curl -s -o /tmp/dord.json -w '%{http_code}' -H "Authorization: Bearer $DRV_TOKEN" "$BASE/api/driver-orders")
test_endpoint "Driver Orders List" 200 "$STATUS" ""

# ============= CHANGE PASSWORD =============
echo ""
echo "--- CHANGE PASSWORD ---"

STATUS=$(curl -s -o /tmp/cp.json -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -H "x-restaurant-slug: mon-restaurant" \
  -d '{"currentPassword":"Admin2024!","newPassword":"Admin2024!"}' \
  "$BASE/api/change-password")
test_endpoint "Change Password" 200 "$STATUS" ""

# ============= RESULTS =============
echo ""
echo "[3/4] Results Summary"
echo "================================"
TOTAL=$((PASS+FAIL))
echo "TOTAL: $TOTAL"
echo "PASS:  $PASS"
echo "FAIL:  $FAIL"
echo "RATE:  $(echo "scale=1; $PASS * 100 / $TOTAL" | bc)%"
echo ""
echo "Detailed Results:"
echo "--------------------------------"
for r in "${RESULTS[@]}"; do
  echo "  $r"
done

# Save JSON report
echo ""
echo "[4/4] Saving JSON report..."
cat > /home/z/my-project/download/e2e-test-report.json << JSONEOF
{
  "timestamp": "$(date -Iseconds)",
  "total": $TOTAL,
  "passed": $PASS,
  "failed": $FAIL,
  "successRate": "$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)%",
  "results": [
$(for r in "${RESULTS[@]}"; do
  IFS='|' read -r status name detail <<< "$r"
  status=$(echo $status | xargs)
  name=$(echo $name | xargs)
  detail=$(echo $detail | xargs)
  echo "    { \"name\": \"$name\", \"status\": \"$status\", \"detail\": \"$detail\" },"
done | sed '$ s/,$//')
  ]
}
JSONEOF
echo "  Saved to: /home/z/my-project/download/e2e-test-report.json"

# Cleanup
echo ""
echo "Cleaning up server..."
kill -9 $SERVER_PID 2>/dev/null
pkill -9 -P $SERVER_PID 2>/dev/null
exit 0
