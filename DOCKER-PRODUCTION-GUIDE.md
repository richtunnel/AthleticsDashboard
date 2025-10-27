# 🐳 Production Docker Deployment Guide

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Testing](#local-testing)
- [Digital Ocean Deployment](#digital-ocean-deployment)
- [Migration Strategy](#migration-strategy)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)

---

## Overview

This guide covers deploying the Athletics Dashboard Next.js application to production using Docker on Digital Ocean App Platform.

### Tech Stack
- **Framework**: Next.js 15.5.4 (App Router)
- **Runtime**: Node.js 20 (Alpine Linux)
- **Database**: PostgreSQL 16 with Prisma 6.18.0
- **Package Manager**: Yarn 1.x
- **Container**: Multi-stage Docker build

### Architecture
```
┌─────────────────────────────────────────┐
│  Stage 1: deps                          │
│  - Install dependencies                 │
│  - Generate Prisma client               │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Stage 2: builder                       │
│  - Copy dependencies                    │
│  - Build Next.js app                    │
│  - Optimize for production              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Stage 3: runner                        │
│  - Minimal runtime image                │
│  - Run migrations on startup            │
│  - Start Next.js server                 │
└─────────────────────────────────────────┘
```

---

## Dockerfile Breakdown

The Dockerfile (`/Dockerfile`) is purpose-built for this repository and follows best practices for Next.js + Prisma on Alpine.

### Stage 1: `deps`
- **Base Image**: `node:20-alpine` to match the Node 20.x requirement in `package.json` engines.
- **System Packages**: Installs `libc6-compat` and `openssl` for Prisma's native binaries (schema.prisma targets `linux-musl-openssl-3.0.x`).
- **Working Directory**: `/app` (matches repository root expectations).
- **Copy Operations**:
  - `package.json`: The repo does not include a `yarn.lock`, so only `package.json` is copied.
  - `prisma/`: Required because `yarn install` triggers the `postinstall` script (`yarn prisma generate`), which reads the schema.
- **Install Command**: `yarn install --production=false` installs all dependencies and generates a fresh `yarn.lock` inside the container.

### Stage 2: `builder`
- **Base Image**: `node:20-alpine` again for consistency.
- **System Packages**: Adds `python3`, `make`, and `g++` to compile any native dependencies (e.g., `bcryptjs`, Prisma engines).
- **Copy Operations**:
  - `node_modules` from `deps` to avoid reinstalling.
  - Entire repository (`COPY . .`) including `src/`, `public/`, `next.config.ts`, and middleware located in `src/middleware.ts`.
- **Environment Variables**:
  - `NEXT_TELEMETRY_DISABLED=1`: Opts out of Next.js telemetry during build.
  - `NODE_ENV=production`: Ensures production optimizations.
  - `NODE_OPTIONS=--max-old-space-size=4096`: Prevents out-of-memory errors during build due to large project size.
- **Commands**:
  - `yarn prisma generate`: Regenerates Prisma Client using the schema copied earlier.
  - `yarn build`: Runs `next build`. Requires `DATABASE_URL`, so pass this as a build arg or environment variable.

### Stage 3: `runner`
- **Base Image**: `node:20-alpine` for a lightweight runtime.
- **System Packages**: Only `libc6-compat` and `openssl` are needed at runtime.
- **Environment Variables**:
  - `NODE_ENV=production`: Runs Next.js in production mode.
  - `NEXT_TELEMETRY_DISABLED=1`: Keeps telemetry disabled.
  - `NODE_OPTIONS=--max-old-space-size=4096`: Provides additional heap space.
  - `PORT=3000` and `HOSTNAME=0.0.0.0`: Matches `package.json` start script.
- **User Setup**: Creates `nextjs` user (UID 1001) and runs the app as non-root.
- **Copy Operations** (all with `--chown=nextjs:nodejs` for proper permissions):
  - `package.json`: Required for runtime scripts and Next.js metadata.
  - `next.config.ts`: Ensures runtime has access to Next.js configuration.
  - `tsconfig.json`: Some runtime tooling reads compiler options.
  - `prisma/`: Needed for migrations and Prisma client runtime.
  - `public/`: Serves static assets.
  - `.next`: Contains the compiled application output.
  - `node_modules`: Required because the project does **not** use `output: "standalone"`.
  - `start.sh*`: Optional custom start script already in repo (runs Prisma migrations before `yarn start`).
- **Health Check**: Uses Node to request `/api/health` every 30 seconds to integrate with Digital Ocean's health checks.
- **Start Command**: `CMD ["yarn", "start:prod"]`. This runs migrations (`prisma migrate deploy`) before starting the server, matching the repo's production expectations.

### Environment Variables in Dockerfile
- `NODE_ENV`, `NEXT_TELEMETRY_DISABLED`, `NODE_OPTIONS`, `PORT`, `HOSTNAME` align with `package.json` scripts and Next.js runtime behavior.
- Build stage relies on `DATABASE_URL` (passed in via `--build-arg` or platform configuration) because `yarn build` runs `prisma generate`.

### Handling Repo Specifics
- **No `yarn.lock`**: Dockerfile allows Yarn to create one during dependency installation.
- **Prisma Binary Targets**: Schema includes `linux-musl-openssl-3.0.x`, compatible with Alpine.
- **App Router Structure**: Copies `src/app`, `src/middleware.ts`, and other folders automatically via `COPY . .`.
- **Next.js Config**: Uses `next.config.ts`; the Dockerfile copies this explicitly to runtime.
- **Middleware and API**: Located under `src/`, included in build output.
- **Scripts**: Uses `start:prod` from `package.json` to ensure migrations run before server start.

---

## Prerequisites

### Required
- ✅ Docker installed locally (for testing)
- ✅ PostgreSQL database (Digital Ocean Managed Database recommended)
- ✅ All environment variables configured
- ✅ GitHub repository with code

### Optional but Recommended
- Digital Ocean account with App Platform enabled
- Domain name configured
- SSL certificate (automatically handled by DO)

---

## Environment Variables

### Required at Build Time
These MUST be available during the Docker build process:

```bash
# Required for Prisma to generate client during build
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
```

### Required at Runtime
These must be configured in Digital Ocean App Platform or your environment:

#### Core Application
```bash
NODE_ENV=production
NEXTAUTH_URL=https://your-app.ondigitalocean.app
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXT_PUBLIC_APP_URL=https://your-app.ondigitalocean.app
```

#### Database
```bash
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

#### Google Integration
```bash
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-app.ondigitalocean.app/api/auth/calendar-callback
GOOGLE_MAPS_API_KEY=your-maps-api-key
```

#### Email (Resend)
```bash
RESEND_API_KEY=re_your_api_key
EMAIL_FROM="AD Hub <noreply@yourdomain.com>"
```

#### OpenAI
```bash
OPENAI_API_KEY=sk-your-openai-key
```

#### Weather API
```bash
OPENWEATHER_API_KEY=your-weather-api-key
```

#### Stripe (Optional)
```bash
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_MONTHLY_PRICE_ID=price_your_id
STRIPE_ANNUAL_PRICE_ID=price_your_id
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_your_id
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_your_id
```

#### IP Tracking (Optional)
```bash
IPINFO_API_TOKEN=your-ipinfo-token
```

#### Account Cleanup (Optional)
```bash
CRON_SECRET=your-random-secret
ACCOUNT_DELETION_GRACE_DAYS=14
ACCOUNT_DELETION_REMINDER_DAYS=7,1
```

### Generating Secrets
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate CRON_SECRET
openssl rand -hex 32
```

---

## Local Testing

### 1. Build the Docker Image
```bash
# Build with build-time DATABASE_URL
docker build \
  --build-arg DATABASE_URL="postgresql://user:password@localhost:5432/athletics" \
  -t athletics-dashboard:latest \
  .
```

### 2. Run with Docker Compose (Recommended)
Create a `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/athletics
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: your-secret-here
      NODE_ENV: production
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: athletics
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

Run:
```bash
docker-compose up -d
```

### 3. Run Standalone
```bash
# Create an .env file with all variables
docker run -p 3000:3000 --env-file .env athletics-dashboard:latest
```

### 4. Check Logs
```bash
docker logs -f <container-id>
```

### 5. Access the Application
Open http://localhost:3000 in your browser.

---

## Digital Ocean Deployment

### Option 1: Using App Platform UI (Recommended)

1. **Create New App**
   - Go to Digital Ocean App Platform
   - Click "Create App"
   - Connect your GitHub repository
   - Select your branch (main/master)

2. **Configure Build**
   - Build source: Dockerfile
   - Dockerfile path: `Dockerfile`
   - HTTP port: `3000`

3. **Add Managed Database**
   - Add PostgreSQL 16 database
   - Name it `db`
   - Choose production plan for backups

4. **Configure Environment Variables**
   - Add all required environment variables (see section above)
   - Use `${db.DATABASE_URL}` for database connection
   - Mark sensitive values as "SECRET"
   - Set `DATABASE_URL` scope to "RUN_AND_BUILD_TIME"

5. **Configure Health Check**
   - HTTP Path: `/api/health`
   - Initial Delay: 60 seconds
   - Period: 30 seconds
   - Timeout: 10 seconds

6. **Deploy**
   - Click "Create Resources"
   - Wait for build and deployment

### Option 2: Using App Spec YAML

1. **Update `.do/app-spec.yaml`**
   - Replace `your-org/athletics-dashboard` with your repo
   - Update region if needed
   - Verify all environment variables

2. **Deploy via doctl**
   ```bash
   # Install doctl
   brew install doctl  # or snap install doctl

   # Authenticate
   doctl auth init

   # Create app
   doctl apps create --spec .do/app-spec.yaml

   # Or update existing app
   doctl apps update <app-id> --spec .do/app-spec.yaml
   ```

3. **Monitor Deployment**
   ```bash
   # Get app ID
   doctl apps list

   # Watch deployment
   doctl apps get-deployment <app-id> <deployment-id>

   # View logs
   doctl apps logs <app-id> --type run
   ```

---

## Migration Strategy

### Automatic Migrations (Recommended)

The Dockerfile uses the `start:prod` script which:
1. Runs `prisma migrate deploy` to apply pending migrations
2. Starts the Next.js server

**Package.json script:**
```json
{
  "start:prod": "yarn migrate:deploy && yarn start"
}
```

This ensures migrations run on every container start, keeping the database schema synchronized.

### Manual Migrations

If you need to run migrations manually:

```bash
# Using Digital Ocean console
doctl apps exec <app-id> -- npx prisma migrate deploy

# Or create a one-off job in app-spec.yaml
```

### Migration Best Practices

1. **Test Locally First**
   ```bash
   # Create migration
   npx prisma migrate dev --name your_migration_name

   # Test migration
   npx prisma migrate deploy
   ```

2. **Backup Before Major Changes**
   ```bash
   # Digital Ocean provides automatic backups, but you can also:
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
   ```

3. **Zero-Downtime Migrations**
   - Add columns as nullable first
   - Deploy code that works with both schemas
   - Run migration
   - Deploy code that requires new schema

### Rollback Strategy

```bash
# Mark migration as rolled back
npx prisma migrate resolve --rolled-back <migration-name>

# Or resolve as applied if already applied
npx prisma migrate resolve --applied <migration-name>

# Check migration status
npx prisma migrate status
```

---

## Troubleshooting

### Build Failures

#### Issue: "yarn.lock not found"
**Solution**: This is expected. The Dockerfile generates it during build.

#### Issue: "Prisma Client not generated"
**Solution**: Ensure DATABASE_URL is available at build time:
```bash
docker build --build-arg DATABASE_URL="your-db-url" .
```

#### Issue: "Binary target not found"
**Solution**: Verify `prisma/schema.prisma` includes:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

### Runtime Failures

#### Issue: "Cannot find module '@prisma/client'"
**Solution**: Ensure node_modules includes Prisma Client. Check build logs.

#### Issue: "Database connection failed"
**Solution**: 
- Verify DATABASE_URL is correct
- Check database is accessible from container
- Verify SSL mode if required
- Check firewall rules

#### Issue: "Health check failing"
**Solution**:
- Check `/api/health` endpoint returns 200
- Increase initial_delay_seconds if app needs more startup time
- Check logs for errors

#### Issue: "Static assets 404"
**Solution**:
- Verify `public/` directory is copied in Dockerfile
- Check `.next/static` is present
- Verify Next.js build completed successfully

### Performance Issues

#### Issue: "High memory usage"
**Solution**: 
- Increase container memory (use professional-m or higher)
- Check for memory leaks in logs
- Monitor with Digital Ocean metrics

#### Issue: "Slow cold starts"
**Solution**:
- Use professional tier (better resources)
- Optimize Dockerfile (multi-stage builds already implemented)
- Consider keeping minimum 1 instance always running

---

## Performance Optimization

### 1. Image Size Optimization
Current Dockerfile uses:
- ✅ Alpine Linux (minimal base)
- ✅ Multi-stage builds
- ✅ Only production dependencies in runtime
- ✅ .dockerignore to exclude unnecessary files

**Image size breakdown:**
- deps: ~500MB (includes dev dependencies)
- builder: ~700MB (includes build artifacts)
- runner: ~400MB (production only)

### 2. Build Time Optimization
```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker build .

# Use layer caching
docker build --cache-from athletics-dashboard:latest .
```

### 3. Runtime Optimization
- Use professional tier for better CPU
- Enable HTTP/2 and compression (already enabled in next.config.ts)
- Configure CDN for static assets
- Use connection pooling (enabled in production database)

### 4. Monitoring
```bash
# Check container stats
docker stats <container-id>

# View resource usage in Digital Ocean
# Go to App Platform → Metrics
```

---

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Prisma Production Best Practices](https://www.prisma.io/docs/guides/deployment/deployment-guides)
- [Digital Ocean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## Support

If you encounter issues:
1. Check logs: `docker logs <container-id>` or in DO Console
2. Verify environment variables are set correctly
3. Test database connection independently
4. Review health check endpoint response
5. Check Prisma migration status

For production issues:
- Enable DO alerts for failures
- Set up logging aggregation
- Monitor health check endpoint
- Keep regular database backups
