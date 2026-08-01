/**
 * Logger — structured logging that respects the environment.
 *
 * In production: only warnings and errors are logged.
 * In development: all levels are logged.
 * console.log calls are replaced with logger.debug() which is
 * a no-op in production.
 *
 * Client-safe: uses typeof window check instead of process.env.
 */

const isProd =
  typeof process !== "undefined"
    ? process.env.NODE_ENV === "production"
    : typeof window !== "undefined" && window.location.hostname !== "localhost";

export const logger = {
  debug: (...args: unknown[]) => {
    if (!isProd) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (!isProd) console.log("[INFO]", ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn("[WARN]", ...args);
  },
  error: (...args: unknown[]) => {
    console.error("[ERROR]", ...args);
  },
};
