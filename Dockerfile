# syntax=docker/dockerfile:1
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY package.json yarn.lock* ./
COPY prisma ./prisma

# Mount the Yarn cache so packages are only downloaded once across builds.
RUN --mount=type=cache,target=/root/.yarn \
    YARN_CACHE_FOLDER=/root/.yarn \
    yarn install --frozen-lockfile --network-timeout 300000 --network-concurrency 3

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# --no-network-family-autoselection forces IPv4 during the build. This host's
# IPv6 route is broken, so without it `next/font` can't reach Google Fonts
# (fonts.gstatic.com) and falls back to a system font with a build warning.
ENV NODE_OPTIONS="--max-old-space-size=4096 --no-network-family-autoselection"
# Prevent BullMQ/IORedis from attempting a Redis connection during `next build`.
# At build time there is no Redis service, so any module that imports queues.ts
# must not trigger a TCP dial. Runtime containers supply the real REDIS_URL via
# their environment / secrets.
ENV REDIS_URL=disabled

RUN yarn prisma generate
# Mount the Next.js cache so fonts (next/font/google) and webpack modules are
# reused across builds instead of re-downloaded every time.
RUN --mount=type=cache,target=/app/.next/cache \
    yarn build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./
# Source + tsconfig are needed at runtime for the BullMQ worker process
# (tsx executes TypeScript directly — see `npm run worker`)
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./

USER nextjs

EXPOSE 3000

CMD ["yarn", "start"]