# =============================================================================
# PRODUCTION DOCKERFILE FOR NEXT.JS 15 APP WITH PRISMA
# =============================================================================
# This Dockerfile is optimized for:
# - Next.js 15.5.4 with App Router
# - React 19
# - Prisma 6.18.0 with PostgreSQL
# - Alpine Linux (musl)
# - Digital Ocean App Platform deployment
# - Yarn package manager (NO lockfile present - will be generated)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# Install all dependencies including devDependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Install system dependencies for Prisma and native modules
# - libc6-compat: glibc compatibility layer for Alpine
# - openssl: required by Prisma for database connections
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files
# Note: yarn.lock doesn't exist in this repo, yarn will generate one
COPY package.json ./

# Copy Prisma schema for generation during install
# This is needed because postinstall runs prisma generate
COPY prisma ./prisma/

# Install dependencies
# --frozen-lockfile is omitted since no yarn.lock exists
# Yarn will create one during install
RUN yarn install --production=false

# -----------------------------------------------------------------------------
# Stage 2: Builder
# Build the Next.js application
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install build dependencies
# - python3, make, g++: needed for native module compilation
RUN apk add --no-cache libc6-compat openssl python3 make g++

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Generate Prisma Client with correct binary targets for Alpine Linux
# schema.prisma already includes: binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
RUN yarn prisma generate

# Build Next.js application
# Note: DATABASE_URL is required at build time for Prisma
# It should be provided via build args or environment in Digital Ocean
RUN yarn build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# Production runtime with minimal dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# We need to include node_modules because Next.js is NOT using standalone output

# Package files
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Next.js config (TypeScript version)
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

# TypeScript config (needed for runtime type checking if enabled)
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Prisma files (needed for migrations and runtime)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Public static assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Node modules (required because we're not using standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy start script if it exists
COPY --from=builder --chown=nextjs:nodejs /app/start.sh* ./

# Switch to non-root user
USER nextjs

# Expose the port Next.js runs on
EXPOSE 3000

# Health check endpoint
# Digital Ocean expects /api/health to return 200 when healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start command
# Use the start:prod script which runs migrations then starts the app
# This ensures database is up to date before serving traffic
CMD ["yarn", "start:prod"]
