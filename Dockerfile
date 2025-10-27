# Stage 1: Install dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Required packages for native bindings and Prisma
RUN apk add --no-cache libc6-compat openssl

# Copy package manifests and Prisma schema
COPY package.json yarn.lock* ./
COPY prisma ./prisma

# Install dependencies (fallback to available package manager)
RUN \
  if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  else yarn install --non-interactive --no-progress; \
  fi

# Stage 2: Build application
FROM node:20-alpine AS builder

WORKDIR /app

# System dependencies for building native modules
RUN apk add --no-cache libc6-compat openssl python3 make g++

# Reuse installed node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy project files
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Generate Prisma client prior to building
RUN npx prisma generate

# Build Next.js application (supports yarn/npm/pnpm)
RUN \
  if [ -f yarn.lock ]; then yarn build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else yarn build; \
  fi

# Stage 3: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy minimal artifacts required at runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh

# Ensure entrypoint is executable and owned by runtime user
RUN chmod +x ./docker-entrypoint.sh
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["./docker-entrypoint.sh"]
