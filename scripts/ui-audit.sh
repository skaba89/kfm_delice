#!/bin/bash
# UI audit - starts server, runs all checks, kills server, all in one process
set +e

cd /home/z/my-project/kfm_delice
pkill -f "next dev" 2>/dev/null
sleep 2

echo "[1/1] Starting dev server on port 3004..."
npx next dev -p 3004 > /tmp/dev3004.log 2>&1 &
SERVER_PID=$!

PORT=3004
BASE="http://localhost:$PORT"

ready=0
for i in {1..40}; do
  if curl -sI -m 2 "$BASE/" 2>/dev/null | head -1 | grep -q "200"; then
    echo "  Server ready after ${i}s"
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" != "1" ]; then
  echo "ERROR: server failed to start"
  tail -20 /tmp/dev3004.log
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

# === Helper functions ===
extract_token() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null
}

# === Login all 4 roles ===
echo ""
echo "=== AUTH ==="
ADMIN_TOKEN=$(curl -s -m 10 -X POST "$BASE/api/login" -H "Content-Type: application/json" -H "x-restaurant-slug: kfm-delice" -d '{"email":"admin@kfm-delice.com","password":"kfm2024"}' | extract_token)
CUSTOMER_TOKEN=$(curl -s -m 10 -X POST "$BASE/api/customer-login" -H "Content-Type: application/json" -H "x-restaurant-slug: kfm-delice" -d '{"email":"aminata@gmail.com","password":"client123"}' | extract_token)
DRIVER_TOKEN=$(curl -s -m 10 -X POST "$BASE/api/driver-login" -H "Content-Type: application/json" -H "x-restaurant-slug: kfm-delice" -d '{"email":"moussa@kfm-delice.com","password":"driver123"}' | extract_token)
PLATFORM_TOKEN=$(curl -s -m 10 -X POST "$BASE/api/platform-login" -H "Content-Type: application/json" -d '{"email":"admin@restaurantpro.com","password":"platform2024"}' | extract_token)

echo "Admin token len:    ${#ADMIN_TOKEN}"
echo "Customer token len: ${#CUSTOMER_TOKEN}"
echo "Driver token len:   ${#DRIVER_TOKEN}"
echo "Platform token len: ${#PLATFORM_TOKEN}"

# === Audit rendered HTML pages ===
echo ""
echo "=== UI PAGES — RENDERED HTML ==="
audit_page() {
  local name="$1" path="$2"
  local html
  html=$(curl -s -m 15 "$BASE$path" -H "x-restaurant-slug: kfm-delice" 2>/dev/null)
  local size=${#html}
  local title=$(echo "$html" | grep -oP '<title>[^<]+' | head -1 | sed 's/<title>//')
  local h1=$(echo "$html" | grep -oP '<h1[^>]*>[^<]+' | head -1 | sed 's/<h1[^>]*>//')
  local err_count=$(echo "$html" | grep -cE "Application error|TypeError|ReferenceError|Internal Server Error" 2>/dev/null)
  local has_leaflet=$(echo "$html" | grep -c "leaflet" 2>/dev/null)
  local has_kfm=$(echo "$html" | grep -ci "kfm\|delice" 2>/dev/null)
  printf "%-26s | size=%6d | err=%d | leaflet=%d | kfm_refs=%d | title=%-30s | h1=%s\n" \
    "$name" "$size" "$err_count" "$has_leaflet" "$has_kfm" "$title" "$h1"
}

audit_page "Home /" "/"
audit_page "Menu page" "/menu"
audit_page "Reservation" "/reservation"
audit_page "Tracking" "/tracking"
audit_page "Admin login" "/admin/login"
audit_page "Client login" "/client/login"
audit_page "Client register" "/client/register"
audit_page "Driver login" "/driver/login"
audit_page "Kitchen portal" "/kitchen"
audit_page "Platform" "/platform"
audit_page "Onboard" "/onboard"

# === Audit API responses (depth) ===
echo ""
echo "=== API DEPTH CHECK ==="
echo "--- /api/menu (count + first item) ---"
curl -s -m 10 "$BASE/api/menu" -H "x-restaurant-slug: kfm-delice" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('data', [])
print(f'Total items: {len(items)}')
if items:
    sample = items[0]
    print(f'First item keys: {list(sample.keys())}')
    print(f'First item sample: id={sample.get(\"id\")}, name={sample.get(\"name\")}, price={sample.get(\"price\")}, category={sample.get(\"category\")}, available={sample.get(\"available\")}')
"

echo ""
echo "--- /api/restaurant ---"
curl -s -m 10 "$BASE/api/restaurant" -H "x-restaurant-slug: kfm-delice" | python3 -c "
import sys, json
d = json.load(sys.stdin)
keys = ['name', 'slug', 'phone', 'address', 'currency', 'locale', 'openingHours', 'deliveryFee', 'plan', 'status']
for k in keys:
    print(f'  {k}: {d.get(k, \"<missing>\")}')"

echo ""
echo "--- /api/stats (admin) ---"
curl -s -m 10 "$BASE/api/stats" -H "x-restaurant-slug: kfm-delice" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Keys: {list(d.keys())}')
for k, v in list(d.items())[:12]:
    v_str = str(v)[:80]
    print(f'  {k}: {v_str}')"

echo ""
echo "--- /api/orders (admin) — count + sample ---"
curl -s -m 10 "$BASE/api/orders" -H "x-restaurant-slug: kfm-delice" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d if isinstance(d, list) else d.get('data', [])
print(f'Total orders: {len(data)}')
if data:
    o = data[0]
    print(f'First order: id={o.get(\"id\")}, status={o.get(\"status\")}, total={o.get(\"total\")}, type={o.get(\"orderType\")}, customer={o.get(\"customerName\")}, payment={o.get(\"paymentMethod\")}')
"

echo ""
echo "--- /api/drivers (admin) ---"
curl -s -m 10 "$BASE/api/drivers" -H "x-restaurant-slug: kfm-delice" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d if isinstance(d, list) else d.get('data', [])
print(f'Drivers: {len(data)}')
for dr in data[:3]:
    print(f'  - {dr.get(\"name\")} ({dr.get(\"email\")}) vehicle={dr.get(\"vehicle\")} online={dr.get(\"isOnline\")}')"

echo ""
echo "--- /api/stock (admin) — low stock check ---"
curl -s -m 10 "$BASE/api/stock?lowStock=1" -H "x-restaurant-slug: kfm-delice" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d if isinstance(d, list) else d.get('data', d.get('items', []))
print(f'Low stock items: {len(data)}')
for s in data[:5]:
    print(f'  - {s.get(\"name\")}: {s.get(\"quantity\")} {s.get(\"unit\")} (min: {s.get(\"minQuantity\")})')"

echo ""
echo "--- /api/kitchen (kitchen queue) ---"
curl -s -m 10 "$BASE/api/kitchen" -H "x-restaurant-slug: kfm-delice" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d if isinstance(d, list) else d.get('data', d.get('orders', []))
print(f'Kitchen queue: {len(data)} orders')
for o in data[:5]:
    print(f'  - #{o.get(\"orderNumber\", o.get(\"id\",\"\"))[:8]} status={o.get(\"status\")} customer={o.get(\"customerName\")}')"

echo ""
echo "--- /api/driver-me ---"
curl -s -m 10 "$BASE/api/driver-me" -H "x-restaurant-slug: kfm-delice" -H "Authorization: Bearer $DRIVER_TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Driver: {d.get(\"name\")} ({d.get(\"email\")})')
print(f'  vehicle: {d.get(\"vehicle\")}, phone: {d.get(\"phone\")}, online: {d.get(\"isOnline\")}')"

echo ""
echo "--- /api/driver-earnings ---"
curl -s -m 10 "$BASE/api/driver-earnings" -H "x-restaurant-slug: kfm-delice" -H "Authorization: Bearer $DRIVER_TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Keys: {list(d.keys())}')
for k, v in d.items():
    print(f'  {k}: {str(v)[:80]}')"

echo ""
echo "--- /api/platform/restaurants ---"
curl -s -m 10 "$BASE/api/platform/restaurants" -H "Authorization: Bearer $PLATFORM_TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d if isinstance(d, list) else d.get('data', [])
print(f'Restaurants on platform: {len(data)}')
for r in data[:3]:
    print(f'  - {r.get(\"name\")} (slug={r.get(\"slug\")}) plan={r.get(\"plan\")} status={r.get(\"status\")}')"

# === Security checks ===
echo ""
echo "=== SECURITY CHECKS ==="
echo "--- JWT secret default? ---"
grep -n "JWT_SECRET" src/lib/auth.ts | head -3
echo ""
echo "--- Tokens in git history? ---"
git log --all -p 2>/dev/null | grep -cE "ghp_[A-Za-z0-9]{30,}" || echo "0 (clean)"
echo ""
echo "--- .env files present? ---"
ls -la .env* 2>/dev/null || echo "No .env files (good for repo, but check prod env)"
echo ""
echo "--- Authorization check on protected routes (should be 401) ---"
echo -n "  /api/stats without token: "
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/stats" -H "x-restaurant-slug: kfm-delice"
echo ""
echo -n "  /api/orders without token: "
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/orders" -H "x-restaurant-slug: kfm-delice"
echo ""
echo -n "  /api/drivers without token: "
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/drivers" -H "x-restaurant-slug: kfm-delice"
echo ""
echo -n "  /api/admins without token: "
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admins" -H "x-restaurant-slug: kfm-delice"
echo ""
echo -n "  /api/platform/restaurants without token: "
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/platform/restaurants"
echo ""

# === Cleanup ===
echo ""
echo "=== Cleanup ==="
kill $SERVER_PID 2>/dev/null
pkill -f "next dev" 2>/dev/null
echo "Done."
