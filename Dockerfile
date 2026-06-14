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
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Prevent BullMQ/IORedis from attempting a Redis connection during `next build`.
# At build time there is no Redis service, so any module that imports queues.ts
# must not trigger a TCP dial. Runtime containers supply the real REDIS_URL via
# their environment / secrets.
ENV REDIS_URL=disabled

# STABLE Server Actions encryption key. Next.js randomizes this on every build
# unless set, so each deploy changes all Server Action IDs and any already-loaded
# browser page fails with "Failed to find Server Action ... older or newer
# deployment". A fixed key keeps action IDs stable across builds. MUST equal the
# runtime NEXT_SERVER_ACTIONS_ENCRYPTION_KEY in docker-compose. Override via
# build-arg to rotate.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="W4lmggaATohMmpfI7mds2rVrS8DcQlTnCPAWDMQ2MMI="
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

RUN yarn prisma generate
# Build WITHOUT a persisted .next/cache mount. Reusing Next's build cache across
# Docker builds can desync Server Action IDs (content-hashed at build time),
# producing a build where the client bundle references action IDs the server
# bundle doesn't register → "Failed to find Server Action ... older or newer
# deployment" on every request. A clean build each time keeps client/server
# action manifests consistent.
RUN yarn build

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