import * as Sentry from "@sentry/nextjs";

/**
 * Sentry server-side initialization.
 * Runs in Node.js — captures backend errors (API routes, Prisma, etc.)
 */

const SENTRY_DSN = process.env.SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,

  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  environment: process.env.NODE_ENV || "development",

  ignoreErrors: [
    "Network request failed",
    "ECONNRESET",
    "ETIMEDOUT",
  ],
});
