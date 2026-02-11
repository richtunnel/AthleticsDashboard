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
Renamed the migration directory to have a timestamp **after** all existing migrations:
- **Old:** `20250210180000_add_email_persistence_fields`
- **New:** `20260211000000_add_email_persistence_fields` (February 11, 2026)

This ensures the migration runs after the `EmailLog` table is created and after other EmailLog-related migrations.

## Migration Content
The migration adds two fields to the EmailLog table:
```sql
ALTER TABLE "EmailLog" ADD COLUMN "customRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "recipientCategory" TEXT;
```

## Verification
- ✅ Migration timestamp is now the latest in the migrations folder
- ✅ Schema.prisma already contains both fields (`recipientCategory` and `customRecipients`)
- ✅ Migration SQL is intact and unchanged
- ✅ Chronological order: The new timestamp (20260211000000) comes after the last migration (20260207204540_add_persistence_email_logs)

## Migration Order
The corrected migration order now ensures proper table dependencies:
1. `20251101200428_init` - Creates EmailLog table
2. ... (other migrations)
3. `20260207204540_add_persistence_email_logs` - Adds other EmailLog fields
4. `20260211000000_add_email_persistence_fields` - **Adds recipientCategory and customRecipients**
