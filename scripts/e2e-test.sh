#!/bin/bash
# End-to-End Test Suite — KFM Delice
# Uses curl to test all API routes

BASE="http://127.0.0.1:3000"
PASS=0
FAIL=0
TOTAL=0

log() {
  local name="$1" passed="$2" detail="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$passed" = "true" ]; then
    PASS=$((PASS + 1))
    echo "✅ $name: $detail"
  else
    FAIL=$((FAIL + 1))
    echo "❌ $name: $detail"
  fi
}

echo "🚀 Starting End-to-End Test Suite (shell/curl)"
echo "══════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════
# 1. AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "🔑 === AUTHENTICATION TESTS ==="

# Admin login
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/login" -H "Content-Type: application/json" -d '{"email":"admin@monrestaurant.com","password":"Admin2024!"}')
ADMIN_TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
RESTAURANT_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('restaurantId',''))" 2>/dev/null)
[ -n "$ADMIN_TOKEN" ] && log "Admin Login" true "token obtained, rid=$RESTAURANT_ID" || log "Admin Login" false "no token, resp=${RESP:0:100}"

# Customer login
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/customer-login" -H "Content-Type: application/json" -d '{"email":"client@test.com","password":"Client2024!"}')
CUSTOMER_TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$CUSTOMER_TOKEN" ] && log "Customer Login" true "token obtained" || log "Customer Login" false "no token, resp=${RESP:0:100}"

# Driver login
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/driver-login" -H "Content-Type: application/json" -d '{"email":"driver@test.com","password":"Driver2024!"}')
DRIVER_TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$DRIVER_TOKEN" ] && log "Driver Login" true "token obtained" || log "Driver Login" false "no token, resp=${RESP:0:100}"

# Platform login
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/platform-login" -H "Content-Type: application/json" -d '{"email":"admin@platform.com","password":"Platform2024!"}')
PLATFORM_TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$PLATFORM_TOKEN" ] && log "Platform Login" true "token obtained" || log "Platform Login" false "no token, resp=${RESP:0:100}"

# Invalid login
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE/api/login" -H "Content-Type: application/json" -d '{"email":"admin@monrestaurant.com","password":"wrong"}')
[ "$HTTP" = "401" ] && log "Invalid Login Rejected" true "status=$HTTP" || log "Invalid Login Rejected" false "status=$HTTP (expected 401)"

# Unauth access
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE/api/dashboard")
[ "$HTTP" = "401" ] && log "Unauth Dashboard Blocked" true "status=$HTTP" || log "Unauth Dashboard Blocked" false "status=$HTTP (expected 401)"

# ═══════════════════════════════════════════════════════════════════
# 2. RESTAURANT & MENU
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "🍽️ === RESTAURANT & MENU TESTS ==="

# Get restaurant info
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/restaurant")
[ "$HTTP" = "200" ] && log "Get Restaurant Info" true "status=$HTTP" || log "Get Restaurant Info" false "status=$HTTP"

# List restaurants (public)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE/api/restaurants")
[ "$HTTP" = "200" ] && log "List Restaurants" true "status=$HTTP" || log "List Restaurants" false "status=$HTTP"

# List menu items
RESP=$(curl -s --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/menu")
MENU_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) and d else '')" 2>/dev/null)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/menu")
[ "$HTTP" = "200" ] && log "List Menu Items" true "status=$HTTP, first_id=$MENU_ID" || log "List Menu Items" false "status=$HTTP"

# Create menu item
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/menu" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"name":"Test E2E","description":"Test plat","price":20000,"category":"plats","badge":"Test","popular":true,"available":true,"order":99}')
NEW_MENU_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$NEW_MENU_ID" ] && log "Create Menu Item" true "id=$NEW_MENU_ID" || log "Create Menu Item" false "resp=${RESP:0:100}"

# Update menu item
if [ -n "$NEW_MENU_ID" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X PATCH "$BASE/api/menu?id=$NEW_MENU_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"name":"Test Updated","price":22000}')
  [ "$HTTP" = "200" ] && log "Update Menu Item" true "status=$HTTP" || log "Update Menu Item" false "status=$HTTP"
fi

# Delete menu item
if [ -n "$NEW_MENU_ID" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X DELETE "$BASE/api/menu?id=$NEW_MENU_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
  [ "$HTTP" = "200" ] && log "Delete Menu Item" true "status=$HTTP" || log "Delete Menu Item" false "status=$HTTP"
fi

# ═══════════════════════════════════════════════════════════════════
# 3. ORDERS
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "📦 === ORDERS TESTS ==="

# Create order
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/orders" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"customerName":"Client E2E","phone":"+224 600","items":"[{\"name\":\"Riz Jollof\",\"price\":35000,\"qty\":2}]","total":70000,"orderType":"dine_in","paymentMethod":"cash"}')
ORDER_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$ORDER_ID" ] && log "Create Order" true "id=$ORDER_ID" || log "Create Order" false "resp=${RESP:0:100}"

# List orders
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/orders")
[ "$HTTP" = "200" ] && log "List Orders" true "status=$HTTP" || log "List Orders" false "status=$HTTP"

# Get order by ID
if [ -n "$ORDER_ID" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE/api/orders/$ORDER_ID")
  [ "$HTTP" = "200" ] && log "Get Order by ID" true "status=$HTTP" || log "Get Order by ID" false "status=$HTTP"

  # Update order status
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X PATCH "$BASE/api/orders/$ORDER_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"status":"preparing"}')
  [ "$HTTP" = "200" ] && log "Update Order Status" true "status=$HTTP" || log "Update Order Status" false "status=$HTTP"
fi

# ═══════════════════════════════════════════════════════════════════
# 4. RESERVATIONS
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "📅 === RESERVATIONS TESTS ==="

TODAY=$(date +%Y-%m-%d)
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/reservations" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "{\"customerName\":\"Client E2E\",\"phone\":\"+224 600\",\"date\":\"$TODAY\",\"time\":\"19:00\",\"guests\":4,\"zone\":\"terrasse\",\"notes\":\"Test E2E\"}")
RESERVATION_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$RESERVATION_ID" ] && log "Create Reservation" true "id=$RESERVATION_ID" || log "Create Reservation" false "resp=${RESP:0:100}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/reservations")
[ "$HTTP" = "200" ] && log "List Reservations" true "status=$HTTP" || log "List Reservations" false "status=$HTTP"

if [ -n "$RESERVATION_ID" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X PATCH "$BASE/api/reservations?id=$RESERVATION_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"status":"confirmed"}')
  [ "$HTTP" = "200" ] && log "Update Reservation" true "status=$HTTP" || log "Update Reservation" false "status=$HTTP"
fi

# ═══════════════════════════════════════════════════════════════════
# 5. DRIVERS & DELIVERY
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "🛵 === DRIVERS & DELIVERY TESTS ==="

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/drivers")
[ "$HTTP" = "200" ] && log "List Drivers" true "status=$HTTP" || log "List Drivers" false "status=$HTTP"

# Driver me
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $DRIVER_TOKEN" "$BASE/api/driver-me")
[ "$HTTP" = "200" ] && log "Driver Profile (me)" true "status=$HTTP" || log "Driver Profile (me)" false "status=$HTTP"

# Driver location
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE/api/driver-location" -H "Content-Type: application/json" -H "Authorization: Bearer $DRIVER_TOKEN" -d '{"lat":9.5092,"lng":-13.7122}')
[ "$HTTP" = "200" ] && log "Update Driver Location" true "status=$HTTP" || log "Update Driver Location" false "status=$HTTP"

# Driver orders
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $DRIVER_TOKEN" "$BASE/api/driver-orders")
[ "$HTTP" = "200" ] && log "Driver Orders" true "status=$HTTP" || log "Driver Orders" false "status=$HTTP"

# ═══════════════════════════════════════════════════════════════════
# 6. INVOICES, QUOTES, EXPENSES
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "💰 === INVOICES, QUOTES & EXPENSES TESTS ==="

# Create invoice
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/invoices" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "{\"number\":\"FAC-E2E-001\",\"customerName\":\"Client E2E\",\"customerPhone\":\"+224 600\",\"items\":\"[{\\\"description\\\":\\\"Test\\\",\\\"qty\\\":1,\\\"unitPrice\\\":50000,\\\"total\\\":50000}]\",\"subtotal\":50000,\"tax\":7500,\"total\":57500,\"status\":\"pending\",\"dueDate\":\"$TODAY\"}")
INVOICE_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$INVOICE_ID" ] && log "Create Invoice" true "id=$INVOICE_ID" || log "Create Invoice" false "resp=${RESP:0:100}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/invoices")
[ "$HTTP" = "200" ] && log "List Invoices" true "status=$HTTP" || log "List Invoices" false "status=$HTTP"

# Create quote
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/quotes" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "{\"number\":\"DEV-E2E-001\",\"customerName\":\"Client E2E\",\"customerPhone\":\"+224 600\",\"items\":\"[{\\\"description\\\":\\\"Test\\\",\\\"qty\\\":1,\\\"unitPrice\\\":100000,\\\"total\\\":100000}]\",\"subtotal\":100000,\"discount\":10000,\"total\":90000,\"status\":\"draft\",\"validUntil\":\"2026-12-31\"}")
QUOTE_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$QUOTE_ID" ] && log "Create Quote" true "id=$QUOTE_ID" || log "Create Quote" false "resp=${RESP:0:100}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/quotes")
[ "$HTTP" = "200" ] && log "List Quotes" true "status=$HTTP" || log "List Quotes" false "status=$HTTP"

# Create expense
RESP=$(curl -s --max-time 10 -X POST "$BASE/api/expenses" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "{\"description\":\"Test E2E\",\"amount\":25000,\"category\":\"ingredients\",\"date\":\"$TODAY\",\"paidBy\":\"Admin\",\"notes\":\"Test\"}")
EXPENSE_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$EXPENSE_ID" ] && log "Create Expense" true "id=$EXPENSE_ID" || log "Create Expense" false "resp=${RESP:0:100}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/expenses")
[ "$HTTP" = "200" ] && log "List Expenses" true "status=$HTTP" || log "List Expenses" false "status=$HTTP"

# ═══════════════════════════════════════════════════════════════════
# 7. PAYMENTS
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "💳 === PAYMENTS TESTS ==="

if [ -n "$ORDER_ID" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE/api/payment" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "{\"orderId\":\"$ORDER_ID\",\"amount\":70000,\"method\":\"cash\"}")
  [ "$HTTP" = "200" ] && log "Cash Payment" true "status=$HTTP" || log "Cash Payment" false "status=$HTTP"
else
  log "Payments" false "No order ID"; FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1))
fi

# ═══════════════════════════════════════════════════════════════════
# 8. LOYALTY & REVIEWS
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "⭐ === LOYALTY & REVIEWS TESTS ==="

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $CUSTOMER_TOKEN" "$BASE/api/loyalty/rewards")
[ "$HTTP" = "200" ] && log "List Loyalty Rewards" true "status=$HTTP" || log "List Loyalty Rewards" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $CUSTOMER_TOKEN" "$BASE/api/loyalty/history")
[ "$HTTP" = "200" ] && log "Loyalty History" true "status=$HTTP" || log "Loyalty History" false "status=$HTTP"

# Create review
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE/api/reviews" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"customerName":"Client E2E","rating":5,"comment":"Excellent","date":"Juin 2026"}')
[ "$HTTP" = "200" ] && log "Create Review" true "status=$HTTP" || log "Create Review" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/reviews")
[ "$HTTP" = "200" ] && log "List Reviews" true "status=$HTTP" || log "List Reviews" false "status=$HTTP"

# ═══════════════════════════════════════════════════════════════════
# 9. STAFF
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "👥 === STAFF MANAGEMENT TESTS ==="

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE/api/staff" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "{\"name\":\"Employé E2E\",\"phone\":\"+224 688\",\"role\":\"serveur\",\"salary\":600000,\"status\":\"active\",\"hireDate\":\"$TODAY\"}")
[ "$HTTP" = "200" ] && log "Create Staff" true "status=$HTTP" || log "Create Staff" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/staff")
[ "$HTTP" = "200" ] && log "List Staff" true "status=$HTTP" || log "List Staff" false "status=$HTTP"

# ═══════════════════════════════════════════════════════════════════
# 10. DASHBOARD & ADMIN
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "📊 === ADMIN & DASHBOARD TESTS ==="

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/dashboard")
[ "$HTTP" = "200" ] && log "Dashboard Data" true "status=$HTTP" || log "Dashboard Data" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/stats")
[ "$HTTP" = "200" ] && log "Stats Endpoint" true "status=$HTTP" || log "Stats Endpoint" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/admins")
[ "$HTTP" = "200" ] && log "List Admins" true "status=$HTTP" || log "List Admins" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/customers")
[ "$HTTP" = "200" ] && log "List Customers" true "status=$HTTP" || log "List Customers" false "status=$HTTP"

# ═══════════════════════════════════════════════════════════════════
# 11. WEBSOCKET
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "🔌 === WEBSOCKET & REAL-TIME TESTS ==="

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE/api/ws-poll" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"action":"register"}')
[ "$HTTP" = "200" ] && log "WS Poll Register" true "status=$HTTP" || log "WS Poll Register" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/ws-poll?since=0")
[ "$HTTP" = "200" ] && log "WS Poll Events" true "status=$HTTP" || log "WS Poll Events" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE/api/ws-notify" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"event":"test","data":{"msg":"E2E"},"targetType":"admin"}')
[ "$HTTP" = "200" ] && log "WS Notify" true "status=$HTTP" || log "WS Notify" false "status=$HTTP"

# ═══════════════════════════════════════════════════════════════════
# 12. PLATFORM & HEALTH
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "🏢 === PLATFORM & HEALTH TESTS ==="

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $PLATFORM_TOKEN" "$BASE/api/platform/restaurants")
[ "$HTTP" = "200" ] && log "Platform Restaurants" true "status=$HTTP" || log "Platform Restaurants" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/health")
[ "$HTTP" = "200" ] && log "Health Check" true "status=$HTTP" || log "Health Check" false "status=$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/debug")
[ "$HTTP" = "200" ] && log "Debug Diagnostics" true "status=$HTTP" || log "Debug Diagnostics" false "status=$HTTP"

# ═══════════════════════════════════════════════════════════════════
# 13. CUSTOMER REGISTRATION
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "📝 === CUSTOMER REGISTRATION TEST ==="

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE/api/customer-register" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"email":"newclient@test.com","password":"NewClient2024!","name":"Nouveau Client","phone":"+224 677"}')
[ "$HTTP" = "200" ] && log "Customer Registration" true "status=$HTTP" || log "Customer Registration" false "status=$HTTP"

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "📋 TEST SUMMARY"
echo ""
RATE=$(python3 -c "print(f'{$PASS/$TOTAL*100:.1f}%')" 2>/dev/null || echo "N/A")
echo "Total: $TOTAL | ✅ Passed: $PASS | ❌ Failed: $FAIL"
echo "Success Rate: $RATE"
