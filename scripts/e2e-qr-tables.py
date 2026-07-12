#!/usr/bin/env python3
"""
e2e-qr-tables.py — End-to-end test for Mission 11 (QR code table ordering)

Scénario:
  1. login admin
  2. créer table E2E
  3. récupérer/générer QR
  4. appeler URL QR (GET /api/qr/table/[token])
  5. vérifier restaurant et table résolus
  6. créer commande dine_in depuis la table
  7. vérifier que commande contient la bonne table
  8. vérifier qu'elle apparaît dans le dashboard restaurant (GET /api/orders)
  9. faire une rotation QR
 10. vérifier ancien QR refusé (410)
 11. vérifier nouveau QR valide
 12. désactiver la table
 13. vérifier nouvelle commande refusée (400)
 14. nettoyer uniquement les données E2E

Variables d'environnement requises:
  BASE_URL              — URL de l'app (https://kfm-delice-ggb4.onrender.com ou http://localhost:3000)
  E2E_ADMIN_EMAIL       — email admin
  E2E_ADMIN_PASSWORD    — mot de passe admin
  E2E_SLUG              — slug du restaurant (ex: kfm-delice)

Optionnel:
  E2E_SAFE_MODE=true    — ne pas échouer si certaines étapes échouent (default: false)

Sortie:
  artifacts/e2e-qr-tables-report.json — rapport portable JSON
"""

import json
import os
import sys
import time
import uuid
import urllib.request
import urllib.error
from datetime import datetime

# ────────────────────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────────────────────

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
E2E_ADMIN_EMAIL = os.environ.get("E2E_ADMIN_EMAIL", "admin@kfm-delice.com")
E2E_ADMIN_PASSWORD = os.environ.get("E2E_ADMIN_PASSWORD", "AdminKFM2026!")
E2E_SLUG = os.environ.get("E2E_SLUG", "kfm-delice")
E2E_SAFE_MODE = os.environ.get("E2E_SAFE_MODE", "false").lower() == "true"

REPORT_PATH = "artifacts/e2e-qr-tables-report.json"

# ────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────

def log(msg, level="INFO"):
    print(f"[{level}] {msg}")

def http_request(method, path, body=None, headers=None, expect_status=None):
    url = f"{BASE_URL}{path}"
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8")
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = raw
            return status, parsed
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        if expect_status and status != expect_status:
            log(f"HTTP {status} (expected {expect_status}) on {method} {path}: {raw[:300]}", "WARN")
        return status, parsed
    except Exception as e:
        log(f"NETWORK ERROR on {method} {path}: {e}", "ERROR")
        return 0, {"error": str(e)}

# ────────────────────────────────────────────────────────────────
# Test runner
# ────────────────────────────────────────────────────────────────

def run():
    report = {
        "scenario": "Mission 11 — QR code table ordering",
        "baseUrl": BASE_URL,
        "slug": E2E_SLUG,
        "startedAt": datetime.utcnow().isoformat() + "Z",
        "steps": [],
        "summary": {"passed": 0, "failed": 0, "skipped": 0},
        "result": "PENDING",
        "errors": [],
    }

    def step(name, ok, detail=None):
        status = "PASS" if ok else "FAIL"
        if not ok and E2E_SAFE_MODE:
            status = "SKIP"
        report["steps"].append({
            "name": name,
            "status": status,
            "detail": detail or {},
        })
        if ok:
            report["summary"]["passed"] += 1
        elif E2E_SAFE_MODE:
            report["summary"]["skipped"] += 1
        else:
            report["summary"]["failed"] += 1
        log(f"{status}: {name}")
        return ok

    admin_token = None
    test_table_number = f"E2E-{uuid.uuid4().hex[:6].upper()}"
    table_id = None
    qr_url = None
    initial_qr_token = None
    initial_qr_version = None
    rotated_qr_token = None
    created_order_id = None

    # ── Step 1: admin login ──
    log("Step 1: admin login")
    status, data = http_request(
        "POST",
        "/api/login",
        body={"email": E2E_ADMIN_EMAIL, "password": E2E_ADMIN_PASSWORD},
    )
    if status == 200 and isinstance(data, dict) and data.get("token"):
        admin_token = data["token"]
        step("admin_login", True, {"email": E2E_ADMIN_EMAIL})
    else:
        step("admin_login", False, {"status": status, "data": data})
        finalize(report)
        return report

    admin_headers = {
        "Authorization": f"Bearer {admin_token}",
        "x-restaurant-slug": E2E_SLUG,
    }

    # ── Step 2: create table ──
    log(f"Step 2: create table {test_table_number}")
    status, data = http_request(
        "POST",
        "/api/tables",
        body={
            "name": f"E2E Test Table {test_table_number}",
            "number": test_table_number,
            "capacity": 4,
            "zone": "E2E",
        },
        headers=admin_headers,
    )
    if status == 201 and isinstance(data, dict) and data.get("id"):
        table_id = data["id"]
        initial_qr_token = data.get("qrToken")
        step("table_create", True, {"id": table_id, "number": test_table_number})
    elif status == 409:
        # Table already exists from previous run — try to find it
        log(f"Table {test_table_number} already exists, listing...", "WARN")
        s2, d2 = http_request("GET", "/api/tables?includeInactive=true", headers=admin_headers)
        if s2 == 200 and isinstance(d2, dict):
            for t in d2.get("data", []):
                if t.get("number") == test_table_number:
                    table_id = t["id"]
                    initial_qr_token = None  # We'll get it via the QR endpoint
                    step("table_create_reuse", True, {"id": table_id})
                    break
        if not table_id:
            step("table_create", False, {"status": status, "data": data})
            finalize(report)
            return report
    else:
        step("table_create", False, {"status": status, "data": data})
        finalize(report)
        return report

    # ── Step 3: fetch QR details ──
    log("Step 3: fetch QR details")
    status, data = http_request(
        "GET",
        f"/api/tables/{table_id}/qr",
        headers=admin_headers,
    )
    if status == 200 and isinstance(data, dict) and data.get("qrToken"):
        initial_qr_token = data["qrToken"]
        initial_qr_version = data.get("qrVersion", 1)
        qr_url = data.get("qrUrl")
        step("qr_fetch", True, {"qrVersion": initial_qr_version, "qrUrl": qr_url})
    else:
        step("qr_fetch", False, {"status": status, "data": data})
        finalize(report)
        return report

    # ── Step 4: public QR resolution ──
    log("Step 4: resolve QR via public endpoint")
    status, data = http_request(
        "GET",
        f"/api/qr/table/{initial_qr_token}",
        headers={"Accept": "application/json"},
    )
    if status == 200 and isinstance(data, dict):
        ok = (
            data.get("restaurant", {}).get("slug") == E2E_SLUG
            and data.get("table", {}).get("number") == test_table_number
        )
        step("qr_public_resolve", ok, {
            "restaurant": data.get("restaurant"),
            "table": data.get("table"),
        })
        if not ok and not E2E_SAFE_MODE:
            finalize(report)
            return report
    else:
        step("qr_public_resolve", False, {"status": status, "data": data})
        finalize(report)
        return report

    # ── Step 5: create dine_in order from table ──
    log("Step 5: create dine_in order via table QR token")
    order_body = {
        "items": json.dumps([{"name": "E2E Test Item", "price": 5000, "qty": 1}]),
        "total": 5000,
        "orderType": "dine_in",
        "customerName": "E2E QR Test",
        "tableQrToken": initial_qr_token,
    }
    status, data = http_request(
        "POST",
        "/api/orders",
        body=order_body,
        headers={"x-restaurant-slug": E2E_SLUG, "Content-Type": "application/json"},
    )
    if status in (200, 201) and isinstance(data, dict) and data.get("id"):
        created_order_id = data["id"]
        # Verify the order has the table info attached
        ok = data.get("tableNumberStr") == test_table_number or data.get("tableId") == table_id
        step("table_order_create", ok, {
            "orderId": created_order_id,
            "tableId": data.get("tableId"),
            "tableNumberStr": data.get("tableNumberStr"),
        })
        if not ok and not E2E_SAFE_MODE:
            finalize(report)
            return report
    else:
        step("table_order_create", False, {"status": status, "data": data})
        finalize(report)
        return report

    # ── Step 6: verify order appears in dashboard ──
    log("Step 6: verify order appears in admin dashboard")
    status, data = http_request(
        "GET",
        f"/api/orders?limit=20",
        headers=admin_headers,
    )
    if status == 200 and isinstance(data, dict):
        orders = data.get("data", [])
        found = any(o.get("id") == created_order_id for o in orders)
        step("order_in_dashboard", found, {
            "orderId": created_order_id,
            "totalOrders": len(orders),
        })
    else:
        step("order_in_dashboard", False, {"status": status, "data": data})

    # ── Step 7: rotate QR ──
    log("Step 7: rotate QR token")
    status, data = http_request(
        "POST",
        f"/api/tables/{table_id}/qr/rotate",
        headers=admin_headers,
    )
    if status == 200 and isinstance(data, dict) and data.get("qrToken"):
        rotated_qr_token = data["qrToken"]
        new_version = data.get("qrVersion")
        ok = (
            rotated_qr_token != initial_qr_token
            and new_version == (initial_qr_version or 1) + 1
        )
        step("qr_rotate", ok, {
            "newVersion": new_version,
            "newTokenPreview": rotated_qr_token[:8] + "...",
        })
    else:
        step("qr_rotate", False, {"status": status, "data": data})
        rotated_qr_token = None

    # ── Step 8: old QR should be rejected ──
    log("Step 8: verify old QR token rejected")
    if initial_qr_token and rotated_qr_token:
        status, data = http_request(
            "GET",
            f"/api/qr/table/{initial_qr_token}",
            headers={"Accept": "application/json"},
        )
        # We expect 404 (token no longer in DB because rotation replaced it)
        # OR 410 (token still in DB but qrEnabled=false).
        ok = status in (404, 410)
        step("old_qr_rejected", ok, {
            "status": status,
            "code": data.get("code") if isinstance(data, dict) else None,
        })
    else:
        step("old_qr_rejected", False, {"reason": "missing tokens"})

    # ── Step 9: new QR should work ──
    log("Step 9: verify new QR token works")
    if rotated_qr_token:
        status, data = http_request(
            "GET",
            f"/api/qr/table/{rotated_qr_token}",
            headers={"Accept": "application/json"},
        )
        ok = (
            status == 200
            and isinstance(data, dict)
            and data.get("restaurant", {}).get("slug") == E2E_SLUG
            and data.get("table", {}).get("number") == test_table_number
        )
        step("new_qr_valid", ok, {
            "status": status,
            "restaurant": data.get("restaurant") if isinstance(data, dict) else None,
        })
    else:
        step("new_qr_valid", False, {"reason": "no rotated token"})

    # ── Step 10: disable table ──
    log("Step 10: disable table")
    status, data = http_request(
        "PATCH",
        f"/api/tables/{table_id}",
        body={"active": False, "qrEnabled": False},
        headers=admin_headers,
    )
    step("table_disable", status == 200, {"status": status})

    # ── Step 11: new order from disabled table should fail ──
    log("Step 11: verify order from disabled table rejected")
    if rotated_qr_token:
        order_body_fail = {
            "items": json.dumps([{"name": "E2E Test Item", "price": 5000, "qty": 1}]),
            "total": 5000,
            "orderType": "dine_in",
            "customerName": "E2E QR Test (should fail)",
            "tableQrToken": rotated_qr_token,
        }
        status, data = http_request(
            "POST",
            "/api/orders",
            body=order_body_fail,
            headers={"x-restaurant-slug": E2E_SLUG, "Content-Type": "application/json"},
        )
        ok = status in (400, 403)
        step("disabled_table_order_rejected", ok, {
            "status": status,
            "code": data.get("code") if isinstance(data, dict) else None,
        })
    else:
        step("disabled_table_order_rejected", False, {"reason": "no rotated token"})

    # ── Step 12: cleanup ──
    log("Step 12: cleanup — delete test table")
    if table_id:
        # Re-enable first so DELETE can hard-delete (no orders reference if we never got the order created),
        # otherwise it will soft-delete (which is fine too).
        http_request(
            "PATCH",
            f"/api/tables/{table_id}",
            body={"active": True},
            headers=admin_headers,
        )
        status, data = http_request(
            "DELETE",
            f"/api/tables/{table_id}",
            headers=admin_headers,
        )
        step("cleanup_table_delete", status in (200, 204), {"status": status, "mode": data.get("mode") if isinstance(data, dict) else None})

    # ── Finalize ──
    failed = report["summary"]["failed"]
    report["result"] = "PASS" if failed == 0 else "FAIL"
    report["finishedAt"] = datetime.utcnow().isoformat() + "Z"
    finalize(report)
    return report


def finalize(report):
    os.makedirs(os.path.dirname(REPORT_PATH) or ".", exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    log(f"Report written to {REPORT_PATH}")
    log(f"Result: {report['result']} — {report['summary']}")


if __name__ == "__main__":
    report = run()
    if report["result"] == "FAIL":
        sys.exit(1)
    sys.exit(0)
