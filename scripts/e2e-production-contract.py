#!/usr/bin/env python3
"""
Strict production contract E2E for KFM Delice.

This test is intentionally fail-closed. There is no SAFE_MODE and no PENDING
result: a missing seed, failed login, invalid public-order contract, duplicate
terminal side effects or broken QR flow returns exit code 1 and blocks CI.

Coverage:
  1. Liveness endpoint
  2. Seeded admin + customer login
  3. Real menu item discovery
  4. Strict server-authoritative public order creation
  5. Order idempotency replay + hash mismatch protection
  6. Admin order visibility
  7. Delivered transition side effects happen exactly once
  8. Replay of delivered is idempotent (no double earnings/loyalty/invoice)
  9. QR table create / resolve / rotate / old-token rejection
 10. Table cleanup
"""

import json
import math
import os
import sys
import uuid
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
E2E_ADMIN_EMAIL = os.environ.get("E2E_ADMIN_EMAIL", "admin@kfm-delice.com")
E2E_ADMIN_PASSWORD = os.environ.get("E2E_ADMIN_PASSWORD", "kfm2024")
E2E_CUSTOMER_EMAIL = os.environ.get("E2E_CUSTOMER_EMAIL", "aminata@gmail.com")
E2E_CUSTOMER_PASSWORD = os.environ.get("E2E_CUSTOMER_PASSWORD", "client123")
E2E_SLUG = os.environ.get("E2E_SLUG", "kfm-delice")
REPORT_PATH = os.environ.get("E2E_REPORT_PATH", "artifacts/e2e-production-contract-report.json")


def log(message, level="INFO"):
    print(f"[{level}] {message}")


def request(method, path, body=None, headers=None, timeout=30):
    url = f"{BASE_URL}{path}"
    final_headers = {"Accept": "application/json"}
    if body is not None:
        final_headers["Content-Type"] = "application/json"
    if headers:
        final_headers.update(headers)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=final_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            try:
                parsed = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed = raw
            return response.status, parsed
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = raw
        return exc.code, parsed
    except Exception as exc:  # network / timeout
        return 0, {"error": str(exc)}


def find_by_id(rows, row_id):
    return next((row for row in rows if isinstance(row, dict) and row.get("id") == row_id), None)


def find_by_email(rows, email):
    return next((row for row in rows if isinstance(row, dict) and row.get("email") == email), None)


def list_data(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("data"), list):
        return data["data"]
    return []


def run():
    report = {
        "scenario": "KFM Delice strict production contract",
        "baseUrl": BASE_URL,
        "slug": E2E_SLUG,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "steps": [],
        "summary": {"passed": 0, "failed": 0, "total": 0},
        "result": "FAIL",
    }

    def step(name, ok, detail=None):
        report["steps"].append({
            "name": name,
            "status": "PASS" if ok else "FAIL",
            "detail": detail or {},
        })
        report["summary"]["total"] += 1
        report["summary"]["passed" if ok else "failed"] += 1
        log(f"{'PASS' if ok else 'FAIL'}: {name}")
        return ok

    table_id = None

    try:
        # 1. Server liveness
        status, data = request("GET", "/api/status")
        if not step(
            "server_status",
            status == 200 and isinstance(data, dict) and data.get("status") == "ok",
            {"status": status},
        ):
            return finalize(report)

        # 2a. Seeded admin login — MUST pass, never skip.
        status, data = request("POST", "/api/login", {
            "email": E2E_ADMIN_EMAIL,
            "password": E2E_ADMIN_PASSWORD,
        })
        if not step(
            "admin_login",
            status == 200 and isinstance(data, dict) and bool(data.get("token")),
            {"status": status, "email": E2E_ADMIN_EMAIL, "response": data if status != 200 else None},
        ):
            return finalize(report)

        admin_token = data["token"]
        admin_headers = {
            "Authorization": f"Bearer {admin_token}",
            "x-restaurant-slug": E2E_SLUG,
        }
        public_headers = {"x-restaurant-slug": E2E_SLUG}

        # 2b. Seeded customer login — validates tenant-scoped customer relation.
        status, customer_login = request("POST", "/api/customer-login", {
            "email": E2E_CUSTOMER_EMAIL,
            "password": E2E_CUSTOMER_PASSWORD,
        }, headers=public_headers)
        if not step(
            "customer_login",
            status == 200 and isinstance(customer_login, dict) and bool(customer_login.get("token")),
            {"status": status, "email": E2E_CUSTOMER_EMAIL, "response": customer_login if status != 200 else None},
        ):
            return finalize(report)

        customer_token = customer_login["token"]
        customer_id = customer_login["id"]
        customer_headers = {
            "Authorization": f"Bearer {customer_token}",
            "x-restaurant-slug": E2E_SLUG,
        }

        # 3. Discover a REAL menu item. No fake name/price payload is allowed.
        status, data = request("GET", f"/api/menu?slug={E2E_SLUG}&limit=100", headers=public_headers)
        menu = [item for item in list_data(data) if isinstance(item, dict) and item.get("id") and item.get("available", True)]
        if not step("menu_item_discovery", status == 200 and len(menu) > 0, {"status": status, "count": len(menu)}):
            return finalize(report)

        item = menu[0]
        item_price = max(1, int(item.get("price") or 1))
        # Delivery avoids time-of-day coupling in CI. Seed minDelivery is 15k GNF.
        quantity = max(1, min(99, math.ceil(15000 / item_price)))
        idem_key = f"ci-order-{uuid.uuid4().hex}"
        strict_order = {
            "items": [{"menuItemId": item["id"], "quantity": quantity}],
            "orderType": "delivery",
            "customerName": "CI Contract Client",
            "phone": "+224620000001",
            "deliveryAddress": "Kaloum, Conakry",
            "paymentMethod": "cash",
            "note": "CI strict contract",
            "idempotencyKey": idem_key,
        }

        # 4. Strict public order creation.
        status, order = request("POST", "/api/orders", strict_order, headers=public_headers)
        order_ok = status == 201 and isinstance(order, dict) and bool(order.get("id"))
        if not step(
            "strict_public_order_create",
            order_ok,
            {"status": status, "response": order if not order_ok else {"id": order.get("id"), "total": order.get("total")}},
        ):
            return finalize(report)
        order_id = order["id"]

        # 5a. Same idempotency key + same payload must return same order.
        replay_status, replay = request("POST", "/api/orders", strict_order, headers=public_headers)
        replay_ok = replay_status == 200 and isinstance(replay, dict) and replay.get("id") == order_id
        step("order_idempotency_replay", replay_ok, {"status": replay_status, "orderId": replay.get("id") if isinstance(replay, dict) else None})

        # 5b. Same key + changed quantity must be rejected.
        changed_order = dict(strict_order)
        changed_order["items"] = [{"menuItemId": item["id"], "quantity": min(99, quantity + 1)}]
        mismatch_status, mismatch = request("POST", "/api/orders", changed_order, headers=public_headers)
        mismatch_ok = mismatch_status == 409 and isinstance(mismatch, dict) and mismatch.get("code") == "IDEMPOTENCY_HASH_MISMATCH"
        step("order_idempotency_hash_mismatch", mismatch_ok, {"status": mismatch_status, "code": mismatch.get("code") if isinstance(mismatch, dict) else None})

        # 6. The same order must be visible to its restaurant admin.
        status, orders_data = request("GET", "/api/orders?limit=100", headers=admin_headers)
        orders = list_data(orders_data)
        visible = any(isinstance(row, dict) and row.get("id") == order_id for row in orders)
        step("order_visible_in_admin_scope", status == 200 and visible, {"status": status, "orderId": order_id})

        # 7. Terminal transition idempotency with real customer + driver side effects.
        status, customers_before_data = request("GET", "/api/customers?limit=100", headers=admin_headers)
        customers_before = list_data(customers_before_data)
        customer_before = find_by_id(customers_before, customer_id) or find_by_email(customers_before, E2E_CUSTOMER_EMAIL)

        status_drivers, drivers_before_data = request("GET", "/api/drivers?limit=100", headers=admin_headers)
        drivers_before = list_data(drivers_before_data)
        available_drivers = [d for d in drivers_before if isinstance(d, dict) and d.get("id") and d.get("status") == "available"]
        drivers_with_id = [d for d in drivers_before if isinstance(d, dict) and d.get("id")]
        driver_before = available_drivers[0] if available_drivers else (drivers_with_id[0] if drivers_with_id else None)

        status_invoices, invoices_before_data = request("GET", "/api/invoices?limit=100", headers=admin_headers)
        invoices_before = list_data(invoices_before_data)

        baseline_ok = (
            status == 200
            and customer_before is not None
            and status_drivers == 200
            and driver_before is not None
            and status_invoices == 200
        )
        if not step(
            "terminal_side_effect_baseline",
            baseline_ok,
            {"customer": bool(customer_before), "driver": bool(driver_before), "invoiceStatus": status_invoices},
        ):
            return finalize(report)

        customer_order_payload = {
            "items": [{"menuItemId": item["id"], "quantity": quantity}],
            "orderType": "delivery",
            "customerName": customer_login.get("name") or "CI Customer",
            "phone": customer_login.get("phone") or "+224620000002",
            "deliveryAddress": "Dixinn, Conakry",
            "paymentMethod": "cash",
            "note": "CI terminal transition",
            "idempotencyKey": f"ci-terminal-{uuid.uuid4().hex}",
        }
        status, transition_order = request("POST", "/api/orders", customer_order_payload, headers=customer_headers)
        if not step(
            "customer_order_create_for_transition",
            status == 201 and isinstance(transition_order, dict) and transition_order.get("customerId") == customer_id,
            {"status": status, "customerId": transition_order.get("customerId") if isinstance(transition_order, dict) else None},
        ):
            return finalize(report)

        transition_order_id = transition_order["id"]
        transition_total = int(transition_order.get("total") or 0)
        driver_id = driver_before["id"]

        transitions = [
            ("confirmed", {"driverId": driver_id}),
            ("preparing", {}),
            ("ready", {}),
            ("delivered", {}),
        ]
        transition_flow_ok = True
        transition_details = []
        for target_status, extra in transitions:
            patch_status, patch_data = request("PATCH", "/api/orders", {
                "id": transition_order_id,
                "status": target_status,
                **extra,
            }, headers=admin_headers)
            ok = patch_status == 200 and isinstance(patch_data, dict) and patch_data.get("status") == target_status
            transition_flow_ok = transition_flow_ok and ok
            transition_details.append({"target": target_status, "http": patch_status, "ok": ok})
        if not step("order_transition_to_delivered", transition_flow_ok, {"transitions": transition_details}):
            return finalize(report)

        # Capture first-delivery effects.
        _, customers_after_data = request("GET", "/api/customers?limit=100", headers=admin_headers)
        customer_after = find_by_id(list_data(customers_after_data), customer_id)
        _, drivers_after_data = request("GET", "/api/drivers?limit=100", headers=admin_headers)
        driver_after = find_by_id(list_data(drivers_after_data), driver_id)
        _, invoices_after_data = request("GET", "/api/invoices?limit=100", headers=admin_headers)
        invoices_after = list_data(invoices_after_data)

        before_total_orders = int(customer_before.get("totalOrders") or 0)
        after_total_orders = int(customer_after.get("totalOrders") or 0) if customer_after else -1
        before_total_spent = int(customer_before.get("totalSpent") or 0)
        after_total_spent = int(customer_after.get("totalSpent") or 0) if customer_after else -1
        before_deliveries = int(driver_before.get("totalDeliveries") or 0)
        after_deliveries = int(driver_after.get("totalDeliveries") or 0) if driver_after else -1
        before_earnings = int(driver_before.get("totalEarnings") or 0)
        after_earnings = int(driver_after.get("totalEarnings") or 0) if driver_after else -1
        invoice_count_before = sum(1 for invoice in invoices_before if isinstance(invoice, dict) and invoice.get("orderId") == transition_order_id)
        invoice_count_after = sum(1 for invoice in invoices_after if isinstance(invoice, dict) and invoice.get("orderId") == transition_order_id)

        first_effects_ok = (
            customer_after is not None
            and driver_after is not None
            and after_total_orders == before_total_orders + 1
            and after_total_spent == before_total_spent + transition_total
            and after_deliveries == before_deliveries + 1
            and after_earnings >= before_earnings
            and invoice_count_after == invoice_count_before + 1
        )
        if not step(
            "delivered_side_effects_once",
            first_effects_ok,
            {
                "customerOrders": [before_total_orders, after_total_orders],
                "customerSpent": [before_total_spent, after_total_spent],
                "driverDeliveries": [before_deliveries, after_deliveries],
                "driverEarnings": [before_earnings, after_earnings],
                "invoiceCount": [invoice_count_before, invoice_count_after],
            },
        ):
            return finalize(report)

        # 8. Replay the terminal status. Must return 200 but produce NO effect.
        replay_status, replay_delivery = request("PATCH", "/api/orders", {
            "id": transition_order_id,
            "status": "delivered",
        }, headers=admin_headers)
        replay_delivery_ok = replay_status == 200 and isinstance(replay_delivery, dict) and replay_delivery.get("status") == "delivered"
        step("delivered_replay_accepted_idempotently", replay_delivery_ok, {"status": replay_status})

        _, customers_replay_data = request("GET", "/api/customers?limit=100", headers=admin_headers)
        customer_replay = find_by_id(list_data(customers_replay_data), customer_id)
        _, drivers_replay_data = request("GET", "/api/drivers?limit=100", headers=admin_headers)
        driver_replay = find_by_id(list_data(drivers_replay_data), driver_id)
        _, invoices_replay_data = request("GET", "/api/invoices?limit=100", headers=admin_headers)
        invoices_replay = list_data(invoices_replay_data)
        invoice_count_replay = sum(1 for invoice in invoices_replay if isinstance(invoice, dict) and invoice.get("orderId") == transition_order_id)

        replay_no_effect_ok = (
            customer_replay is not None
            and driver_replay is not None
            and int(customer_replay.get("totalOrders") or 0) == after_total_orders
            and int(customer_replay.get("totalSpent") or 0) == after_total_spent
            and int(customer_replay.get("loyaltyPoints") or 0) == int(customer_after.get("loyaltyPoints") or 0)
            and int(driver_replay.get("totalDeliveries") or 0) == after_deliveries
            and int(driver_replay.get("totalEarnings") or 0) == after_earnings
            and invoice_count_replay == invoice_count_after
        )
        step(
            "delivered_replay_has_no_duplicate_effects",
            replay_no_effect_ok,
            {
                "customerOrders": [after_total_orders, int(customer_replay.get("totalOrders") or -1) if customer_replay else None],
                "driverDeliveries": [after_deliveries, int(driver_replay.get("totalDeliveries") or -1) if driver_replay else None],
                "invoiceCount": [invoice_count_after, invoice_count_replay],
            },
        )

        # 9. QR table lifecycle.
        table_number = f"CI-{uuid.uuid4().hex[:8].upper()}"
        status, table = request("POST", "/api/tables", {
            "name": f"CI Contract {table_number}",
            "number": table_number,
            "capacity": 4,
            "zone": "CI",
        }, headers=admin_headers)
        table_ok = status == 201 and isinstance(table, dict) and bool(table.get("id")) and bool(table.get("qrToken"))
        if not step("qr_table_create", table_ok, {"status": status, "response": table if not table_ok else {"id": table.get("id")}}):
            return finalize(report)

        table_id = table["id"]
        initial_qr_token = table["qrToken"]

        status, resolved = request("GET", f"/api/qr/table/{initial_qr_token}")
        resolve_ok = (
            status == 200
            and isinstance(resolved, dict)
            and resolved.get("restaurant", {}).get("slug") == E2E_SLUG
            and resolved.get("table", {}).get("number") == table_number
        )
        step("qr_public_resolve", resolve_ok, {"status": status})

        status, rotated = request("POST", f"/api/tables/{table_id}/qr/rotate", headers=admin_headers)
        rotate_ok = status == 200 and isinstance(rotated, dict) and rotated.get("qrToken") and rotated.get("qrToken") != initial_qr_token
        step("qr_rotate", bool(rotate_ok), {"status": status})
        if rotate_ok:
            rotated_qr_token = rotated["qrToken"]

            old_status, _ = request("GET", f"/api/qr/table/{initial_qr_token}")
            step("qr_old_token_rejected", old_status in (404, 410), {"status": old_status})

            new_status, new_resolved = request("GET", f"/api/qr/table/{rotated_qr_token}")
            new_ok = (
                new_status == 200
                and isinstance(new_resolved, dict)
                and new_resolved.get("table", {}).get("number") == table_number
            )
            step("qr_new_token_valid", new_ok, {"status": new_status})

        # 10. Cleanup table in ephemeral CI DB (also validates DELETE auth/scope).
        status, cleanup = request("DELETE", f"/api/tables/{table_id}", headers=admin_headers)
        cleanup_ok = status in (200, 204)
        step("qr_table_cleanup", cleanup_ok, {"status": status, "mode": cleanup.get("mode") if isinstance(cleanup, dict) else None})
        if cleanup_ok:
            table_id = None

    finally:
        # Best-effort cleanup if an intermediate assertion failed after table creation.
        if table_id:
            try:
                headers = locals().get("admin_headers")
                if headers:
                    request("DELETE", f"/api/tables/{table_id}", headers=headers)
            except Exception:
                pass

    return finalize(report)


def finalize(report):
    report["finishedAt"] = datetime.now(timezone.utc).isoformat()
    report["result"] = "PASS" if report["summary"]["failed"] == 0 and report["summary"]["total"] > 0 else "FAIL"
    os.makedirs(os.path.dirname(REPORT_PATH) or ".", exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
    log(f"Report written to {REPORT_PATH}")
    log(f"Result: {report['result']} — {report['summary']}")
    return report


if __name__ == "__main__":
    result = run()
    sys.exit(0 if result["result"] == "PASS" else 1)
