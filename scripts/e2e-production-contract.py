#!/usr/bin/env python3
"""
Strict production contract E2E for KFM Delice.

This test is intentionally fail-closed. There is no SAFE_MODE and no PENDING
result: a missing seed, failed login, invalid public-order contract or broken
QR flow returns exit code 1 and blocks CI.

Coverage:
  1. Liveness endpoint
  2. Seeded admin login
  3. Real menu item discovery
  4. Strict server-authoritative public order creation
  5. Order idempotency replay + hash mismatch protection
  6. Admin order visibility
  7. QR table create / resolve / rotate / old-token rejection
  8. Table cleanup
"""

import json
import math
import os
import sys
import time
import uuid
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
E2E_ADMIN_EMAIL = os.environ.get("E2E_ADMIN_EMAIL", "admin@kfm-delice.com")
E2E_ADMIN_PASSWORD = os.environ.get("E2E_ADMIN_PASSWORD", "kfm2024")
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
    initial_qr_token = None
    rotated_qr_token = None

    try:
        # 1. Server liveness
        status, data = request("GET", "/api/status")
        if not step(
            "server_status",
            status == 200 and isinstance(data, dict) and data.get("status") == "ok",
            {"status": status},
        ):
            return finalize(report)

        # 2. Seeded admin login — MUST pass, never skip.
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

        token = data["token"]
        admin_headers = {
            "Authorization": f"Bearer {token}",
            "x-restaurant-slug": E2E_SLUG,
        }
        public_headers = {"x-restaurant-slug": E2E_SLUG}

        # 3. Discover a REAL menu item. No fake name/price payload is allowed.
        status, data = request("GET", f"/api/menu?slug={E2E_SLUG}&limit=100", headers=public_headers)
        menu = data if isinstance(data, list) else (data or {}).get("data", []) if isinstance(data, dict) else []
        menu = [item for item in menu if isinstance(item, dict) and item.get("id") and item.get("available", True)]
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
        orders = orders_data.get("data", []) if isinstance(orders_data, dict) else []
        visible = any(isinstance(row, dict) and row.get("id") == order_id for row in orders)
        step("order_visible_in_admin_scope", status == 200 and visible, {"status": status, "orderId": order_id})

        # 7. QR table lifecycle.
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

        # 8. Cleanup table in ephemeral CI DB (also validates DELETE auth/scope).
        status, cleanup = request("DELETE", f"/api/tables/{table_id}", headers=admin_headers)
        cleanup_ok = status in (200, 204)
        step("qr_table_cleanup", cleanup_ok, {"status": status, "mode": cleanup.get("mode") if isinstance(cleanup, dict) else None})
        if cleanup_ok:
            table_id = None

    finally:
        # Best-effort cleanup if an intermediate assertion failed after table creation.
        if table_id:
            try:
                # We may not have admin_headers if login failed; guard via locals().
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
