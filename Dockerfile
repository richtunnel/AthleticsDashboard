# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app

# Install OS packages required by Prisma / OpenSSL
RUN apk add --no-cache openssl libc6-compat

# Stage 2: Dependencies
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Stage 3: Builder
FROM base AS builder

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy all source files
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application with standalone output
RUN npm run build

# Stage 4: Runner (Minimal production image)
FROM node:20-alpine AS runner
WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache openssl libc6-compat

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy public assets (if any exist)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma for migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Install only prisma CLI for migrations (much smaller than full node_modules)
RUN npm install --production --no-save prisma @prisma/client

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations and start the server
CMD npx prisma migrate deploy && node server.js