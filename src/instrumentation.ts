import * as Sentry from "@sentry/nextjs";

/**
 * Sentry initialization for KFM Delice.
 * Set SENTRY_DSN in your environment variables to enable.
 * If SENTRY_DSN is not set, Sentry runs in no-op mode (no errors sent).
 *
 * Get your DSN at: https://sentry.io → Settings → Projects → DSN
 * Free tier: 5 000 errors/month, enough for a small SaaS.
 */

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN, // Only enable if DSN is set

  // Set sampling rate for performance monitoring (1.0 = 100%, 0.1 = 10%)
  // Keep low for free tier (5 000 transactions/month)
  tracesSampleRate: 0.1,

  // Set profilesSampleRate to 1.0 to profile every transaction.
  // Since profilesSampleRate is relative to tracesSampleRate,
  // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
  profilesSampleRate: 0.1,

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Release version (optional — use git commit hash in production)
  release: process.env.SENTRY_RELEASE || "kfm-delice@latest",

  // Ignore common non-critical errors
  ignoreErrors: [
    // Browser extension noise
    "top.GLOBALS",
    "canvas.contentDocument",
    "ResizeObserver loop limit exceeded",
    // Network errors (user offline, not our bug)
    "Network request failed",
    "Failed to fetch",
  ],
});
