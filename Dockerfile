# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# Just copy package.json
COPY package.json ./
COPY prisma ./prisma

# Install with yarn (no frozen lockfile)
RUN yarn install

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma and build
RUN yarn prisma generate
RUN yarn build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV PORT=3000

# Copy built app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

# Create user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Start app
CMD ["sh", "-c", "yarn prisma migrate deploy && yarn start"]
