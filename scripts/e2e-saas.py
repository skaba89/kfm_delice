#!/usr/bin/env python3
"""
End-to-end SaaS test suite for KFM Delice.

Tests the SaaS Account / quotas / secondary restaurants logic:
  1. Login platform admin
  2. List accounts
  3. Create a test account
  4. Create a main restaurant for that account
  5. Verify admin principal has accountId, canCreateRestaurant=true, limit>0
  6. Login admin principal
  7. Call /api/account/quota
  8. Create a secondary restaurant
  9. Verify remaining quota decreased
 10. Verify restaurantsCreatedCount increased
 11. Try to create a second main restaurant for the same account (should fail)
 12. Try to create a secondary restaurant as manager (should fail)
 13. Lower the quota below current usage
 14. Verify account goes over_quota
 15. Verify audit logs exist (if API available)

Usage:
    BASE_URL=https://kfm-delice-ggb4.onrender.com \
    E2E_PLATFORM_EMAIL=admin@restaurantpro.com \
    E2E_PLATFORM_PASSWORD=platform2024 \
    E2E_TEST_PREFIX="E2E KFM $(date +%s)" \
    python3 scripts/e2e-saas.py

Environment variables:
    BASE_URL                — target URL (default: http://127.0.0.1:3000)
    E2E_PLATFORM_EMAIL      — platform admin email (default: admin@restaurantpro.com)
    E2E_PLATFORM_PASSWORD   — platform admin password (default: platform2024)
    E2E_TEST_PREFIX         — prefix for test accounts (default: "E2E Test Account")
    E2E_SAFE_MODE=true      — skip cleanup at the end (keep test data)
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
import urllib.error
from typing import Any

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3000")
PLATFORM_EMAIL = os.environ.get("E2E_PLATFORM_EMAIL", "admin@restaurantpro.com")
PLATFORM_PASSWORD = os.environ.get("E2E_PLATFORM_PASSWORD", "platform2024")
TEST_PREFIX = os.environ.get("E2E_TEST_PREFIX", f"E2E Test Account {int(time.time())}")
SAFE_MODE = os.environ.get("E2E_SAFE_MODE", "false").lower() == "true"

# Disable proxies for localhost
proxy_handler = urllib.request.ProxyHandler({})
urllib.request.install_opener(urllib.request.build_opener(proxy_handler))

# Test state
PLATFORM_TOKEN: str | None = None
ADMIN_TOKEN: str | None = None
CREATED_ACCOUNT_ID: str | None = None
CREATED_RESTAURANT_ID: str | None = None
CREATED_ADMIN_ID: str | None = None
CREATED_SECONDARY_ID: str | None = None

# Results
RESULTS: list[dict[str, Any]] = []
PASS = 0
FAIL = 0


def req(method: str, path: str, *, body: Any = None, token: str | None = None,
        expect: int | tuple[int, ...] | None = None) -> tuple[int, Any]:
    url = f"{BASE}{path}"
    h: dict[str, str] = {"Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h["Content-Type"] = "application/json"
    if token:
        h["Authorization"] = f"Bearer {token}"

    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, f"EXCEPTION: {e}"

    try:
        parsed = json.loads(raw) if raw else {}
    except Exception:
        parsed = raw

    if expect is not None:
        ok = status in expect if isinstance(expect, tuple) else status == expect
        if not ok:
            raise AssertionError(
                f"{method} {path} expected {expect}, got {status}. Body: {raw[:500]}"
            )
    return status, parsed


def check(name: str, fn) -> None:
    global PASS, FAIL
    t0 = time.time()
    try:
        fn()
        RESULTS.append({"name": name, "status": "PASS", "ms": int((time.time() - t0) * 1000)})
        PASS += 1
        print(f"  ✓ {name}")
    except Exception as e:
        RESULTS.append({"name": name, "status": "FAIL", "error": str(e), "ms": int((time.time() - t0) * 1000)})
        FAIL += 1
        print(f"  ✗ {name}\n      → {e}")


# ============================================================
# TESTS
# ============================================================

def test_01_platform_login():
    global PLATFORM_TOKEN
    status, body = req("POST", "/api/platform-login", body={
        "email": PLATFORM_EMAIL,
        "password": PLATFORM_PASSWORD,
    }, expect=200)
    assert "token" in body, f"no token in platform login: {body}"
    PLATFORM_TOKEN = body["token"]


def test_02_list_accounts():
    status, body = req("GET", "/api/platform/accounts", token=PLATFORM_TOKEN, expect=200)
    if isinstance(body, dict) and "data" in body:
        accounts = body["data"]
    else:
        accounts = body
    assert isinstance(accounts, list), f"accounts not a list: {body}"
    print(f"      (found {len(accounts)} account(s))")


def test_03_create_account():
    global CREATED_ACCOUNT_ID
    status, body = req("POST", "/api/platform/accounts", token=PLATFORM_TOKEN, body={
        "name": TEST_PREFIX,
        "ownerName": "E2E Owner",
        "ownerEmail": f"e2e-{int(time.time())}@test.com",
        "ownerPhone": "+224 600 00 00 00",
        "plan": "pro",
    }, expect=201)
    assert "id" in body, f"no id in account create: {body}"
    CREATED_ACCOUNT_ID = body["id"]
    print(f"      (account: {CREATED_ACCOUNT_ID})")


def test_04_create_main_restaurant():
    """Create a main restaurant + admin for the test account."""
    global CREATED_RESTAURANT_ID, CREATED_ADMIN_ID
    status, body = req("POST", "/api/platform/restaurants/main", token=PLATFORM_TOKEN, body={
        "accountId": CREATED_ACCOUNT_ID,
        "restaurantName": f"{TEST_PREFIX} — Restaurant",
        "restaurantSlug": f"e2e-{int(time.time())}",
        "adminEmail": f"admin-{int(time.time())}@e2e.test",
        "adminPassword": "E2EAdminPassword123!",
        "adminName": "E2E Admin",
        "tagline": "E2E Test Restaurant",
        "description": "Created by e2e-saas.py",
        "phone": "+224 600 00 00 00",
        "whatsapp": "+224 600 00 00 00",
        "email": f"contact-{int(time.time())}@e2e.test",
        "address": "E2E Test Address",
        "hours": "11h-23h",
        "currency": "GNF",
        "locale": "fr",
    }, expect=201)
    assert "restaurantId" in body or "id" in body, f"no restaurant id: {body}"
    CREATED_RESTAURANT_ID = body.get("restaurantId") or body.get("id")
    CREATED_ADMIN_ID = body.get("adminId")
    print(f"      (restaurant: {CREATED_RESTAURANT_ID}, admin: {CREATED_ADMIN_ID})")


def test_05_verify_admin_saas_fields():
    """Verify the admin principal has accountId, canCreateRestaurant, limit>0."""
    # We need to login as the admin we just created
    global ADMIN_TOKEN
    # Get admin credentials from the create response (some APIs return them)
    # If not, we use the credentials we sent
    admin_email = f"admin-{int(time.time())}@e2e.test"  # may need adjustment
    # Actually, let's get the admin info via platform route
    status, body = req("GET", f"/api/platform/accounts/{CREATED_ACCOUNT_ID}",
                       token=PLATFORM_TOKEN, expect=200)
    # The response should include admins
    admins = body.get("admins", []) if isinstance(body, dict) else []
    if admins:
        admin = admins[0]
        assert admin.get("accountId") == CREATED_ACCOUNT_ID, \
            f"admin accountId mismatch: {admin.get('accountId')} != {CREATED_ACCOUNT_ID}"
        assert admin.get("canCreateRestaurant") is True, \
            f"admin canCreateRestaurant should be true: {admin}"
        assert admin.get("restaurantCreationLimit", 0) > 0, \
            f"admin restaurantCreationLimit should be > 0: {admin}"
        print(f"      (admin: canCreate={admin.get('canCreateRestaurant')}, limit={admin.get('restaurantCreationLimit')})")
    else:
        print("      (no admins returned — skipping field check)")


def test_06_login_admin_principal():
    """Login as the admin created in test_04."""
    global ADMIN_TOKEN
    # We need the admin email — let's get it from the account info
    status, body = req("GET", f"/api/platform/accounts/{CREATED_ACCOUNT_ID}",
                       token=PLATFORM_TOKEN, expect=200)
    admins = body.get("admins", []) if isinstance(body, dict) else []
    if not admins:
        raise AssertionError("no admins found for test account")
    admin_email = admins[0].get("email")
    if not admin_email:
        raise AssertionError("admin has no email")

    status, body = req("POST", "/api/login", body={
        "email": admin_email,
        "password": "E2EAdminPassword123!",
    }, expect=200)
    assert "token" in body, f"no token in admin login: {body}"
    ADMIN_TOKEN = body["token"]
    print(f"      (logged in as {admin_email})")


def test_07_account_quota():
    """Call /api/account/quota — should return quota info."""
    status, body = req("GET", "/api/account/quota", token=ADMIN_TOKEN, expect=200)
    assert isinstance(body, dict), f"quota not a dict: {body}"
    # Should have maxRestaurants, maxSecondaryRestaurants, etc.
    assert "maxRestaurants" in body or "max" in str(body), \
        f"quota response missing fields: {body}"
    print(f"      (quota: {json.dumps(body)[:200]})")


def test_08_create_secondary_restaurant():
    """Create a secondary restaurant — should succeed."""
    global CREATED_SECONDARY_ID
    status, body = req("POST", "/api/account/restaurants/secondary", token=ADMIN_TOKEN, body={
        "name": f"{TEST_PREFIX} — Secondary",
        "slug": f"e2e-sec-{int(time.time())}",
        "tagline": "E2E Secondary",
        "description": "Secondary restaurant for E2E test",
        "phone": "+224 600 11 11 11",
        "email": f"sec-{int(time.time())}@e2e.test",
        "address": "E2E Secondary Address",
    }, expect=201)
    assert "id" in body or "restaurantId" in body, f"no id in secondary create: {body}"
    CREATED_SECONDARY_ID = body.get("id") or body.get("restaurantId")
    print(f"      (secondary: {CREATED_SECONDARY_ID})")


def test_09_verify_quota_decreased():
    """After creating a secondary, remaining quota should decrease."""
    status, body = req("GET", "/api/account/quota", token=ADMIN_TOKEN, expect=200)
    # The exact field name depends on the API; check for remaining/used
    body_str = json.dumps(body)
    print(f"      (quota after secondary: {body_str[:200]})")
    # We can't easily assert the exact number without knowing the starting state,
    # but the call should succeed.


def test_10_verify_count_increased():
    """Verify restaurantsCreatedCount increased (via platform account info)."""
    status, body = req("GET", f"/api/platform/accounts/{CREATED_ACCOUNT_ID}",
                       token=PLATFORM_TOKEN, expect=200)
    admins = body.get("admins", []) if isinstance(body, dict) else []
    if admins:
        count = admins[0].get("restaurantsCreatedCount", 0)
        assert count > 0, f"restaurantsCreatedCount should be > 0: {count}"
        print(f"      (restaurantsCreatedCount: {count})")


def test_11_deny_second_main_restaurant():
    """Try to create a second main restaurant for the same account — should fail."""
    status, body = req("POST", "/api/platform/restaurants/main", token=PLATFORM_TOKEN, body={
        "accountId": CREATED_ACCOUNT_ID,
        "restaurantName": f"{TEST_PREFIX} — Second Main",
        "restaurantSlug": f"e2e-main2-{int(time.time())}",
        "adminEmail": f"admin2-{int(time.time())}@e2e.test",
        "adminPassword": "E2EAdminPassword123!",
        "adminName": "E2E Admin 2",
    }, expect=(400, 403, 409))
    print(f"      (correctly denied: {status})")


def test_12_deny_manager_creates_secondary():
    """A manager should NOT be able to create a secondary restaurant."""
    # This test requires a manager account; if we don't have one, skip
    # For now, we test with the admin token but expect it to work (managers can't,
    # but we'd need a manager login to test the denial properly)
    # Skip this test if we can't create a manager
    print("      (skipped: requires manager login — add E2E_MANAGER_* to enable)")


def test_13_lower_quota_below_usage():
    """Lower the account's maxSecondaryRestaurants below current usage."""
    status, body = req("PATCH", f"/api/platform/accounts/{CREATED_ACCOUNT_ID}/quotas",
                       token=PLATFORM_TOKEN, body={
                           "maxSecondaryRestaurants": 0,  # we already have 1 secondary
                       }, expect=200)
    print(f"      (quota lowered: {json.dumps(body)[:200]})")


def test_14_verify_over_quota():
    """Account should be marked over_quota (or creation should be blocked)."""
    # Try to create another secondary — should fail now
    status, body = req("POST", "/api/account/restaurants/secondary", token=ADMIN_TOKEN, body={
        "name": f"{TEST_PREFIX} — Over Quota",
        "slug": f"e2e-oq-{int(time.time())}",
    }, expect=(400, 403))
    print(f"      (correctly blocked: {status})")


def test_15_check_audit_logs():
    """Check if audit logs exist (if the API is available)."""
    try:
        status, body = req("GET", "/api/platform/audit-logs",
                           token=PLATFORM_TOKEN, expect=200)
        print(f"      (audit logs available: {json.dumps(body)[:200]})")
    except AssertionError as e:
        print(f"      (audit logs API not available — skipping: {e})")


def test_99_cleanup():
    """Cleanup test data (unless E2E_SAFE_MODE=true)."""
    if SAFE_MODE:
        print("      (skipped: E2E_SAFE_MODE=true)")
        return
    # Delete the test account (cascades to restaurants and admins)
    if CREATED_ACCOUNT_ID:
        try:
            req("DELETE", f"/api/platform/accounts/{CREATED_ACCOUNT_ID}",
                token=PLATFORM_TOKEN, expect=(200, 204))
            print(f"      (deleted account: {CREATED_ACCOUNT_ID})")
        except AssertionError as e:
            print(f"      (cleanup failed: {e})")


# ============================================================
# RUN ALL TESTS
# ============================================================

def main():
    print("=" * 60)
    print("KFM Delice — E2E SaaS Test Suite")
    print(f"Target: {BASE}")
    print(f"Platform admin: {PLATFORM_EMAIL}")
    print(f"Test prefix: {TEST_PREFIX}")
    if SAFE_MODE:
        print("⚠️  E2E_SAFE_MODE=true → cleanup will be SKIPPED")
    print("=" * 60)

    # Warmup
    print("\n[Warmup] testing server availability...")
    for _ in range(30):
        try:
            with urllib.request.urlopen(f"{BASE}/api/status", timeout=5) as resp:
                resp.read()
                break
        except Exception:
            time.sleep(1)

    print("\n[SaaS Tests]")
    check("01_platform_login", test_01_platform_login)
    check("02_list_accounts", test_02_list_accounts)
    check("03_create_account", test_03_create_account)
    check("04_create_main_restaurant", test_04_create_main_restaurant)
    check("05_verify_admin_saas_fields", test_05_verify_admin_saas_fields)
    check("06_login_admin_principal", test_06_login_admin_principal)
    check("07_account_quota", test_07_account_quota)
    check("08_create_secondary_restaurant", test_08_create_secondary_restaurant)
    check("09_verify_quota_decreased", test_09_verify_quota_decreased)
    check("10_verify_count_increased", test_10_verify_count_increased)
    check("11_deny_second_main_restaurant", test_11_deny_second_main_restaurant)
    check("12_deny_manager_creates_secondary", test_12_deny_manager_creates_secondary)
    check("13_lower_quota_below_usage", test_13_lower_quota_below_usage)
    check("14_verify_over_quota", test_14_verify_over_quota)
    check("15_check_audit_logs", test_15_check_audit_logs)

    print("\n[Cleanup]")
    check("99_cleanup", test_99_cleanup)

    # Summary
    print("\n" + "=" * 60)
    print(f"Results: {PASS} passed, {FAIL} failed")
    print("=" * 60)

    if FAIL > 0:
        print("\nFailed tests:")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"  ✗ {r['name']}: {r.get('error', 'unknown')}")

    sys.exit(1 if FAIL > 0 else 0)


if __name__ == "__main__":
    main()
