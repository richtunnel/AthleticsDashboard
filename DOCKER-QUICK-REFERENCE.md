# 🚀 Docker Quick Reference

## Quick Commands

### Local Development

```bash
# Build the image
docker build -t athletics-dashboard:latest .

# Run with environment file
docker run -p 3000:3000 --env-file .env athletics-dashboard:latest

# Run detached with name
docker run -d -p 3000:3000 --name athletics --env-file .env athletics-dashboard:latest

# View logs
docker logs -f athletics

# Stop and remove
docker stop athletics && docker rm athletics

# Shell into running container
docker exec -it athletics sh
```

### Using Docker Compose

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop everything
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Digital Ocean

```bash
# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/app-spec.yaml

# Update existing app
doctl apps update <app-id> --spec .do/app-spec.yaml

# View logs
doctl apps logs <app-id> --type run

# List deployments
doctl apps list-deployments <app-id>
```

---

## File Verification Checklist

Before deploying, verify these files exist and are correct:

- ✅ `Dockerfile` - Production-ready multi-stage build
- ✅ `.dockerignore` - Excludes unnecessary files
- ✅ `package.json` - Contains `start:prod` script
- ✅ `next.config.ts` - TypeScript config (not .js)
- ✅ `prisma/schema.prisma` - Contains Alpine binary targets
- ✅ `src/app/api/health/route.ts` - Health check endpoint
- ✅ `.do/app-spec.yaml` - Digital Ocean configuration
- ✅ `start.sh` - Optional migration script

---

## Environment Variables Quick Reference

### Minimal Required (for build & run)
```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<random-32-chars>
NEXTAUTH_URL=https://your-app.com
NODE_ENV=production
```

### Full Production Set
See [DOCKER-PRODUCTION-GUIDE.md](./DOCKER-PRODUCTION-GUIDE.md#environment-variables) for complete list.

---

## Troubleshooting Quick Fixes

### "Cannot connect to database"
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
docker exec <container> npx prisma db execute --stdin <<< "SELECT 1"
```

### "Health check failing"
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Check logs
docker logs <container>
```

### "Build fails with Prisma error"
```bash
# Ensure DATABASE_URL available at build time
docker build --build-arg DATABASE_URL="postgresql://..." .
```

### "Static files 404"
```bash
# Verify .next directory in image
docker exec <container> ls -la /app/.next

# Verify public directory
docker exec <container> ls -la /app/public
```

### "Out of memory during build"
```bash
# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory: 8GB

# Or use builder with more resources
docker build --memory=8g .
```

---

## Digital Ocean Deployment Checklist

### Pre-Deployment
- [ ] GitHub repo connected
- [ ] All environment variables configured in DO
- [ ] Database created and connected
- [ ] `DATABASE_URL` set to `RUN_AND_BUILD_TIME` scope
- [ ] Health check configured: `/api/health`
- [ ] Resource tier selected (recommended: professional-s)

### Post-Deployment
- [ ] Build completed successfully
- [ ] Health check passing
- [ ] Database migrations applied
- [ ] Static assets loading
- [ ] Authentication working
- [ ] API endpoints responding
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificate active
- [ ] Alerts configured

### Monitoring
- [ ] Check metrics dashboard
- [ ] Review logs for errors
- [ ] Test all critical paths
- [ ] Verify external integrations (Google, Stripe, etc.)

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| No yarn.lock | Expected - generated during build |
| Prisma binary not found | Verify `linux-musl-openssl-3.0.x` in schema.prisma |
| Build timeout | Increase DO build timeout or use lighter instance |
| 502 Gateway error | Check health check, logs, and startup time |
| Database migration fails | Check migration files, run `prisma migrate status` |
| Static assets 404 | Verify public/ copied and .next/static exists |
| Memory exceeded | Use professional tier or optimize code |

---

## Performance Optimization Tips

1. **Use Professional Tier**: Better CPU and reliability
2. **Enable Connection Pooling**: Included in DO managed database
3. **Monitor Metrics**: Check CPU, memory, and response times
4. **Optimize Images**: Already using Alpine Linux
5. **Cache Dependencies**: Use BuildKit for faster builds
6. **CDN for Assets**: Consider CloudFlare or DO Spaces

---

## Resource Sizing Guide

| Traffic Level | Instance Size | Recommendation |
|---------------|---------------|----------------|
| Development/Testing | basic-xs (1GB) | Minimal, may be slow |
| Small (<1000 users) | basic-s (2GB) | Works but limited |
| Production (1k-10k) | professional-s (2GB) | Recommended |
| High Traffic (>10k) | professional-m (4GB) | Recommended |
| Enterprise | professional-l (8GB) | High performance |

---

## Next Steps

1. Read [DOCKER-PRODUCTION-GUIDE.md](./DOCKER-PRODUCTION-GUIDE.md) for detailed setup
2. Configure all environment variables
3. Test locally with Docker Compose
4. Deploy to Digital Ocean
5. Monitor and optimize

---

## Support Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Digital Ocean Docs](https://docs.digitalocean.com/products/app-platform/)
- [Docker Docs](https://docs.docker.com/)
