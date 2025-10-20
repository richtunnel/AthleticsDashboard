# Build stage
FROM node:20-alpine AS builder

# Install necessary build tools for native dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Set working directory
WORKDIR /app

# Copy package files and Prisma schema
COPY package.json yarn.lock* prisma ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Generate Prisma client and build Next.js
RUN yarn prisma generate
RUN yarn build

# Production stage
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=512"

# Install minimal dependencies for Prisma runtime
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Install only production dependencies
RUN yarn install --production --frozen-lockfile --no-engines

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start the application with migrations
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]