#!/usr/bin/env python3
"""Blocking production-contract E2E for KFM Delice.

This scenario deliberately has no SAFE/SKIP mode. A missing seed, broken schema,
invalid login, incompatible /api/orders payload or broken idempotency exits 1.
"""

import json
import os
import sys
import uuid
import urllib.error
import urllib.request

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
ADMIN_EMAIL = os.environ.get("E2E_ADMIN_EMAIL", "admin@kfm-delice.com")
ADMIN_PASSWORD = os.environ.get("E2E_ADMIN_PASSWORD", "AdminKFM2026!")
SLUG = os.environ.get("E2E_SLUG", "kfm-delice")


def request(method, path, body=None, headers=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    merged = {"Accept": "application/json"}
    if body is not None:
        merged["Content-Type"] = "application/json"
    if headers:
        merged.update(headers)
    req = urllib.request.Request(
        f"{BASE_URL}{path}", data=data, headers=merged, method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = raw
        return exc.code, parsed


def require(condition, message, detail=None):
    if condition:
        print(f"[PASS] {message}")
        return
    print(f"[FAIL] {message}")
    if detail is not None:
        print(json.dumps(detail, ensure_ascii=False, indent=2, default=str))
    raise AssertionError(message)


def main():
    table_id = None
    try:
        status, data = request("GET", "/api/ready")
        require(status == 200 and isinstance(data, dict) and data.get("status") == "ready",
                "database readiness", {"status": status, "data": data})

        status, login = request("POST", "/api/login", {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
        })
        require(status == 200 and isinstance(login, dict) and login.get("token"),
                "admin login", {"status": status, "data": login})
        admin_headers = {
            "Authorization": f"Bearer {login['token']}",
            "x-restaurant-slug": SLUG,
        }

        status, menu = request("GET", f"/api/menu?slug={SLUG}&limit=100", headers={
            "x-restaurant-slug": SLUG,
        })
        menu_items = menu if isinstance(menu, list) else (menu or {}).get("data", [])
        available = [item for item in menu_items if item.get("available", True) and item.get("id")]
        require(status == 200 and len(available) > 0,
                "seeded menu item available", {"status": status, "count": len(available)})
        menu_item_id = available[0]["id"]

        table_number = f"CI-{uuid.uuid4().hex[:8].upper()}"
        status, table = request("POST", "/api/tables", {
            "name": f"CI Contract {table_number}",
            "number": table_number,
            "capacity": 2,
            "zone": "CI",
        }, headers=admin_headers)
        require(status == 201 and isinstance(table, dict) and table.get("id") and table.get("qrToken"),
                "QR table creation", {"status": status, "data": table})
        table_id = table["id"]
        qr_token = table["qrToken"]

        idempotency_key = f"ci-contract-{uuid.uuid4()}"
        order_body = {
            "items": [{"menuItemId": menu_item_id, "quantity": 1}],
            "orderType": "dine_in",
            "customerName": "CI Contract Client",
            "paymentMethod": "cash",
            "tableQrToken": qr_token,
            "idempotencyKey": idempotency_key,
            "note": "production-contract-e2e",
        }
        status, order = request("POST", "/api/orders", order_body, headers={
            "x-restaurant-slug": SLUG,
        })
        require(status == 201 and isinstance(order, dict) and order.get("id"),
                "strict public order creation", {"status": status, "data": order})
        require(order.get("tableId") == table_id or order.get("tableNumberStr") == table_number,
                "order is scoped to QR table", order)
        require(int(order.get("total", 0)) > 0,
                "server computed a positive order total", order)

        status, replay = request("POST", "/api/orders", order_body, headers={
            "x-restaurant-slug": SLUG,
        })
        require(status == 200 and isinstance(replay, dict) and replay.get("id") == order.get("id"),
                "order idempotency replay", {"status": status, "data": replay})

        tampered = dict(order_body)
        tampered["items"] = [{"menuItemId": menu_item_id, "quantity": 2}]
        status, mismatch = request("POST", "/api/orders", tampered, headers={
            "x-restaurant-slug": SLUG,
        })
        require(status == 409 and isinstance(mismatch, dict) and mismatch.get("code") == "IDEMPOTENCY_HASH_MISMATCH",
                "idempotency rejects changed payload", {"status": status, "data": mismatch})

        print("[PASS] production contract E2E complete")
        return 0
    except Exception as exc:
        print(f"[FAIL] production contract E2E aborted: {exc}")
        return 1
    finally:
        if table_id:
            # Best-effort cleanup. Failure here does not hide an earlier result.
            try:
                status, login = request("POST", "/api/login", {
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD,
                })
                if status == 200 and isinstance(login, dict) and login.get("token"):
                    request("DELETE", f"/api/tables/{table_id}", headers={
                        "Authorization": f"Bearer {login['token']}",
                        "x-restaurant-slug": SLUG,
                    })
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
