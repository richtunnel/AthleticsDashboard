# Docker Deployment Guide for Athletics Dashboard

This guide covers building, running, and deploying the Athletics Dashboard application using Docker, optimized for memory-constrained environments like App Platform, Cloud Run, and other container platforms.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Building the Docker Image](#building-the-docker-image)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Memory Optimization](#memory-optimization)
- [Troubleshooting](#troubleshooting)

## Overview

The Docker setup uses a multi-stage build process optimized for:

- **Reduced memory usage** during builds (4GB limit)
- **Smaller image size** (<500MB target)
- **Faster builds** with layer caching
- **Production-ready** with Next.js standalone output
- **Security** with non-root user execution

### Architecture

```
┌─────────────────┐
│  deps stage     │  Install dependencies only
│  (cached)       │
└────────┬────────┘
         │
┌────────▼────────┐
│ builder stage   │  Build Next.js app + Prisma
│                 │
└────────┬────────┘
         │
┌────────▼────────┐
│ runner stage    │  Minimal production runtime
│ (~300-400MB)    │
└─────────────────┘
```

## Prerequisites

- Docker Desktop or Docker Engine (20.10+)
- Docker Compose (2.0+) - for local development with database
- 4GB+ RAM available for Docker
- Git

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/athletics-dashboard.git
cd athletics-dashboard

# Copy environment variables
cp .env.example .env

# Edit .env with your values
nano .env
```

### 2. Generate Required Secrets

```bash
# Generate NextAuth secret
openssl rand -base64 32

# Add to .env as NEXTAUTH_SECRET
```

### 3. Build and Run

**Option A: Using npm scripts (recommended)**

```bash
# Build the Docker image
yarn docker:build

# Run the container
yarn docker:run:detached

# View logs
yarn docker:logs

# Stop container
yarn docker:stop
```

**Option B: Using Docker Compose (with database)**

```bash
# Start all services (app + postgres + adminer)
yarn docker:compose:up

# View logs
yarn docker:compose:logs

# Stop all services
yarn docker:compose:down
```

**Option C: Direct Docker commands**

```bash
# Build
docker build -t athletics-dashboard:latest .

# Run
docker run -p 3000:3000 --env-file .env athletics-dashboard:latest
```

The application will be available at http://localhost:3000

## Building the Docker Image

### Standard Build

```bash
yarn docker:build
```

Or directly:

```bash
docker build -t athletics-dashboard:latest .
```

### Build Without Cache (clean build)

```bash
yarn docker:build:prod
```

### Build for Specific Platform

```bash
# For Apple Silicon (M1/M2) deployment to x86 platforms
docker build --platform linux/amd64 -t athletics-dashboard:latest .

# For ARM platforms (like AWS Graviton)
docker build --platform linux/arm64 -t athletics-dashboard:latest .
```

### Optimize Build Performance

Enable BuildKit for faster, more efficient builds:

```bash
# Set environment variable
export DOCKER_BUILDKIT=1

# Or add to ~/.bashrc or ~/.zshrc
echo 'export DOCKER_BUILDKIT=1' >> ~/.bashrc
```

## Running Locally

### With Docker Run

```bash
# Interactive mode (logs to console)
docker run -p 3000:3000 --env-file .env athletics-dashboard:latest

# Detached mode (background)
docker run -d -p 3000:3000 --env-file .env --name athletics-app athletics-dashboard:latest

# View logs
docker logs -f athletics-app

# Stop container
docker stop athletics-app && docker rm athletics-app
```

### With Docker Compose

The `docker-compose.yml` provides a complete local environment with:

- Application server
- PostgreSQL database
- Adminer (database management UI)

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs for specific service
docker-compose logs -f app

# Access container shell
docker-compose exec app sh

# Run database migrations
docker-compose exec app npx prisma migrate deploy

# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

Access points:

- **Application**: http://localhost:3000
- **Adminer**: http://localhost:8080

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-from-openssl-rand-base64-32"

# Node Environment
NODE_ENV="production"
```

### Optional Variables

```bash
# Google OAuth & Calendar
GOOGLE_CALENDAR_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CALENDAR_CLIENT_SECRET="your-client-secret"
GOOGLE_MAPS_API_KEY="your-maps-api-key"

# Email (Resend)
NEXT_PUBLIC_RESEND_API_KEY="re_your_api_key"
EMAIL_FROM="AD Hub <noreply@athleticdirectorhub.com>"

# AI Features
OPENAI_API_KEY="sk-your-openai-api-key"
OPENWEATHER_API_KEY="your-weather-api-key"

# Payment (Stripe)
STRIPE_SECRET_KEY="sk_live_your_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
```

### Environment Variable Management

For production deployments, use your platform's secrets management:

- **App Platform**: Use App-Level Environment Variables
- **Cloud Run**: Use Secret Manager
- **AWS**: Use Parameter Store or Secrets Manager
- **Azure**: Use Key Vault
- **Kubernetes**: Use Secrets

## Deployment

### Google Cloud Run

#### 1. Build and Push to Container Registry

```bash
# Set your project
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"

# Build for Cloud Run
docker build --platform linux/amd64 -t gcr.io/$PROJECT_ID/athletics-dashboard:latest .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/athletics-dashboard:latest
```

#### 2. Deploy to Cloud Run

```bash
gcloud run deploy athletics-dashboard \
  --image gcr.io/$PROJECT_ID/athletics-dashboard:latest \
  --platform managed \
  --region $REGION \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars NEXTAUTH_URL=https://your-domain.com
```

#### 3. Set Secrets (recommended)

```bash
# Create secrets in Secret Manager
echo -n "your-nextauth-secret" | gcloud secrets create nextauth-secret --data-file=-
echo -n "your-database-url" | gcloud secrets create database-url --data-file=-

# Deploy with secrets
gcloud run deploy athletics-dashboard \
  --image gcr.io/$PROJECT_ID/athletics-dashboard:latest \
  --set-secrets DATABASE_URL=database-url:latest,NEXTAUTH_SECRET=nextauth-secret:latest
```

### DigitalOcean App Platform

#### 1. Using DigitalOcean Container Registry

```bash
# Tag image
docker tag athletics-dashboard:latest registry.digitalocean.com/your-registry/athletics-dashboard:latest

# Push to registry
docker push registry.digitalocean.com/your-registry/athletics-dashboard:latest
```

#### 2. Deploy via App Platform UI

1. Create new app from Container Registry
2. Select your image
3. Configure resources:
   - **Plan**: Professional (4GB RAM recommended)
   - **CPU**: 2 vCPUs
   - **Memory**: 4GB
4. Add environment variables
5. Deploy

#### 3. Deploy via `doctl` CLI

```bash
# Create app spec
doctl apps create --spec .do/app.yaml

# Update app
doctl apps update your-app-id --spec .do/app.yaml
```

Example `.do/app.yaml`:

```yaml
name: athletics-dashboard
region: nyc
services:
  - name: web
    image:
      registry_type: DOCR
      repository: athletics-dashboard
      tag: latest
    instance_count: 1
    instance_size_slug: professional-s
    http_port: 3000
    routes:
      - path: /
    health_check:
      http_path: /api/health
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}
        type: SECRET
databases:
  - name: db
    engine: PG
    version: "16"
```

### AWS (ECS/Fargate)

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker build -t athletics-dashboard .
docker tag athletics-dashboard:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/athletics-dashboard:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/athletics-dashboard:latest

# Deploy via ECS CLI or Console
```

### Azure Container Instances

```bash
# Push to Azure Container Registry
az acr build --registry myregistry --image athletics-dashboard:latest .

# Deploy to Container Instances
az container create \
  --resource-group myResourceGroup \
  --name athletics-dashboard \
  --image myregistry.azurecr.io/athletics-dashboard:latest \
  --cpu 2 \
  --memory 4 \
  --ports 3000 \
  --environment-variables NODE_ENV=production
```

### Render

1. Connect your GitHub repository
2. Create new Web Service
3. Use Docker runtime
4. Set environment variables
5. Deploy

Configuration:

- **Docker Command**: (leave empty, uses CMD from Dockerfile)
- **Plan**: Starter or higher (2GB+ RAM)
- **Region**: Choose nearest to users

## Memory Optimization

The Docker build is optimized for memory-constrained environments:

### Build-Time Optimization

- **Max Old Space Size**: Limited to 4GB via `NODE_OPTIONS="--max-old-space-size=4096"`
- **Multi-stage build**: Separates dependencies, build, and runtime
- **Layer caching**: Optimizes rebuild times
- **Standalone output**: Includes only necessary files

### Runtime Optimization

- **Alpine Linux**: Smaller base image (~5MB vs ~100MB)
- **Production dependencies only**: No dev dependencies in final image
- **Next.js standalone**: Minimal server bundle
- **Non-root user**: Better security and resource isolation

### Memory Usage

Expected memory usage:

- **Build time**: ~2-4GB peak
- **Runtime**: ~300-500MB idle, ~1-2GB under load
- **Image size**: ~300-400MB

### If You Encounter OOM Errors

1. **Increase platform memory limits**:

   ```yaml
   # docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 6G
   ```

2. **Reduce Next.js build concurrency**:

   ```bash
   # Add to environment
   NODE_OPTIONS="--max-old-space-size=3072"
   ```

3. **Use build machine with more RAM**:
   - Cloud Run: Build separately, don't use `gcloud run deploy --source`
   - App Platform: Use external CI/CD like GitHub Actions

4. **Split build and deploy**:

   ```bash
   # Build locally or in CI with more resources
   docker build -t athletics-dashboard:latest .

   # Push to registry
   docker push your-registry/athletics-dashboard:latest

   # Deploy from registry (no build needed)
   ```

## Troubleshooting

### Build Issues

#### "Out of memory" during build

```bash
# Option 1: Increase Docker memory limit
# Docker Desktop > Settings > Resources > Memory > 8GB+

# Option 2: Build with external machine
# Use GitHub Actions, CircleCI, or cloud build service

# Option 3: Reduce max old space size
NODE_OPTIONS="--max-old-space-size=2048"
```

#### "ENOENT: no such file or directory" for Prisma

```bash
# Ensure Prisma schema is included
# Check .dockerignore doesn't exclude prisma/

# Rebuild without cache
docker build --no-cache -t athletics-dashboard:latest .
```

#### Slow builds

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Use build cache
docker build --cache-from athletics-dashboard:latest .

# Clean up build cache if needed
docker builder prune
```

### Runtime Issues

#### Database connection fails

```bash
# Check DATABASE_URL format
postgresql://user:password@host:5432/dbname?schema=public

# For docker-compose, use service name as host
postgresql://user:password@postgres:5432/dbname?schema=public

# Check network connectivity
docker-compose exec app ping postgres
```

#### Migrations don't run

```bash
# Run migrations manually
docker-compose exec app npx prisma migrate deploy

# Check migration status
docker-compose exec app npx prisma migrate status

# Reset database (development only!)
docker-compose exec app npx prisma migrate reset
```

#### "Cannot find module './server.js'"

```bash
# Verify standalone output is enabled in next.config.ts
output: "standalone"

# Check .next/standalone/server.js exists in builder
docker build --target builder -t test-builder .
docker run --rm test-builder ls -la .next/standalone/
```

#### Port already in use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
docker run -p 3001:3000 athletics-dashboard:latest
```

#### Permission denied errors

```bash
# Check file ownership
docker-compose exec app ls -la

# Rebuild with proper permissions
docker-compose build --no-cache
```

### Performance Issues

#### Slow response times

```bash
# Check resource usage
docker stats athletics-app

# Increase memory/CPU limits
# In docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 4G
      cpus: '2'
```

#### High memory usage

```bash
# Monitor memory
docker stats --format "table {{.Name}}\t{{.MemUsage}}"

# Check for memory leaks in logs
docker-compose logs -f app | grep -i "memory\|heap"

# Restart container if needed
docker-compose restart app
```

## Health Checks

### Application Health

```bash
# Check if app is responding
curl http://localhost:3000/api/health

# Check database connectivity
docker-compose exec app npx prisma db push --help
```

### Database Health

```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready

# Connect to database
docker-compose exec postgres psql -U athleticsuser -d athleticsdb
```

## Best Practices

1. **Always use environment variables** for secrets, never hard-code
2. **Run migrations on startup** in production (already configured in CMD)
3. **Use health checks** in production orchestration
4. **Monitor resource usage** and adjust limits as needed
5. **Keep images updated** regularly for security patches
6. **Use tagged versions** (not just `:latest`) in production
7. **Implement logging** and use log aggregation services
8. **Set up monitoring** (APM, error tracking)
9. **Use database connection pooling** for high traffic
10. **Enable HTTPS** with reverse proxy or platform SSL

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t athletics-dashboard:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin
          docker tag athletics-dashboard:${{ github.sha }} registry.example.com/athletics-dashboard:${{ github.sha }}
          docker push registry.example.com/athletics-dashboard:${{ github.sha }}
```

## Additional Resources

- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [Prisma in Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel#using-prisma-with-docker)
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [DigitalOcean App Platform](https://docs.digitalocean.com/products/app-platform/)

## Support

For issues:

- Docker setup: See this guide
- Application: See main README.md
- Deployment: Check platform-specific docs

## License

See main repository for license information.
