# User Role System Revert Summary

## Overview
All user role changes have been successfully reverted back to the original 6-role system. Your database will NOT need to be reset - the migration will automatically convert roles when you deploy.

## Original 6-Role System Restored
- **SUPER_ADMIN** - Full system access
- **ATHLETIC_DIRECTOR** - Default role for new users, full management access
- **ASSISTANT_AD** - Assistant athletic director
- **COACH** - Coach access level
- **STAFF** - Staff access level
- **VENDOR_READ_ONLY** - Read-only vendor access

## What Was Changed

### Database Schema (`prisma/schema.prisma`)
- ✅ UserRole enum restored to 6 roles
- ✅ Default role changed back to `ATHLETIC_DIRECTOR`

### Type Definitions (`types/next-auth.d.ts`)
- ✅ UserRole type updated to include all 6 roles

### Authentication & User Creation
- ✅ `src/lib/utils/authOptions.ts` - Creates users with `ATHLETIC_DIRECTOR` role
- ✅ `src/app/api/signup/route.ts` - Creates users with `ATHLETIC_DIRECTOR` role
- ✅ `src/app/api/user/create/route.ts` - Creates users with `ATHLETIC_DIRECTOR` role
- ✅ `src/lib/utils/auth.ts` - Dev session uses `ATHLETIC_DIRECTOR` role
- ✅ `src/lib/utils/auth-client.ts` - Updated with all 6 roles and correct permissions

### Admin Endpoints
- ✅ `src/app/api/admin/enable-account/route.ts` - Restricted to `SUPER_ADMIN`
- ✅ `src/app/api/admin/disable-account/route.ts` - Restricted to `SUPER_ADMIN`

### Settings Components
- ✅ `src/components/settings/AccountDetailsForm.tsx` - Role lock logic updated
- ✅ `src/components/settings/SubscriptionOverviewCard.tsx` - Admin checks updated
- ✅ `src/app/dashboard/settings/actions.ts` - Role validation updated

### Constants
- ✅ `src/lib/constants/role.ts` - All 6 roles with proper display names

### Seed Data
- ✅ `prisma/seed.ts` - Creates dev user with `ATHLETIC_DIRECTOR` role

## Database Migration

### New Migration Created: `20250105000000_revert_user_role_enum`
This migration safely reverts the database schema:

1. **Automatically converts existing roles:**
   - `ADMIN` → `ATHLETIC_DIRECTOR`
   - `MEMBER` → `STAFF`

2. **Recreates the UserRole enum** with all 6 original roles

3. **Restores the default** to `ATHLETIC_DIRECTOR`

### Old Migration Removed: `20250104000000_update_user_role_enum`
The problematic migration that simplified roles to ADMIN/MEMBER has been deleted.

## How to Deploy

When you deploy this code:

1. **The migration will run automatically** and convert your existing user roles
2. **NO data will be lost** - all users will be preserved
3. **NO database reset required** - the migration handles everything

Example:
```bash
# In your production environment
npx prisma migrate deploy

# Or if using Docker/CI/CD, the migration will run automatically on deploy
```

## What Your Users Will See

- Users who had `ADMIN` role will become `ATHLETIC_DIRECTOR`
- Users who had `MEMBER` role will become `STAFF`
- All functionality will continue to work as expected
- No action required from your users

## Verification

After deploying, you can verify the migration succeeded:

```bash
# Check the UserRole enum in your database
psql $DATABASE_URL -c "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'UserRole';"

# Expected output:
# SUPER_ADMIN
# ATHLETIC_DIRECTOR
# ASSISTANT_AD
# COACH
# STAFF
# VENDOR_READ_ONLY
```

## Support

The original 6-role system is now fully restored. If you have any issues:

1. Check that the migration ran successfully
2. Verify Prisma client was regenerated (`npx prisma generate`)
3. Restart your application server

All code has been reverted to support the original role structure.
