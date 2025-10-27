# ============================================
# PERFECT PRODUCTION DOCKERFILE
# For Next.js 15 + TypeScript + Prisma + Yarn
# ============================================
# This Dockerfile is specifically tailored for:
# - Next.js 15.5.4 (App Router)
# - Prisma 6.18.0 with PostgreSQL
# - Yarn 1.x (no committed yarn.lock)
# - Alpine Linux for minimal image size
# - DigitalOcean App Platform deployment

# ============================================
# Stage 1: Install Dependencies
# ============================================
FROM node:20-alpine AS deps

# Install required system dependencies for Prisma and native modules
# - libc6-compat: Compatibility layer for glibc on Alpine
# - openssl: Required by Prisma
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files
# Note: yarn.lock is not committed to repo, so we use yarn.lock* (optional)
COPY package.json yarn.lock* ./

# Copy Prisma schema for postinstall hook
# The postinstall script runs "prisma generate" which needs the schema
COPY prisma ./prisma

# Install dependencies
# - Without yarn.lock, this generates a new one (not ideal but necessary)
# - For true production, commit yarn.lock or generate it in CI
RUN yarn install --production=false --network-timeout 100000

# ============================================
# Stage 2: Build Application
# ============================================
FROM node:20-alpine AS builder

# Install build dependencies
# - python3, make, g++: Required for native node modules compilation
# - openssl: Required by Prisma
RUN apk add --no-cache libc6-compat openssl python3 make g++

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/yarn.lock ./yarn.lock

# Copy all source files
COPY . .

# Set build-time environment variables
# - Disable Next.js telemetry for privacy and performance
# - Increase Node memory for large builds
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build-time DATABASE_URL is required for Prisma to generate client
# This can be a placeholder since we don't connect to DB during build
# The actual DATABASE_URL will be provided at runtime
ARG DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder?schema=public"
ENV DATABASE_URL=$DATABASE_URL

# Generate Prisma Client
# This creates the .prisma directory with the client code
# Must be done before Next.js build because app code imports @prisma/client
RUN yarn prisma generate

# Build Next.js application
# This creates the optimized production build in .next directory
RUN yarn build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-alpine AS runner

# Install runtime dependencies
# - openssl: Required by Prisma at runtime
RUN apk add --no-cache libc6-compat openssl ca-certificates

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
# - nodejs group (GID 1001)
# - nextjs user (UID 1001)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder stage with proper ownership
# - package.json: For dependency resolution
# - yarn.lock: For consistent dependency versions
# - next.config.ts: Next.js configuration
# - prisma: Schema and migrations for runtime migrations
# - public: Static assets served by Next.js
# - .next: Built Next.js application
# - node_modules: All dependencies (including Prisma client)
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/yarn.lock ./yarn.lock
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy the start script for running migrations + starting server
COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./start.sh
RUN chmod +x ./start.sh

# Switch to non-root user
USER nextjs

# Expose port 3000
EXPOSE 3000

# Health check for DigitalOcean App Platform
# - Checks if Next.js server is responding
# - Runs every 30 seconds
# - Fails after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application
# Option 1: Use start.sh (runs migrations then starts server)
CMD ["./start.sh"]

# Option 2: Run migrations and start inline (alternative to start.sh)
# CMD ["sh", "-c", "npx prisma migrate deploy && yarn start"]
