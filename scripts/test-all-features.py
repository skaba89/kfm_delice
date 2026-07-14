#!/usr/bin/env python3
"""
test-all-features.py — Test complet de toutes les fonctionnalités KFM Delice

Teste TOUTES les features (Mission 11 + P1.1-P3.8) en un seul script :
  1. Login admin + multi-tenant
  2. Mission 11 — QR codes des tables (création, scan, rotation, commande)
  3. P2.5 — Pourboires (tip sur commande + validation max 50%)
  4. P2.6 — Codes promo (création, validation, application sur commande)
  5. P3.7 — Chat interne (envoi + récupération messages)
  6. P3.8 — Paliers fidélité (seed defaults + modification + persistence)
  7. P2.4 — Export PDF journal (téléchargement PDF valide)
  8. P1.1 — Notifications sonores (page Settings accessible)
  9. P1.3 — Raccourcis clavier (page admin accessible)
 10. Per-restaurant URL (/r/<slug>/menu accessible)
 11. Cleanup des données de test

Variables d'environnement :
  BASE_URL              URL de l'app (défaut: http://localhost:3002)
  E2E_ADMIN_EMAIL       admin email (défaut: admin@kfm-delice.com)
  E2E_ADMIN_PASSWORD    admin password (défaut: kfm2024)
  E2E_SLUG              slug du restaurant (défaut: kfm-delice)

Sortie :
  artifacts/test-all-features-report.json — rapport portable JSON
"""

import json
import os
import sys
import time
import uuid
import urllib.request
import urllib.error
from datetime import datetime

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3002").rstrip("/")
E2E_ADMIN_EMAIL = os.environ.get("E2E_ADMIN_EMAIL", "admin@kfm-delice.com")
E2E_ADMIN_PASSWORD = os.environ.get("E2E_ADMIN_PASSWORD", "kfm2024")
E2E_SLUG = os.environ.get("E2E_SLUG", "kfm-delice")
REPORT_PATH = "artifacts/test-all-features-report.json"

# ────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────

def log(msg, level="INFO"):
    print(f"[{level}] {msg}")

def http(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    data = json.dumps(body).encode("utf-8") if body is not None else None
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
        return status, parsed
    except Exception as e:
        return 0, {"error": str(e)}

# ────────────────────────────────────────────────────────────────
# Test runner
# ────────────────────────────────────────────────────────────────

def run():
    report = {
        "scenario": "Test complet — toutes les fonctionnalités KFM Delice",
        "baseUrl": BASE_URL,
        "slug": E2E_SLUG,
        "startedAt": datetime.utcnow().isoformat() + "Z",
        "steps": [],
        "summary": {"passed": 0, "failed": 0, "total": 0},
        "result": "PENDING",
    }

    def step(name, ok, detail=None):
        status = "PASS" if ok else "FAIL"
        report["steps"].append({
            "name": name,
            "status": status,
            "detail": detail or {},
        })
        if ok:
            report["summary"]["passed"] += 1
        else:
            report["summary"]["failed"] += 1
        report["summary"]["total"] += 1
        log(f"{status}: {name}")
        return ok

    # Unique IDs for test data (cleanup at the end)
    test_table_number = f"FULL-{uuid.uuid4().hex[:6].upper()}"
    test_promo_code = f"FULLTEST{uuid.uuid4().hex[:4].upper()}"
    created_table_id = None
    created_table_qr_token = None
    created_order_id = None
    created_promo_id = None

    # ── Step 0: Server health ──
    log("\n=== Step 0: Server health ===")
    status, data = http("GET", "/api/status")
    step("server_status", status == 200 and isinstance(data, dict) and data.get("status") == "ok",
         {"status": status, "data": data if isinstance(data, dict) else None})

    # ── Step 1: Admin login ──
    log("\n=== Step 1: Admin login ===")
    status, data = http("POST", "/api/login", body={
        "email": E2E_ADMIN_EMAIL,
        "password": E2E_ADMIN_PASSWORD,
    })
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

    # ── Step 2: Mission 11 — QR table creation ──
    log(f"\n=== Step 2: Mission 11 — QR table ({test_table_number}) ===")
    status, data = http("POST", "/api/tables", body={
        "name": f"Full Test Table {test_table_number}",
        "number": test_table_number,
        "capacity": 4,
        "zone": "Full Test",
    }, headers=admin_headers)
    if status == 201 and isinstance(data, dict) and data.get("id"):
        created_table_id = data["id"]
        created_table_qr_token = data.get("qrToken")
        step("table_create", True, {"id": created_table_id, "number": test_table_number})
    else:
        step("table_create", False, {"status": status, "data": data})

    # ── Step 3: Mission 11 — Public QR resolution ──
    log("\n=== Step 3: Mission 11 — Public QR resolution ===")
    if created_table_qr_token:
        status, data = http("GET", f"/api/qr/table/{created_table_qr_token}")
        ok = (
            status == 200
            and isinstance(data, dict)
            and data.get("restaurant", {}).get("slug") == E2E_SLUG
            and data.get("table", {}).get("number") == test_table_number
            # P2.6/P1: menuUrl must use per-restaurant format /r/<slug>/menu
            and data.get("menuUrl", "").startswith(f"/r/{E2E_SLUG}/menu")
        )
        step("qr_public_resolve", ok, {
            "status": status,
            "restaurant": data.get("restaurant") if isinstance(data, dict) else None,
            "menuUrl": data.get("menuUrl") if isinstance(data, dict) else None,
        })
    else:
        step("qr_public_resolve", False, {"reason": "no qr token"})

    # ── Step 4: P2.5 — Order with tip ──
    log("\n=== Step 4: P2.5 — Order with tip ===")
    status, data = http("POST", "/api/orders", body={
        "items": json.dumps([{"name": "Tip Test", "price": 20000, "qty": 1}]),
        "total": 20000,
        "tip": 2000,
        "orderType": "dine_in",
        "customerName": "Full Feature Test",
        "tableQrToken": created_table_qr_token,
        "adminOverride": True,  # bypass opening hours (admin can order anytime)
    }, headers={"x-restaurant-slug": E2E_SLUG, "Authorization": f"Bearer {admin_token}"})
    if status in (200, 201) and isinstance(data, dict) and data.get("id"):
        created_order_id = data["id"]
        ok = data.get("tip") == 2000 and data.get("total") == 20000
        step("order_with_tip", ok, {
            "orderId": created_order_id,
            "total": data.get("total"),
            "tip": data.get("tip"),
        })
    else:
        step("order_with_tip", False, {"status": status, "data": data})

    # ── Step 5: P2.5 — Tip validation (max 50%) ──
    log("\n=== Step 5: P2.5 — Tip validation (max 50%) ===")
    status, data = http("POST", "/api/orders", body={
        "items": json.dumps([{"name": "Abuse Test", "price": 1000, "qty": 1}]),
        "total": 1000,
        "tip": 10000,  # 1000% — should be clamped to 500 (50%)
        "orderType": "dine_in",
        "customerName": "Tip Abuse Test",
        "tableQrToken": created_table_qr_token,
        "adminOverride": True,
    }, headers={"x-restaurant-slug": E2E_SLUG, "Authorization": f"Bearer {admin_token}"})
    if status in (200, 201) and isinstance(data, dict):
        ok = data.get("tip") == 500  # clamped to 50% of 1000
        step("tip_clamped_50pct", ok, {
            "requestedTip": 10000,
            "actualTip": data.get("tip"),
            "expectedTip": 500,
        })
    else:
        step("tip_clamped_50pct", False, {"status": status, "data": data})

    # ── Step 6: P2.6 — Promo code creation ──
    log(f"\n=== Step 6: P2.6 — Promo code ({test_promo_code}) ===")
    status, data = http("POST", "/api/promo-codes", body={
        "code": test_promo_code,
        "description": "Full test promo",
        "discountType": "percent",
        "discountValue": 15,
        "minOrderTotal": 5000,
        "maxUses": 100,
    }, headers=admin_headers)
    if status == 201 and isinstance(data, dict) and data.get("id"):
        created_promo_id = data.get("id")
        step("promo_create", True, {"id": created_promo_id, "code": test_promo_code})
    else:
        step("promo_create", False, {"status": status, "data": data})

    # ── Step 7: P2.6 — Promo validation (public) ──
    log("\n=== Step 7: P2.6 — Promo validation ===")
    status, data = http("POST", "/api/promo-codes/validate", body={
        "code": test_promo_code,
        "cartTotal": 50000,
    }, headers={"x-restaurant-slug": E2E_SLUG})
    ok = (
        status == 200
        and isinstance(data, dict)
        and data.get("valid") is True
        and data.get("discountAmount") == 7500  # 15% of 50000
        and data.get("newTotal") == 42500
    )
    step("promo_validate", ok, {
        "status": status,
        "valid": data.get("valid") if isinstance(data, dict) else None,
        "discountAmount": data.get("discountAmount") if isinstance(data, dict) else None,
        "newTotal": data.get("newTotal") if isinstance(data, dict) else None,
    })

    # ── Step 8: P2.6 — Promo validation (min total not met) ──
    log("\n=== Step 8: P2.6 — Promo min total check ===")
    status, data = http("POST", "/api/promo-codes/validate", body={
        "code": test_promo_code,
        "cartTotal": 3000,  # < minOrderTotal 5000
    }, headers={"x-restaurant-slug": E2E_SLUG})
    ok = status in (400, 404) and isinstance(data, dict) and data.get("valid") is False
    step("promo_min_total_rejected", ok, {
        "status": status,
        "valid": data.get("valid") if isinstance(data, dict) else None,
        "error": data.get("error") if isinstance(data, dict) else None,
    })

    # ── Step 9: P2.6 — Order with promo code ──
    log("\n=== Step 9: P2.6 — Order with promo ===")
    status, data = http("POST", "/api/orders", body={
        "items": json.dumps([{"name": "Promo Order", "price": 25000, "qty": 2}]),
        "total": 50000,
        "promoCode": test_promo_code,
        "orderType": "dine_in",
        "customerName": "Promo Order Test",
        "tableQrToken": created_table_qr_token,
        "adminOverride": True,  # bypass opening hours
    }, headers={"x-restaurant-slug": E2E_SLUG, "Authorization": f"Bearer {admin_token}"})
    if status in (200, 201) and isinstance(data, dict):
        ok = data.get("discount") == 7500 and data.get("total") == 42500
        step("order_with_promo", ok, {
            "orderId": data.get("id"),
            "total": data.get("total"),
            "discount": data.get("discount"),
            "expectedTotal": 42500,
            "expectedDiscount": 7500,
        })
    else:
        step("order_with_promo", False, {"status": status, "data": data})

    # ── Step 10: P3.7 — Chat message ──
    log("\n=== Step 10: P3.7 — Chat message ===")
    chat_msg = f"Full feature test {uuid.uuid4().hex[:8]}"
    status, data = http("POST", "/api/chat", body={
        "content": chat_msg,
    }, headers=admin_headers)
    if status == 201 and isinstance(data, dict) and data.get("id"):
        chat_msg_id = data["id"]
        step("chat_send", True, {"id": chat_msg_id, "content": chat_msg})
    else:
        step("chat_send", False, {"status": status, "data": data})

    # ── Step 11: P3.7 — Chat retrieval ──
    log("\n=== Step 11: P3.7 — Chat retrieval ===")
    status, data = http("GET", "/api/chat", headers=admin_headers)
    if status == 200 and isinstance(data, dict):
        messages = data.get("data", [])
        found = any(m.get("content") == chat_msg for m in messages)
        step("chat_retrieve", found, {
            "totalMessages": len(messages),
            "foundTestMessage": found,
        })
    else:
        step("chat_retrieve", False, {"status": status, "data": data})

    # ── Step 12: P3.7 — Chat XSS sanitization ──
    log("\n=== Step 12: P3.7 — Chat XSS sanitization ===")
    status, data = http("POST", "/api/chat", body={
        "content": "<script>alert(1)</script>test",
    }, headers=admin_headers)
    if status == 201 and isinstance(data, dict):
        content = data.get("content", "")
        ok = "<script>" not in content and "&lt;script&gt;" in content
        step("chat_xss_sanitized", ok, {
            "content": content,
            "hasScript": "<script>" in content,
            "hasEscaped": "&lt;script&gt;" in content,
        })
    else:
        step("chat_xss_sanitized", False, {"status": status, "data": data})

    # ── Step 13: P3.8 — Loyalty tiers seed ──
    log("\n=== Step 13: P3.8 — Loyalty tiers seed ===")
    status, data = http("GET", "/api/loyalty/tiers", headers={"x-restaurant-slug": E2E_SLUG})
    if status == 200 and isinstance(data, dict):
        tiers = data.get("data", [])
        ok = len(tiers) >= 4  # at least bronze, silver, gold, platinum
        step("tiers_seed", ok, {
            "tierCount": len(tiers),
            "tierNames": [t.get("name") for t in tiers],
        })
    else:
        step("tiers_seed", False, {"status": status, "data": data})

    # ── Step 14: P3.8 — Loyalty tiers update ──
    log("\n=== Step 14: P3.8 — Loyalty tiers update ===")
    if status == 200 and isinstance(data, dict) and len(data.get("data", [])) >= 4:
        tiers = data["data"]
        # Modify silver to 7% discount
        for t in tiers:
            if t["name"] == "silver":
                t["discountPercent"] = 7
        status2, data2 = http("PATCH", "/api/loyalty/tiers", body={
            "tiers": tiers,
        }, headers=admin_headers)
        if status2 == 200:
            # Verify persistence
            status3, data3 = http("GET", "/api/loyalty/tiers", headers={"x-restaurant-slug": E2E_SLUG})
            silver = next((t for t in data3.get("data", []) if t["name"] == "silver"), None)
            ok = silver and silver.get("discountPercent") == 7
            step("tiers_update", ok, {
                "silverDiscount": silver.get("discountPercent") if silver else None,
                "expected": 7,
            })
        else:
            step("tiers_update", False, {"status": status2, "data": data2})
    else:
        step("tiers_update", False, {"reason": "tiers not seeded"})

    # ── Step 15: P2.4 — Export PDF journal ──
    log("\n=== Step 15: P2.4 — Export PDF journal ===")
    # PDF responses are binary — use a raw download instead of the JSON http() helper
    try:
        pdf_url = f"{BASE_URL}/api/export/orders-journal"
        pdf_req = urllib.request.Request(pdf_url, headers={
            "Authorization": f"Bearer {admin_token}",
            "x-restaurant-slug": E2E_SLUG,
        })
        with urllib.request.urlopen(pdf_req, timeout=30) as pdf_resp:
            pdf_status = pdf_resp.status
            pdf_data = pdf_resp.read()
            # Check it's a valid PDF (starts with %PDF magic bytes)
            is_valid_pdf = pdf_data[:5] == b"%PDF-"
            step("pdf_journal_export", pdf_status == 200 and is_valid_pdf, {
                "status": pdf_status,
                "sizeBytes": len(pdf_data),
                "magicBytes": pdf_data[:8].decode("ascii", errors="replace"),
                "isValidPDF": is_valid_pdf,
            })
    except urllib.error.HTTPError as e:
        step("pdf_journal_export", False, {"status": e.code, "error": e.read().decode("utf-8", errors="replace")[:200]})
    except Exception as e:
        step("pdf_journal_export", False, {"error": str(e)})

    # ── Step 16: P1.1 — Sound settings page accessible ──
    log("\n=== Step 16: P1.1 — Admin pages accessible ===")
    for path, name in [
        ("/admin", "admin_dashboard"),
        ("/admin/tables", "admin_tables"),
        ("/kitchen", "kitchen_page"),
    ]:
        status, _ = http("GET", path)
        step(f"page_{name}", status == 200, {"path": path, "status": status})

    # ── Step 17: Per-restaurant URL ──
    log("\n=== Step 17: Per-restaurant URL ===")
    status, _ = http("GET", f"/r/{E2E_SLUG}/menu")
    step("per_restaurant_url", status == 200, {
        "path": f"/r/{E2E_SLUG}/menu",
        "status": status,
    })

    # ── Step 18: Mission 11 — QR rotation ──
    log("\n=== Step 18: Mission 11 — QR rotation ===")
    if created_table_id:
        status, data = http("POST", f"/api/tables/{created_table_id}/qr/rotate", headers=admin_headers)
        if status == 200 and isinstance(data, dict) and data.get("qrToken"):
            new_token = data["qrToken"]
            ok = new_token != created_table_qr_token and data.get("qrVersion") == 2
            step("qr_rotate", ok, {
                "newVersion": data.get("qrVersion"),
                "tokenChanged": new_token != created_table_qr_token,
            })

            # Verify old token is rejected
            status2, data2 = http("GET", f"/api/qr/table/{created_table_qr_token}")
            step("qr_old_rejected", status2 in (404, 410), {
                "status": status2,
                "code": data2.get("code") if isinstance(data2, dict) else None,
            })
        else:
            step("qr_rotate", False, {"status": status, "data": data})
            step("qr_old_rejected", False, {"reason": "rotation failed"})
    else:
        step("qr_rotate", False, {"reason": "no table"})
        step("qr_old_rejected", False, {"reason": "no table"})

    # ── Step 19: Cleanup ──
    log("\n=== Step 19: Cleanup ===")
    # Delete test promo code
    if created_promo_id:
        status, _ = http("DELETE", f"/api/promo-codes/{created_promo_id}", headers=admin_headers)
        step("cleanup_promo", status == 200, {"id": created_promo_id, "status": status})
    # Delete test table (re-enable first for hard delete, or soft-delete)
    if created_table_id:
        http("PATCH", f"/api/tables/{created_table_id}", body={"active": True}, headers=admin_headers)
        status, _ = http("DELETE", f"/api/tables/{created_table_id}", headers=admin_headers)
        step("cleanup_table", status == 200, {"id": created_table_id, "status": status})

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
    log(f"\nReport written to {REPORT_PATH}")
    log(f"Result: {report['result']} — {report['summary']}")


if __name__ == "__main__":
    report = run()
    if report["result"] == "FAIL":
        sys.exit(1)
    sys.exit(0)
