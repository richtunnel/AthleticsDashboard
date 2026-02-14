# Migration Fix: 20250210180000_add_email_persistence_fields

## Problem
The migration `20250210180000_add_email_persistence_fields` failed to apply to the shadow database with error:
```
Error code: P1014
Error: The underlying table for model `EmailLog` does not exist.
```

## Root Cause
The migration timestamp `20250210180000` (February 10, 2025) was **chronologically BEFORE** the init migration `20251101200428_init` (November 1, 2025) that creates the `EmailLog` table.

When Prisma applies migrations in chronological order based on their timestamps, it attempted to alter the `EmailLog` table before it was created, causing the error.

## Solution
Added a guard migration that runs **after** the EmailLog table exists and safely adds the persistence fields if they are missing:
- **New:** `20260215000000_ensure_email_log_persistence_fields`

This migration uses `ADD COLUMN IF NOT EXISTS` so it can be applied safely even if the fields were added by another migration or already exist in the init schema.

## Migration Content
The guard migration ensures both fields exist on the EmailLog table:
```sql
ALTER TABLE "EmailLog"
  ADD COLUMN IF NOT EXISTS "customRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "recipientCategory" TEXT;
```

## Verification
- ✅ Migration timestamp is after the latest EmailLog-related migrations
- ✅ Schema.prisma already contains both fields (`recipientCategory` and `customRecipients`)
- ✅ Migration SQL is safe for re-runs (`IF NOT EXISTS`)
- ✅ Chronological order: The new migration (20260215000000) runs after `20260211005620_add_persistent_email_fields_01`

## Migration Order
The corrected migration order now ensures proper table dependencies:
1. `20251101200428_init` - Creates EmailLog table
2. ... (other migrations)
3. `20260207204540_add_persistence_email_logs` - Adds other EmailLog fields
4. `20260211005620_add_persistent_email_fields_01` - Adds `customRecipients`
5. `20260215000000_ensure_email_log_persistence_fields` - **Ensures recipientCategory/customRecipients exist**

## Production Deployment Fix
To handle the failed migration `20250210180000_add_email_persistence_fields` that exists in the production database but not in the codebase, the startup process has been updated:

### Changes Made
1. **Updated `start.sh`**: Now runs `node ./scripts/clean-failed-migrations.js` before `prisma migrate deploy`
2. **Updated `package.json` start script**: Includes the cleanup step in the start command

### How It Works
The `clean-failed-migrations.js` script removes any migration records from the `_prisma_migrations` table where:
- `finished_at IS NULL` (migration started but never completed)
- `rolled_back_at IS NOT NULL` (migration was rolled back)

This allows Prisma to proceed with applying valid migrations without being blocked by stale failed migration records.

### Manual Resolution (if needed)
If the automated cleanup doesn't resolve the issue, you can manually mark the failed migration as rolled back:

```bash
export DATABASE_URL="postgresql://..."
npx prisma migrate resolve --rolled-back "20250210180000_add_email_persistence_fields"
```
