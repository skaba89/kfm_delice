#!/usr/bin/env python3
"""Read-only post-deploy smoke checks for KFM Delice.

Required:
  BASE_URL=https://...
Optional:
  SMOKE_RESTAURANT_SLUG=<tenant slug>
  SMOKE_TIMEOUT_SECONDS=20

The script never creates, updates, or deletes data. It is safe to run after
production deploys and from an operator workstation.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class CheckResult:
    name: str
    ok: bool
    status: int | None
    latency_ms: int
    detail: str = ""


def request_json(base_url: str, path: str, timeout: float, headers: dict[str, str] | None = None) -> tuple[int, Any, int]:
    url = f"{base_url.rstrip('/')}{path}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", **(headers or {})})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            latency_ms = int((time.monotonic() - started) * 1000)
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"_raw": raw[:500]}
            return response.status, payload, latency_ms
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        latency_ms = int((time.monotonic() - started) * 1000)
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"_raw": raw[:500]}
        return exc.code, payload, latency_ms


def main() -> int:
    base_url = os.environ.get("BASE_URL", "").strip()
    if not base_url:
        print("[smoke] FAIL: BASE_URL is required", file=sys.stderr)
        return 2
    if not base_url.startswith("https://") and "localhost" not in base_url:
        print("[smoke] FAIL: BASE_URL must use HTTPS outside local development", file=sys.stderr)
        return 2

    timeout = float(os.environ.get("SMOKE_TIMEOUT_SECONDS", "20"))
    slug = os.environ.get("SMOKE_RESTAURANT_SLUG", "").strip()
    results: list[CheckResult] = []

    def run(name: str, path: str, validator, headers: dict[str, str] | None = None) -> None:
        try:
            status, payload, latency_ms = request_json(base_url, path, timeout, headers)
            valid, detail = validator(status, payload)
            results.append(CheckResult(name, valid, status, latency_ms, detail))
        except Exception as exc:  # network/DNS/TLS timeout
            results.append(CheckResult(name, False, None, 0, str(exc)))

    run(
        "liveness",
        "/api/status",
        lambda status, payload: (
            status == 200 and isinstance(payload, dict),
            f"status={status}",
        ),
    )

    run(
        "readiness",
        "/api/ready",
        lambda status, payload: (
            status == 200
            and isinstance(payload, dict)
            and payload.get("status") == "ready"
            and payload.get("database") == "connected"
            and payload.get("schema") == "compatible",
            f"status={status} body_status={payload.get('status') if isinstance(payload, dict) else 'invalid'}",
        ),
    )

    if slug:
        encoded_slug = urllib.parse.quote(slug, safe="") if hasattr(urllib, "parse") else slug
        # Restaurant metadata validates tenant resolution without authentication.
        run(
            "tenant",
            f"/api/restaurant?slug={encoded_slug}",
            lambda status, payload: (
                status == 200 and isinstance(payload, dict),
                f"status={status}",
            ),
            {"x-restaurant-slug": slug},
        )
        # Menu read validates a core public commercial path while remaining read-only.
        run(
            "public-menu",
            "/api/menu",
            lambda status, payload: (
                status == 200 and isinstance(payload, (dict, list)),
                f"status={status}",
            ),
            {"x-restaurant-slug": slug},
        )

    print("[smoke] KFM Delice post-deploy checks")
    for result in results:
        marker = "PASS" if result.ok else "FAIL"
        print(f"[smoke] {marker:4} {result.name:14} status={result.status} latency={result.latency_ms}ms {result.detail}")

    failures = [result for result in results if not result.ok]
    if failures:
        print(f"[smoke] RESULT: FAIL ({len(failures)}/{len(results)} checks failed)", file=sys.stderr)
        return 1

    print(f"[smoke] RESULT: PASS ({len(results)} checks)")
    return 0


if __name__ == "__main__":
    # Import here so the module remains dependency-free for CI.
    import urllib.parse

    raise SystemExit(main())
