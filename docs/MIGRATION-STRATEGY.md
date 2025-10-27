# Prisma Migration Strategy

This document outlines the recommended approach for managing Prisma migrations across development, staging, and production environments for the Athletics Dashboard application.

## Overview

- **Database**: PostgreSQL
- **ORM**: Prisma 6.18.0
- **Schema file**: `prisma/schema.prisma`
- **Migrations directory**: `prisma/migrations/`
- **Generator binary targets**: `native`, `linux-musl-openssl-3.0.x`
- **Production process**: `npx prisma migrate deploy` on startup

## Environments

### 1. Development
- Use `prisma migrate dev`
- Generates new migration files
- Applies migrations to local database
- Updates Prisma Client automatically

```bash
# Create and apply a new migration
yarn prisma migrate dev --name add_new_feature
```

### 2. Staging
- Apply migrations using `prisma migrate deploy`
- Use staging database connection string

```bash
DATABASE_URL="postgresql://...staging..." npx prisma migrate deploy
```

### 3. Production
- Apply migrations using `prisma migrate deploy`
- The Docker runtime runs migrations automatically via `start.sh`

```bash
# Inside the container
npx prisma migrate deploy
```

## Docker Deployment Flow

1. **Build Stage**
   - Prisma client is generated (`yarn prisma generate`)
   - Migrations copied into final image

2. **Runtime Startup**
   - `start.sh` runs `npx prisma migrate deploy`
   - If migrations succeed → start Next.js server
   - If migrations fail → container exits (prevents running with mismatched schema)

## Migration Workflow

### Adding a New Migration

1. Modify `prisma/schema.prisma`
2. Generate migration locally:
   ```bash
   yarn prisma migrate dev --name descriptive_migration_name
   ```
3. Review files in `prisma/migrations/<timestamp>_<name>/`
4. Commit schema + migration files to git
5. Run tests referencing new schema (if any)
6. Push branch and create PR

### Deploying Migrations

1. Merge PR into main branch
2. Docker build includes new migration
3. On deployment:
   - Container runs `npx prisma migrate deploy`
   - Applies migrations in order
   - Starts app only if migrations succeed

### Monitoring

Check migration status in production:
```bash
docker exec -it <container_name> npx prisma migrate status
```

## Troubleshooting

### Migration Fails on Startup
- Container will exit (to avoid running without schema update)
- View logs:
  ```bash
  docker logs <container_name>
  ```
- Common causes:
  - Missing privileges on database
  - Migration conflicts
  - Database unavailable

### Resolve Migration Conflicts
Use provided scripts:
- `scripts/prisma-migration-troubleshoot.sh`
- `scripts/prisma-predeploy-check.sh`

Examples:
```bash
# Check status
bash ./scripts/prisma-migration-troubleshoot.sh status

# Resolve applied migration
yarn migrate:resolve:applied

# Resolve rolled back migration
yarn migrate:resolve:rollback
```

### Rolling Back
Prisma does not support automatic rollbacks. Recommended approach:
1. Create a new migration correcting the schema
2. Apply using standard process

For immediate rollback:
- Apply manual SQL (not recommended)
- Restore from database backup

## Best Practices

1. **One migration per feature**
   - Keeps history clean
   - Easier to debug issues

2. **Always run `yarn prisma migrate dev`**
   - Ensures consistent Prisma client generation

3. **Never edit existing migration files**
   - Create new migration for changes
   - Maintains audit trail

4. **Test against staging**
   - Apply migrations to staging before production
   - Catch issues with real data

5. **Backup before major changes**
   - Snapshot database
   - Have restore plan

6. **Monitor database**
   - Watch for schema drift
   - Use `prisma migrate status`

7. **Lock down production migrations**
   - Only senior engineers apply to production
   - Use change management process

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `yarn migrate:deploy` | Runs `prisma migrate deploy` |
| `yarn migrate:status` | Shows migration status |
| `yarn migrate:resolve:rollback` | Resolves rolled back migrations |
| `yarn migrate:resolve:applied` | Marks migration as applied |
| `yarn migrate:check` | Runs pre-deploy checks |

## FAQ

**Q: Do I need to run migrations manually in production?**
A: No. The Docker image's `start.sh` runs `npx prisma migrate deploy` automatically before starting Next.js.

**Q: Can I skip migrations during startup?**
A: Not recommended. Migrations ensure schema matches application code. If you must, modify `start.sh` (not advised).

**Q: How do I handle long-running migrations?**
A: Run `prisma migrate deploy` manually in a maintenance window before deploying new code, then deploy new image without running migrations again.

**Q: What if I need seed data?**
A: Use `yarn prisma db seed` (see `prisma/seed.ts`). Not run automatically in production.

---

For more information, refer to:
- Prisma Migrate docs: https://www.prisma.io/docs/concepts/components/prisma-migrate
- `docs/DOCKER-PRODUCTION-GUIDE.md`
- `docs/ENVIRONMENT-VARIABLES.md`
