#!/usr/bin/env python3
"""Concurrent read-only capacity probe for a staging KFM Delice deployment.

This is intentionally dependency-free and only sends GET requests.
It is NOT an automatic production stress test.

Required:
  BASE_URL=https://staging.example.com
Optional:
  RESTAURANT_SLUG=<tenant slug>
  LOAD_REQUESTS=200
  LOAD_CONCURRENCY=10
  LOAD_P95_MAX_MS=1500
  LOAD_ERROR_RATE_MAX=0.01
  LOAD_TIMEOUT_SECONDS=15

Exit codes:
  0 thresholds passed
  1 thresholds failed
  2 invalid configuration
"""

from __future__ import annotations

import concurrent.futures
import math
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass(frozen=True)
class Sample:
    endpoint: str
    status: int | None
    latency_ms: float
    ok: bool
    error: str = ""


def percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(0, min(len(ordered) - 1, math.ceil((percentile_value / 100) * len(ordered)) - 1))
    return ordered[rank]


def fetch(base_url: str, endpoint: str, timeout: float, slug: str) -> Sample:
    headers = {
        "Accept": "application/json",
        "User-Agent": "kfm-delice-capacity-probe/1.0",
    }
    if endpoint == "/api/menu" and slug:
        headers["x-restaurant-slug"] = slug

    started = time.perf_counter()
    try:
        request = urllib.request.Request(f"{base_url.rstrip('/')}{endpoint}", headers=headers, method="GET")
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response.read(512)
            latency_ms = (time.perf_counter() - started) * 1000
            return Sample(endpoint, response.status, latency_ms, response.status == 200)
    except urllib.error.HTTPError as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        return Sample(endpoint, exc.code, latency_ms, False, f"HTTP {exc.code}")
    except Exception as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        return Sample(endpoint, None, latency_ms, False, str(exc))


def main() -> int:
    base_url = os.environ.get("BASE_URL", "").strip()
    if not base_url:
        print("[capacity] BASE_URL is required", file=sys.stderr)
        return 2
    if not base_url.startswith("https://") and "localhost" not in base_url:
        print("[capacity] BASE_URL must be HTTPS outside local development", file=sys.stderr)
        return 2

    slug = os.environ.get("RESTAURANT_SLUG", "").strip()
    total_requests = int(os.environ.get("LOAD_REQUESTS", "200"))
    concurrency = int(os.environ.get("LOAD_CONCURRENCY", "10"))
    p95_limit = float(os.environ.get("LOAD_P95_MAX_MS", "1500"))
    error_rate_limit = float(os.environ.get("LOAD_ERROR_RATE_MAX", "0.01"))
    timeout = float(os.environ.get("LOAD_TIMEOUT_SECONDS", "15"))

    if total_requests < 1 or concurrency < 1 or concurrency > 200:
        print("[capacity] LOAD_REQUESTS must be >=1 and LOAD_CONCURRENCY must be between 1 and 200", file=sys.stderr)
        return 2
    if not 0 <= error_rate_limit <= 1:
        print("[capacity] LOAD_ERROR_RATE_MAX must be between 0 and 1", file=sys.stderr)
        return 2

    endpoints = ["/api/status", "/api/ready"]
    if slug:
        endpoints.append("/api/menu")

    schedule = [endpoints[index % len(endpoints)] for index in range(total_requests)]
    samples: list[Sample] = []
    wall_started = time.perf_counter()

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(fetch, base_url, endpoint, timeout, slug) for endpoint in schedule]
        for future in concurrent.futures.as_completed(futures):
            samples.append(future.result())

    wall_seconds = max(time.perf_counter() - wall_started, 0.001)
    latencies = [sample.latency_ms for sample in samples]
    failures = [sample for sample in samples if not sample.ok]
    error_rate = len(failures) / len(samples)
    throughput = len(samples) / wall_seconds

    p50 = percentile(latencies, 50)
    p95 = percentile(latencies, 95)
    p99 = percentile(latencies, 99)
    mean = statistics.fmean(latencies) if latencies else 0.0

    print("[capacity] KFM Delice read-only capacity result")
    print(f"[capacity] requests={len(samples)} concurrency={concurrency} duration={wall_seconds:.2f}s throughput={throughput:.2f} req/s")
    print(f"[capacity] latency_ms mean={mean:.1f} p50={p50:.1f} p95={p95:.1f} p99={p99:.1f}")
    print(f"[capacity] errors={len(failures)} error_rate={error_rate:.4f} threshold={error_rate_limit:.4f}")
    print(f"[capacity] p95_threshold_ms={p95_limit:.1f}")

    for endpoint in endpoints:
        endpoint_samples = [sample for sample in samples if sample.endpoint == endpoint]
        endpoint_errors = sum(1 for sample in endpoint_samples if not sample.ok)
        endpoint_latencies = [sample.latency_ms for sample in endpoint_samples]
        print(
            f"[capacity] endpoint={endpoint} requests={len(endpoint_samples)} "
            f"errors={endpoint_errors} p95={percentile(endpoint_latencies, 95):.1f}ms"
        )

    if failures:
        for sample in failures[:10]:
            print(
                f"[capacity] failure endpoint={sample.endpoint} status={sample.status} "
                f"latency={sample.latency_ms:.1f}ms error={sample.error}",
                file=sys.stderr,
            )

    failed_thresholds: list[str] = []
    if error_rate > error_rate_limit:
        failed_thresholds.append(f"error_rate {error_rate:.4f} > {error_rate_limit:.4f}")
    if p95 > p95_limit:
        failed_thresholds.append(f"p95 {p95:.1f}ms > {p95_limit:.1f}ms")

    if failed_thresholds:
        print(f"[capacity] RESULT: FAIL — {'; '.join(failed_thresholds)}", file=sys.stderr)
        return 1

    print("[capacity] RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
