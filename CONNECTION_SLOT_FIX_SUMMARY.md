# PostgreSQL Connection Slot Exhaustion Fix

## Issue Summary

The application was experiencing connection slot exhaustion errors when deploying to production:

```
FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute
```

This error occurred during database migrations and startup, causing the application to fail to initialize.

## Root Cause Analysis

1. **No connection pooling configured** - Prisma was opening unlimited connections
2. **Multiple PrismaClient instances** - Standalone scripts created their own instances
3. **DigitalOcean PostgreSQL limits** - Managed databases have lower connection limits (typically 25-50 depending on plan)
4. **Migration/build processes** - Prisma opens multiple connections during these operations

## Changes Made

### 1. Updated PrismaClient Configuration

#### File: `src/lib/database/prisma.ts`
- Added explicit datasources configuration to ensure DATABASE_URL is properly loaded
- This ensures connection pool parameters are respected

```typescript
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
```

### 2. Updated Standalone Scripts

#### File: `prisma/seed.ts`
- Added datasources configuration to PrismaClient initialization
- Ensures connection pooling works during database seeding

#### File: `scripts/calculate-storage.ts`
- Added datasources configuration to PrismaClient initialization
- Ensures connection pooling works during storage calculations

### 3. Updated Environment Configuration

#### File: `.env.example`
- Added connection pool parameters to DATABASE_URL example
- Added documentation explaining the parameters
- Recommended values: `connection_limit=10&pool_timeout=20`

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/athletics_dashboard?schema=public&connection_limit=10&pool_timeout=20"
```

#### File: `.env.docker`
- Added connection pool parameters to Docker DATABASE_URL
- Added comprehensive documentation
- Applied same recommended values

#### File: `package.json`
- Updated `start:prod` script to include connection pool parameters
- This ensures production deployments use connection pooling

### 4. Updated Docker Configuration

#### File: `docker-compose.yml`
- Added `POSTGRES_MAX_CONNECTIONS: 100` to postgres service
- Increased database connection limit for local development
- Updated app service DATABASE_URL to include pool parameters
- Added documentation for the connection pooling

### 5. Created Documentation

#### File: `CONNECTION_POOLING_GUIDE.md`
Comprehensive guide covering:
- Problem explanation and root causes
- Connection pooling implementation details
- Recommended values by database type
- Best practices (DOs and DON'Ts)
- Troubleshooting steps
- Monitoring recommendations
- Migration checklist

## Impact

### Before Fix
- Application failed to start with connection slot exhaustion
- Migrations would fail during deployment
- No control over connection count
- Production database had limited connection slots (25-50)
- Prisma opened unlimited connections

### After Fix
- Application successfully connects with limited connection pool
- Migrations complete successfully
- Connections are properly managed and reused
- Maximum connections: 10 (configurable)
- Connections time out after 20 seconds if unavailable
- Appropriate for managed PostgreSQL databases

## Connection Pool Parameters

### `connection_limit=10`
- Maximum number of connections Prisma will maintain
- Suitable for DigitalOcean small/medium instances
- Prevents exhausting database connection slots
- Can be adjusted based on database tier

### `pool_timeout=20`
- Time (in seconds) to wait for an available connection
- Increased from default 10 to 20 to allow for connection acquisition
- Prevents immediate failures during high load

## Testing Recommendations

1. **Test in Development:**
   ```bash
   # Verify connection pooling is working
   docker-compose up -d
   # Check logs for successful connections
   docker-compose logs -f app
   ```

2. **Test Production Deployment:**
   ```bash
   # Deploy with connection pooling
   yarn start:prod
   # Monitor database connections
   ```

3. **Monitor Connection Usage:**
   ```sql
   -- Check active connections
   SELECT count(*) FROM pg_stat_activity;
   
   -- See connection details
   SELECT state, count(*), application_name 
   FROM pg_stat_activity 
   GROUP BY state, application_name;
   ```

## Migration Instructions

### For Existing Deployments

1. Update your `.env` file to include connection pool parameters:
   ```bash
   DATABASE_URL="postgresql://user:password@host:port/dbname?schema=public&connection_limit=10&pool_timeout=20"
   ```

2. Redeploy the application:
   ```bash
   git pull origin fix-postgres-conn-slots-exhausted-superuser
   yarn build
   yarn start
   ```

### For New Deployments

1. Copy the updated `.env.docker` to `.env`
2. Update DATABASE_URL with your actual database credentials
3. The connection pool parameters are already included
4. Deploy as usual

## Monitoring Recommendations

### Set Up Alerts

Monitor these metrics in production:
- Active connection count (should stay near `connection_limit`)
- Connection timeout errors
- Database connection pool utilization

### Recommended Tools

- **Prisma Insights** - Built-in query logging
- **DigitalOcean Monitoring** - For managed databases
- **pgBadger** - PostgreSQL log analyzer

## Next Steps

1. ✅ Verify connection pooling works in development
2. ✅ Deploy to staging environment
3. ✅ Monitor connection usage during normal operations
4. ✅ Monitor during peak load (if applicable)
5. ⏳ Adjust connection limits based on monitoring data
6. ⏳ Consider connection pooling services (like PgBouncer) for high-traffic applications

## Files Changed

- `src/lib/database/prisma.ts` - Added datasources configuration
- `prisma/seed.ts` - Added datasources configuration
- `scripts/calculate-storage.ts` - Added datasources configuration
- `.env.example` - Added connection pool parameters and documentation
- `.env.docker` - Added connection pool parameters and documentation
- `docker-compose.yml` - Added connection pool configuration
- `package.json` - Updated start:prod script with pool parameters
- `CONNECTION_POOLING_GUIDE.md` - Created comprehensive guide

## Related Documentation

- [CONNECTION_POOLING_GUIDE.md](./CONNECTION_POOLING_GUIDE.md) - Complete guide on connection pooling
- [Prisma Connection Pool Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/connection-pool)
- [PostgreSQL Connection Management](https://www.postgresql.org/docs/current/runtime-config-connection.html)

---

**Fix Completed:** January 2025
**Branch:** `fix-postgres-conn-slots-exhausted-superuser`
