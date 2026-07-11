import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Edge initialization.
 * Runs in the Edge runtime — captures middleware/proxy errors.
 */

const SENTRY_DSN = process.env.SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV || "development",
});
