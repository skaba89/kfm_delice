# ───────────────────────────────────────────────────────────────
# KFM Delice — Dockerfile for VPS deployment
# Works on any VPS (DigitalOcean, Hetzner, OVH, AWS EC2, etc.)
# ───────────────────────────────────────────────────────────────
# Build: docker build -t kfm-delice .
# Run:   docker run -p 3000:3000 --env-file .env.production kfm-delice
# Or use docker-compose.yml for full stack (app + PostgreSQL)
# ───────────────────────────────────────────────────────────────

FROM node:22-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY bun.lock* ./

# Install dependencies
RUN npm ci --no-audit --no-fund

# ───────────────────────────────────────────────────────────────
# Builder stage — compile the Next.js app
# ───────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy PostgreSQL schema (production default)
COPY prisma/schema.postgres.prisma prisma/schema.prisma

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ───────────────────────────────────────────────────────────────
# Runner stage — minimal production image
# ───────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/render-start.sh ./render-start.sh
COPY --from=builder /app/render-build.sh ./render-build.sh

# Make scripts executable
RUN chmod +x render-start.sh render-build.sh scripts/*.cjs scripts/*.py 2>/dev/null || true

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start command — runs Prisma migrations + seed + Next.js
CMD ["bash", "render-start.sh"]
