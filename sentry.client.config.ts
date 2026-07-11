import * as Sentry from "@sentry/nextjs";

/**
 * Sentry client-side initialization.
 * Runs in the browser — captures frontend errors (React, Next.js).
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,

  // Performance monitoring (lower rate for free tier)
  tracesSampleRate: 0.1,

  // Session replay (optional — captures screen recording on error)
  // Disabled by default to respect privacy. Enable in production if needed.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  environment: process.env.NODE_ENV || "development",

  ignoreErrors: [
    "top.GLOBALS",
    "ResizeObserver loop limit exceeded",
    "Network request failed",
  ],
});
