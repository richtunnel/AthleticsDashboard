# Docker Quick Start Guide

Quick reference for common Docker operations with Athletics Dashboard.

## 🚀 Quick Commands

### Build & Run

```bash
# Build image
yarn docker:build

# Run container (background)
yarn docker:run:detached

# View logs
yarn docker:logs

# Stop container
yarn docker:stop
```

### With Database (Docker Compose)

```bash
# Start everything (app + postgres + adminer)
yarn docker:compose:up

# Stop everything
yarn docker:compose:down

# View logs
yarn docker:compose:logs

# Rebuild
yarn docker:compose:build
```

## 📋 Prerequisites

1. Install Docker Desktop
2. Copy environment variables:
   ```bash
   cp .env.docker .env
   # Edit .env with your values
   ```
3. Generate secrets:
   ```bash
   openssl rand -base64 32  # For NEXTAUTH_SECRET
   ```

## 🔧 Environment Setup

### Minimum Required Variables

```bash
DATABASE_URL="postgresql://user:pass@postgres:5432/db?schema=public"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="production"
```

### For Docker Compose

Use service name `postgres` as database host:
```bash
DATABASE_URL="postgresql://athleticsuser:athleticspass@postgres:5432/athleticsdb?schema=public"
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Use different port
docker run -p 3001:3000 --env-file .env athletics-dashboard:latest
```

### Database Connection Failed

```bash
# Check if database is running (for docker-compose)
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify connection string format
# postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
```

### Out of Memory During Build

```bash
# Increase Docker memory limit
# Docker Desktop > Settings > Resources > Memory > 8GB+

# Or reduce Node memory
NODE_OPTIONS="--max-old-space-size=3072"
```

### Prisma Client Not Generated

```bash
# Rebuild without cache
yarn docker:build:prod

# Or manually generate
docker-compose exec app npx prisma generate
```

## 📦 Access Points

When running with Docker Compose:
- **Application**: http://localhost:3000
- **Adminer (DB UI)**: http://localhost:8080
- **Prisma Studio**: http://localhost:5555 (if enabled)

## 🔍 Useful Commands

```bash
# Check running containers
docker ps

# Check image size
docker images athletics-dashboard

# Enter container shell
yarn docker:shell

# View container resource usage
docker stats athletics-app

# Clean up everything
docker system prune -a --volumes

# Run database migrations
docker-compose exec app npx prisma migrate deploy

# Open Prisma Studio
docker-compose exec app npx prisma studio

# Check container health
docker inspect athletics-app --format='{{.State.Health.Status}}'
```

## 🌐 Deployment

### Google Cloud Run

```bash
./deploy-cloud-run.sh YOUR_PROJECT_ID us-central1
```

### DigitalOcean App Platform

```bash
doctl apps create --spec .do/app-spec.yaml
```

### Push to Registry

```bash
# Docker Hub
docker tag athletics-dashboard:latest username/athletics-dashboard:latest
docker push username/athletics-dashboard:latest

# GitHub Container Registry
docker tag athletics-dashboard:latest ghcr.io/username/athletics-dashboard:latest
docker push ghcr.io/username/athletics-dashboard:latest
```

## 📚 More Info

- **Full documentation**: [DOCKER.md](./DOCKER.md)
- **Main README**: [README.md](./README.md)
- **Docker Compose details**: [docker-readme.md](./docker-readme.md)
