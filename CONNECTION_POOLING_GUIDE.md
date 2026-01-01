# PostgreSQL Connection Pooling Guide

## Problem: Connection Slot Exhaustion

### Error Message
```
FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute
```

### Root Cause

PostgreSQL databases have a limited number of connection slots determined by the `max_connections` configuration. When this limit is reached, the database rejects new connections with the above error.

This issue commonly occurs with:

1. **Managed PostgreSQL databases** (DigitalOcean, AWS RDS, Heroku) that have low connection limits
2. **Multiple PrismaClient instances** opening connections independently
3. **Prisma migrations/builds** opening many concurrent connections
4. **Serverless environments** (Vercel, AWS Lambda) where many instances may spin up simultaneously

## Solution: Connection Pooling

### What is Connection Pooling?

Connection pooling maintains a set of open database connections that can be reused, rather than creating a new connection for each request. This:

- ✅ Reduces connection overhead
- ✅ Prevents connection slot exhaustion
- ✅ Improves application performance
- ✅ Limits maximum database connections

### Implementation

#### 1. Configure PrismaClient with Pool Settings

**Main Instance (`src/lib/database/prisma.ts`):**
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Stand-alone Scripts (`prisma/seed.ts`, `scripts/*.ts`):**
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

#### 2. Add Connection Parameters to DATABASE_URL

**Development/Docker (.env.docker):**
```
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public&connection_limit=10&pool_timeout=20"
```

**Production (.env):**
```
DATABASE_URL="postgresql://user:password@prod-db-host:5432/dbname?schema=public&connection_limit=10&pool_timeout=20"
```

### Parameters Explained

| Parameter | Default | Recommended | Description |
|-----------|---------|-------------|-------------|
| `connection_limit` | 10 | 10 (production), 20 (development) | Maximum number of connections in the pool |
| `pool_timeout` | 10 seconds | 20 seconds | Time to wait for a connection from the pool |

### Recommended Values by Database Type

#### DigitalOcean Managed PostgreSQL
- **Small instances (1-2GB RAM):** `connection_limit=5`
- **Medium instances (4GB RAM):** `connection_limit=10`
- **Large instances (8GB+ RAM):** `connection_limit=20`

#### AWS RDS PostgreSQL
- **db.t3.micro:** `connection_limit=10`
- **db.t3.small:** `connection_limit=20`
- **db.t3.medium:** `connection_limit=40`

#### Self-hosted PostgreSQL
- **Small (4GB RAM):** `connection_limit=10`
- **Medium (8GB RAM):** `connection_limit=25`
- **Large (16GB+ RAM):** `connection_limit=50`

### Docker Compose Configuration

When using PostgreSQL in Docker Compose, increase the connection limit in the database container:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_MAX_CONNECTIONS: 100
```

And configure the app to use pooling:

```yaml
services:
  app:
    environment:
      DATABASE_URL: postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@postgres:5432/${DATABASE_NAME}?schema=public&connection_limit=10&pool_timeout=20
```

## Best Practices

### ✅ DO

1. **Always use connection pooling** in production
2. **Use singleton PrismaClient** for the main application
3. **Configure proper connection limits** based on database resources
4. **Monitor connection usage** with database monitoring tools
5. **Use environment-specific values** for connection limits

### ❌ DON'T

1. **Don't create multiple PrismaClient instances** without explicit configuration
2. **Don't set connection_limit higher** than your database max_connections
3. **Don't ignore connection timeout errors** - they indicate pool exhaustion
4. **Don't use unlimited connections** - this will cause database crashes
5. **Don't hardcode DATABASE_URL** - always use environment variables

## Troubleshooting

### Connection Exhaustion Symptoms

- Application hangs during startup
- Migrations fail with "FATAL: remaining connection slots are reserved"
- Intermittent database connection errors
- Slow database queries

### Debugging Steps

1. **Check current database connections:**
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

2. **See connection details:**
   ```sql
   SELECT state, count(*), application_name 
   FROM pg_stat_activity 
   GROUP BY state, application_name;
   ```

3. **Check max_connections setting:**
   ```sql
   SHOW max_connections;
   ```

4. **Monitor pool usage in Prisma:**
   Add to your PrismaClient initialization:
   ```typescript
   log: ["query", "info", "warn", "error"],
   ```

### Common Issues

#### Issue: "FATAL: remaining connection slots are reserved for SUPERUSER"
**Solution:** Reduce `connection_limit` or upgrade database plan

#### Issue: "Connection timeout"
**Solution:** Increase `pool_timeout` value

#### Issue: "Too many connections" during migrations
**Solution:** Temporarily reduce concurrent connections:
```bash
# Run migrations with single connection
npx prisma migrate deploy -- --disable-interactive
```

## Monitoring

### Set Up Database Monitoring

Use these tools to monitor connection usage:

1. **Prisma Insights** - Built-in query logging and metrics
2. **DigitalOcean Monitoring** - Built-in for managed databases
3. **AWS CloudWatch** - For RDS instances
4. **pgBadger** - Open-source PostgreSQL log analyzer
5. **Prometheus + Grafana** - Custom monitoring stack

### Key Metrics to Watch

- `pg_stat_activity` - Active connections by state
- Connection pool utilization - % of pool in use
- Query latency - Impact of connection contention
- Connection errors - Frequency of timeouts/rejections

## Migration Checklist

If you're experiencing connection slot exhaustion, follow this checklist:

- [ ] Add connection parameters to `DATABASE_URL` in all environments
- [ ] Update `src/lib/database/prisma.ts` to use datasources configuration
- [ ] Update all standalone scripts to use datasources configuration
- [ ] Update `.env` files with proper connection limits
- [ ] Update `docker-compose.yml` with pool settings
- [ ] Test connection pooling in development
- [ ] Monitor connection usage after deployment
- [ ] Adjust connection limits based on monitoring data

## Additional Resources

- [Prisma Connection Pool Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/connection-pool)
- [PostgreSQL Connection Management](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [DigitalOcean PostgreSQL Limits](https://docs.digitalocean.com/products/databases/postgresql/)
- [AWS RDS Connection Limits](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html)

---

Last Updated: January 2025
Related Issue: Fix for PostgreSQL connection slot exhaustion
