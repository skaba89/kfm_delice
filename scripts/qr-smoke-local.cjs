#!/usr/bin/env node
/**
 * Local smoke test for the QR code table ordering flow (Mission 11).
 *
 * Assumes the server is already running on http://localhost:3001.
 *
 * Steps:
 *   1. Login as admin
 *   2. Create a table
 *   3. Fetch its QR token via /api/tables/[id]/qr
 *   4. Resolve the token via the public /api/qr/table/[token] endpoint
 *   5. Create a dine_in order with the tableQrToken
 *   6. Verify the order has the correct tableId + tableNumberStr
 *   7. Rotate the QR token
 *   8. Verify the old token is rejected
 *   9. Verify the new token works
 *  10. Disable the table
 *  11. Verify order creation fails
 *  12. Cleanup
 */

const BASE_URL = process.env.QR_SMOKE_URL || "http://localhost:3001";
const ADMIN_EMAIL = process.env.QR_SMOKE_ADMIN_EMAIL || "admin@kfm-delice.com";
const ADMIN_PASSWORD = process.env.QR_SMOKE_ADMIN_PASSWORD || "AdminKFM2026!";
const SLUG = process.env.QR_SMOKE_SLUG || "kfm-delice";

const crypto = require("crypto");
const assert = require("assert");

async function http(method, path, body, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

(async () => {
  console.log(`\n=== QR Smoke Test — ${BASE_URL} ===\n`);
  let pass = 0, fail = 0;
  const check = (name, cond, detail) => {
    if (cond) { console.log(`  ✓ ${name}`); pass++; }
    else { console.log(`  ✗ ${name}`, detail || ""); fail++; }
  };

  // ── 1. Admin login ──
  console.log("Step 1: admin login");
  let r = await http("POST", "/api/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  check("login 200", r.status === 200, r);
  if (r.status !== 200) { console.error("ABORT"); process.exit(1); }
  const adminToken = r.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, "x-restaurant-slug": SLUG };

  // ── 2. Create table ──
  const tableNumber = `SMOKE-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  console.log(`Step 2: create table ${tableNumber}`);
  r = await http("POST", "/api/tables", {
    name: `Smoke Test ${tableNumber}`,
    number: tableNumber,
    capacity: 4,
    zone: "Smoke",
  }, adminHeaders);
  check("table create 201", r.status === 201, r);
  if (r.status !== 201) { console.error("ABORT"); process.exit(1); }
  const tableId = r.data.id;
  const initialToken = r.data.qrToken;

  // ── 3. Fetch QR details ──
  console.log("Step 3: fetch QR details");
  r = await http("GET", `/api/tables/${tableId}/qr`, null, adminHeaders);
  check("qr fetch 200", r.status === 200, r);
  check("qr token matches", r.data.qrToken === initialToken);

  // ── 4. Public QR resolution ──
  console.log("Step 4: resolve QR via public endpoint");
  r = await http("GET", `/api/qr/table/${initialToken}`);
  check("public resolve 200", r.status === 200, r);
  check("restaurant slug matches", r.data?.restaurant?.slug === SLUG, r.data?.restaurant);
  check("table number matches", r.data?.table?.number === tableNumber, r.data?.table);

  // ── 5. Create dine_in order from table ──
  console.log("Step 5: create dine_in order via QR token");
  const idemKey = crypto.randomUUID();
  r = await http("POST", "/api/orders", {
    items: JSON.stringify([{ name: "Smoke Test Item", price: 5000, qty: 1 }]),
    total: 5000,
    orderType: "dine_in",
    customerName: "Smoke Test",
    tableQrToken: initialToken,
    idempotencyKey: idemKey,
  }, { "x-idempotency-key": idemKey, "x-restaurant-slug": SLUG });
  check("order create 201", r.status === 201, r);
  check("order has tableId", r.data?.tableId === tableId, { orderTableId: r.data?.tableId, tableId });
  check("order has tableNumberStr", r.data?.tableNumberStr === tableNumber, { got: r.data?.tableNumberStr, want: tableNumber });
  const orderId = r.data?.id;

  // ── 6. Idempotency: re-submit with same key → should return same order ──
  console.log("Step 6: idempotency check (re-submit)");
  r = await http("POST", "/api/orders", {
    items: JSON.stringify([{ name: "Smoke Test Item", price: 5000, qty: 1 }]),
    total: 5000,
    orderType: "dine_in",
    customerName: "Smoke Test",
    tableQrToken: initialToken,
    idempotencyKey: idemKey,
  }, { "x-idempotency-key": idemKey, "x-restaurant-slug": SLUG });
  check("idempotent re-submit returns 200 (not 201)", r.status === 200, r);
  check("same order id returned", r.data?.id === orderId, { got: r.data?.id, want: orderId });

  // ── 7. Rotate QR ──
  console.log("Step 7: rotate QR token");
  r = await http("POST", `/api/tables/${tableId}/qr/rotate`, null, adminHeaders);
  check("rotate 200", r.status === 200, r);
  check("new token differs", r.data?.qrToken !== initialToken, { got: r.data?.qrToken?.slice(0, 8), want: initialToken?.slice(0, 8) });
  check("version incremented", r.data?.qrVersion === 2, r.data?.qrVersion);
  const newToken = r.data?.qrToken;

  // ── 8. Old QR must be rejected ──
  console.log("Step 8: old QR rejected");
  r = await http("GET", `/api/qr/table/${initialToken}`);
  check("old QR returns 404 or 410", [404, 410].includes(r.status), r);

  // ── 9. New QR must work ──
  console.log("Step 9: new QR works");
  r = await http("GET", `/api/qr/table/${newToken}`);
  check("new QR 200", r.status === 200, r);
  check("new QR resolves same table", r.data?.table?.number === tableNumber, r.data?.table);

  // ── 10. Disable table ──
  console.log("Step 10: disable table");
  r = await http("PATCH", `/api/tables/${tableId}`, { active: false, qrEnabled: false }, adminHeaders);
  check("disable 200", r.status === 200, r);

  // ── 11. Order from disabled table must fail ──
  console.log("Step 11: order from disabled table rejected");
  r = await http("POST", "/api/orders", {
    items: JSON.stringify([{ name: "Smoke Test Item", price: 5000, qty: 1 }]),
    total: 5000,
    orderType: "dine_in",
    customerName: "Smoke Test (should fail)",
    tableQrToken: newToken,
    idempotencyKey: crypto.randomUUID(),
  }, { "x-idempotency-key": crypto.randomUUID(), "x-restaurant-slug": SLUG });
  check("disabled table order rejected (400/403)", [400, 403].includes(r.status), r);

  // ── 12. Cleanup ──
  console.log("Step 12: cleanup");
  // Re-enable so DELETE can succeed (will soft-delete since we have an order)
  await http("PATCH", `/api/tables/${tableId}`, { active: true }, adminHeaders);
  r = await http("DELETE", `/api/tables/${tableId}`, null, adminHeaders);
  check("cleanup delete 200", r.status === 200, r);

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
