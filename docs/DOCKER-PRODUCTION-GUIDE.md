# Perfect Production Dockerfile Guide

## Overview

This guide explains the production-ready Dockerfile created specifically for this Athletics Dashboard application. The Dockerfile is tailored to the actual repository structure and handles all the specific requirements of this Next.js 15 + Prisma + Yarn application.

## Table of Contents

1. [Repository Analysis](#repository-analysis)
2. [Dockerfile Breakdown](#dockerfile-breakdown)
3. [Required Environment Variables](#required-environment-variables)
4. [Digital Ocean Deployment](#digital-ocean-deployment)
5. [Local Testing](#local-testing)
6. [Migration Strategy](#migration-strategy)
7. [Troubleshooting](#troubleshooting)

---

## Repository Analysis

### Actual Stack
- **Next.js**: 15.5.4 (App Router)
- **React**: 19.1.0
- **Node.js**: 20.x
- **Package Manager**: Yarn 1.x
- **Database**: PostgreSQL via Prisma 6.18.0
- **Architecture**: TypeScript, App Router at `src/app/`

### Key Findings
1. **No yarn.lock committed** - It's in `.gitignore`
2. **Prisma postinstall hook** - Runs `prisma generate` after install
3. **Build-time DATABASE_URL** - Required for Prisma client generation
4. **Binary targets** - Schema specifies `["native", "linux-musl-openssl-3.0.x"]` for Alpine
5. **Middleware** - Located at `src/middleware.ts`
6. **Start script** - `start.sh` handles migrations before server start

### File Structure
```
/home/engine/project/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   ├── lib/             # Services and utilities
│   ├── middleware.ts    # NextAuth middleware
│   └── types/           # TypeScript types
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── migrations/      # Migration history
│   └── seed.ts         # Database seeding
├── public/              # Static assets
├── package.json         # Dependencies
├── next.config.ts       # Next.js config (TypeScript)
├── tsconfig.json        # TypeScript config
└── start.sh            # Startup script
```

---

## Dockerfile Breakdown

### Stage 1: Dependencies (deps)
```dockerfile
FROM node:20-alpine AS deps
```

**Purpose**: Install all npm dependencies

**Why Alpine?**
- Small image size (~50MB base vs ~300MB for full Node)
- Prisma supports `linux-musl-openssl-3.0.x` binary target
- Sufficient for our needs

**Key Steps:**
1. Install system dependencies (libc6-compat, openssl)
2. Copy `package.json` and optional `yarn.lock`
3. Copy `prisma/` directory for postinstall hook
4. Run `yarn install` to install all dependencies

**Why copy Prisma early?**
The `postinstall` script in `package.json` runs `prisma generate`, which requires `prisma/schema.prisma` to exist.

### Stage 2: Builder
```dockerfile
FROM node:20-alpine AS builder
```

**Purpose**: Build the Next.js application

**Key Steps:**
1. Install build tools (python3, make, g++) for native modules
2. Copy dependencies from `deps` stage
3. Copy all source code
4. Generate Prisma Client (`yarn prisma generate`)
5. Build Next.js (`yarn build`)

**Environment Variables:**
- `NEXT_TELEMETRY_DISABLED=1`: Disable telemetry
- `NODE_OPTIONS="--max-old-space-size=4096"`: Increase memory for build
- `DATABASE_URL`: Placeholder for Prisma (doesn't connect during build)

**Build Order is Critical:**
1. Prisma generate MUST happen before Next.js build
2. Next.js build imports `@prisma/client`, so it must exist

### Stage 3: Runner (Production)
```dockerfile
FROM node:20-alpine AS runner
```

**Purpose**: Minimal production runtime

**Key Features:**
1. **Security**: Non-root user (`nextjs:nodejs`, UID/GID 1001)
2. **Minimal size**: Only copies necessary files
3. **Health check**: Built-in Docker health check
4. **Migrations**: `start.sh` runs migrations before server start

**Files Copied:**
- `package.json`, `yarn.lock`: Dependency metadata
- `next.config.ts`: Next.js configuration
- `prisma/`: Schema and migrations for runtime migrations
- `public/`: Static assets
- `.next/`: Built application
- `node_modules/`: All runtime dependencies
- `start.sh`: Startup script

**Why copy node_modules?**
Unlike standalone mode, this copies the full node_modules. This is necessary because:
1. `next.config.ts` doesn't specify `output: 'standalone'`
2. Prisma client needs to be available at runtime
3. Other dependencies needed for API routes

---

## Required Environment Variables

### Build-Time Variables (optional for this setup)
These can be provided during `docker build` if needed for client-side code:

```bash
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID="price_xxx"
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID="price_xxx"
```

### Runtime Variables (REQUIRED)
These must be provided when running the container:

#### Database
```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"
```

#### Authentication
```bash
NEXTAUTH_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

#### Google OAuth & Calendar
```bash
GOOGLE_CALENDAR_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CALENDAR_CLIENT_SECRET="xxx"
GOOGLE_REDIRECT_URI="https://your-domain.com/api/auth/calendar-callback"
GOOGLE_MAPS_API_KEY="xxx"
```

#### Email (Resend)
```bash
RESEND_API_KEY="re_xxx"
EMAIL_FROM="Your App <noreply@yourdomain.com>"
```

#### Stripe
```bash
STRIPE_SECRET_KEY="sk_live_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
STRIPE_MONTHLY_PRICE_ID="price_xxx"
STRIPE_ANNUAL_PRICE_ID="price_xxx"
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID="price_xxx"
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID="price_xxx"
```

#### OpenAI
```bash
OPENAI_API_KEY="sk-xxx"
```

#### Optional Services
```bash
OPENWEATHER_API_KEY="xxx"
IPINFO_API_TOKEN="xxx"
CRON_SECRET="xxx"
ACCOUNT_DELETION_GRACE_DAYS="14"
ACCOUNT_DELETION_REMINDER_DAYS="7,1"
```

---

## Digital Ocean Deployment

### Method 1: Using App Spec YAML (Recommended)

1. **Create App from App Spec**
   ```bash
   doctl apps create --spec .do/app-spec.yaml
   ```

2. **Update Environment Variables**
   - Go to DigitalOcean dashboard
   - Navigate to your app → Settings → App-Level Environment Variables
   - Add all required secrets (see `.do/app-spec.yaml` for list)

3. **Deploy**
   - Push to your main branch
   - DigitalOcean automatically builds using the Dockerfile

### Method 2: Using Container Registry

1. **Build and Push**
   ```bash
   # Login to DO registry
   doctl registry login
   
   # Build for production
   docker build --platform linux/amd64 \
     -t registry.digitalocean.com/your-registry/athletics-dashboard:latest .
   
   # Push
   docker push registry.digitalocean.com/your-registry/athletics-dashboard:latest
   ```

2. **Create App from Registry**
   - Use DigitalOcean dashboard
   - Select "Docker Hub or Container Registry"
   - Point to your image

### Method 3: GitHub Integration

1. **Connect GitHub Repo**
   - Create app in DigitalOcean
   - Select "Use Dockerfile"
   - Point to `/Dockerfile`

2. **Configure Build**
   - Build context: `/`
   - Dockerfile path: `Dockerfile`

3. **Set Environment Variables**
   - Add all required variables in dashboard
   - Mark sensitive ones as "Secret"

---

## Local Testing

### Test with Docker Compose

```bash
# Start PostgreSQL + App
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

### Test Dockerfile Alone

```bash
# Build
docker build -t athletics-dashboard:test .

# Run with env file
docker run -p 3000:3000 --env-file .env athletics-dashboard:test

# Or with individual vars
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="xxx" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  athletics-dashboard:test
```

### Test Health Check

```bash
# Check if health endpoint works
curl http://localhost:3000/api/health

# Should return: {"status":"ok"}
```

---

## Migration Strategy

### How Migrations Work

1. **During Build**: Prisma schema is copied, client is generated
2. **Before Server Start**: `start.sh` runs `prisma migrate deploy`
3. **Server Starts**: Only after migrations succeed

### Migration Files

All migrations are in `prisma/migrations/`. They are:
- Included in Docker build context
- Copied to final image
- Applied at runtime using `prisma migrate deploy`

### Manual Migration Management

**Check migration status:**
```bash
docker exec -it <container> npx prisma migrate status
```

**Apply migrations manually:**
```bash
docker exec -it <container> npx prisma migrate deploy
```

**Rollback (if needed):**
```bash
# This app uses the troubleshoot scripts
docker exec -it <container> bash ./scripts/prisma-migration-troubleshoot.sh status
```

### Creating New Migrations

**Development:**
```bash
# On your local machine
yarn prisma migrate dev --name your_migration_name
```

**Production Deployment:**
1. Commit migration files to git
2. Push to main branch
3. DigitalOcean rebuilds image with new migrations
4. `start.sh` applies migrations before starting

---

## Troubleshooting

### Build Failures

**"yarn.lock not found"**
- This is OK! The Dockerfile uses `yarn.lock*` (optional)
- Yarn generates a new lock file during build

**"Cannot find module '@prisma/client'"**
- Ensure `yarn prisma generate` runs before `yarn build`
- Check that `prisma/` directory is copied before install

**"Out of memory"**
- Increase `NODE_OPTIONS="--max-old-space-size=4096"` (or higher)
- Use larger builder instance in CI/CD

### Runtime Failures

**"PrismaClient is unable to run in the browser"**
- This is a client-side import issue
- Ensure Prisma is only imported in server components/API routes

**"Can't reach database server"**
- Check `DATABASE_URL` is set correctly
- Verify database allows connections from your app
- Check SSL mode: `?sslmode=require`

**"Migration failed"**
- Check if migrations are already applied: `prisma migrate status`
- Resolve conflicts: Use troubleshoot scripts in `scripts/`
- Manual resolve: `prisma migrate resolve --rolled-back <migration>`

**"Port already in use"**
- Change port mapping: `-p 3001:3000`
- Or stop conflicting container

### Health Check Failures

**Health check always failing**
- Verify `/api/health` endpoint is accessible
- Check if app is actually starting (view logs)
- Increase `initial_delay_seconds` if app takes long to start

### Performance Issues

**Slow build times**
- Use layer caching (don't change package.json frequently)
- Use Docker build cache
- Consider using standalone output mode in next.config.ts

**Large image size**
- Current image should be ~500-800MB
- To reduce: Enable standalone mode, remove dev dependencies
- Use `.dockerignore` to exclude unnecessary files

---

## Next Steps

1. **Test Locally**: Run with docker-compose to verify everything works
2. **Setup CI/CD**: Automate builds using GitHub Actions or DO's built-in CI
3. **Monitor**: Set up logging and monitoring in production
4. **Scale**: Adjust instance size and enable auto-scaling as needed
5. **Optimize**: Consider switching to standalone mode for smaller images

---

## Key Differences from Generic Dockerfiles

This Dockerfile is specifically designed for THIS repository:

✅ Handles missing yarn.lock (not committed)
✅ Copies Prisma before install (postinstall hook needs it)
✅ Uses correct TypeScript config file (next.config.ts, not .js)
✅ Includes start.sh for migration handling
✅ Uses Alpine-compatible Prisma binary
✅ Copies all necessary runtime files
✅ Has proper health check endpoint
✅ Follows this app's actual build process

**This is NOT a generic template** - it's built from analyzing YOUR actual repository structure and requirements.

---

## Support

For issues specific to this Dockerfile:
1. Check build logs
2. Verify environment variables
3. Test locally with docker-compose
4. Check DigitalOcean app logs

For application issues, refer to the main README.md.
