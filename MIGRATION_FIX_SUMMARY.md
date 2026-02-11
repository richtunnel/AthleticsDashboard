# Migration Fix: 20250210180000_add_email_persistence_fields

## Problem
The migration `20250210180000_add_email_persistence_fields` failed to apply because it ran before the `EmailLog` table was created, leaving a failed migration record and blocking new migrations.

## Root Cause
The migration timestamp (February 10, 2025) is earlier than the init migration (`20251101200428_init`) that creates `EmailLog`, so Prisma attempted to alter a table that didn’t exist.

## Solution
Reintroduced the original migration name with safe, guarded SQL so it can run even before the table exists, and kept the later migrations that add the same fields when the table is available.

### Guarded migration SQL
The restored migration now uses `ALTER TABLE IF EXISTS` with `ADD COLUMN IF NOT EXISTS` so it is a no-op when `EmailLog` is absent and doesn’t fail when the columns already exist:
```sql
ALTER TABLE IF EXISTS "EmailLog"
ADD COLUMN IF NOT EXISTS "selectedSchoolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "visibleColumnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "customRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "recipientCategory" TEXT;
```

## Result
- ✅ The historical migration name is restored to satisfy existing databases.
- ✅ The migration no longer fails when `EmailLog` hasn’t been created yet.
- ✅ Later migrations still apply the same fields in the correct order on fresh databases.
