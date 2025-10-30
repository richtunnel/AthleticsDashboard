# Storage Limits Implementation

## Overview

This document describes the implementation of storage limits for the application, specifically the **1GB storage limit for free plan users**.

## Implementation Details

### 1. Database Schema Changes

Added three new fields to the `Organization` model in `prisma/schema.prisma`:

```prisma
model Organization {
  // ... existing fields
  storageUsageBytes       BigInt          @default(0)
  storageQuotaBytes       BigInt          @default(1073741824)  // 1GB default
  lastStorageCalculation  DateTime?
  // ... rest of model
}
```

- **`storageUsageBytes`**: Current storage usage in bytes (BigInt to support large numbers)
- **`storageQuotaBytes`**: Maximum allowed storage in bytes (defaults to 1GB)
- **`lastStorageCalculation`**: Timestamp of last storage calculation for caching

### 2. Storage Service (`src/lib/services/storage.service.ts`)

Core service that handles all storage-related operations:

#### Storage Limits by Plan:
- **Free Plan**: 1GB (1,073,741,824 bytes)
- **Standard Monthly**: 10GB (10,737,418,240 bytes)
- **Standard Yearly**: 10GB (10,737,418,240 bytes)
- **Business Plans**: 10GB (10,737,418,240 bytes)

#### Key Functions:

**`calculateOrganizationStorage(organizationId: string): Promise<bigint>`**
- Calculates the total storage used by an organization
- Includes data from:
  - Games (notes, custom fields, custom data)
  - Teams
  - Venues
  - Opponents
  - Email Logs
  - Email Groups and Campaigns
  - Custom Columns
  - Travel Recommendations

**`checkStorageLimit(organizationId: string, estimatedAdditionalBytes: number): Promise<{...}>`**
- Checks if an organization has space for new data
- **Note**: Currently recalculates storage on every check for accuracy (no caching to ensure limits are properly enforced)
- Returns:
  - `hasSpace`: boolean indicating if operation can proceed
  - `currentUsage`: current storage usage in bytes
  - `quota`: storage quota in bytes
  - `percentUsed`: percentage of quota used

**`updateStorageQuotaForPlanChange(organizationId: string, newPlan: string): Promise<void>`**
- Updates organization's storage quota when plan changes
- Called during plan upgrades/downgrades

**`estimateDataSize(data: any): number`**
- Estimates the size of data being created/updated
- Used to pre-check before database operations

**`formatBytes(bytes: bigint | number): string`**
- Formats bytes to human-readable format (KB, MB, GB, etc.)

### 3. Storage Check Middleware (`src/lib/utils/storage-check.ts`)

Provides a convenient wrapper for checking storage before write operations:

**`checkStorageBeforeWrite(options: StorageCheckOptions): Promise<NextResponse | null>`**
- Only enforces limits for free plan users
- Returns error response (413 Payload Too Large) if limit exceeded
- Returns `null` if operation can proceed
- Logs warnings when usage exceeds 90%

**`getStorageInfo(organizationId: string)`**
- Returns formatted storage information for display
- Useful for showing storage usage in UI

### 4. API Route Integration

Storage checks have been added to the following API routes:

#### Data Creation Routes:
- `POST /api/games` - Creating new games
- `POST /api/teams` - Creating new teams
- `POST /api/opponents` - Creating new opponents
- `POST /api/venues` - Creating new venues
- `POST /api/email-groups` - Creating new email groups
- `POST /api/email-groups/[groupId]/emails` - Adding emails to groups

#### Plan Management Routes:
- `POST /api/auth/update-plan` - Updates storage quota when plan changes
- `POST /api/stripe/change-plan` - Stripe plan changes

#### New Routes:
- `GET /api/storage/usage` - Get current storage usage information

### 5. Database Migration

Migration file: `prisma/migrations/20251101000000_add_storage_tracking_to_organization/migration.sql`

```sql
ALTER TABLE "Organization" 
  ADD COLUMN "storageUsageBytes" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "storageQuotaBytes" BIGINT NOT NULL DEFAULT 1073741824,
  ADD COLUMN "lastStorageCalculation" TIMESTAMP(3);
```

## Usage Examples

### Checking Storage Before Creating Data

```typescript
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  const body = await request.json();

  // Check storage limit
  const storageCheckResult = await checkStorageBeforeWrite({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    data: body,
  });

  if (storageCheckResult) {
    return storageCheckResult; // Returns error response
  }

  // Proceed with data creation
  const result = await prisma.model.create({ data: body });
  // ...
}
```

### Getting Storage Information

```typescript
import { getStorageInfo } from "@/lib/utils/storage-check";

const storageInfo = await getStorageInfo(organizationId);
console.log(`Usage: ${storageInfo.currentUsageFormatted} / ${storageInfo.quotaFormatted}`);
console.log(`Percent used: ${storageInfo.percentUsed}%`);
console.log(`Is near limit: ${storageInfo.isNearLimit}`);
```

### Calculating Storage for All Organizations

Use the provided script to calculate storage for all organizations:

```bash
npx ts-node scripts/calculate-storage.ts
```

This is useful for:
- Initial setup after migration
- Periodic maintenance
- Verification of storage calculations

## Error Responses

When storage limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Storage limit exceeded",
  "message": "Your organization has reached its storage limit of 1 GB. You are currently using 1.05 GB (105.0%). Please upgrade your plan to continue adding data.",
  "details": {
    "currentUsage": "1127428915",
    "quota": "1073741824",
    "percentUsed": 105.0
  }
}
```

Status Code: **413 Payload Too Large**

## Performance Considerations

1. **Caching**: Storage is only recalculated if more than 1 hour has passed since last calculation
2. **Lazy Calculation**: Storage is calculated on-demand, not after every write operation
3. **Selective Enforcement**: Only free plan users have storage checks enforced
4. **Efficient Queries**: Uses selective `select` statements to minimize data transfer

## Future Enhancements

Potential improvements to consider:

1. **Real-time Updates**: Update storage usage after each write operation instead of periodic calculation
2. **Detailed Breakdown**: Provide per-model storage usage breakdown in the UI
3. **Soft Warnings**: Notify users at 80% and 90% usage thresholds
4. **Grace Period**: Allow users to temporarily exceed limit with warning before hard enforcement
5. **Compression**: Implement data compression for text fields to reduce storage
6. **Archive Feature**: Allow users to archive old data to free up space
7. **Storage Analytics Dashboard**: Show storage trends over time

## Testing

To test the storage limit enforcement:

1. Create a free plan user account
2. Use the storage calculation script to update current usage
3. Attempt to create data when near/at the limit
4. Verify appropriate error messages are returned
5. Upgrade to paid plan and verify higher limits apply

## Troubleshooting

### Storage not calculating correctly
- Ensure the migration has been applied: `npx prisma migrate deploy`
- Run the calculation script manually: `npx ts-node scripts/calculate-storage.ts`

### Users can exceed limit
- Verify user's plan in the database
- Check that `storageQuotaBytes` is set correctly on the organization
- Ensure API routes include the storage check

### Performance issues
- Storage calculation is cached for 1 hour; if needed more frequently, adjust the cache duration
- Consider adding database indexes on frequently queried fields
- Monitor query performance with database profiling tools

## Related Files

- Schema: `prisma/schema.prisma`
- Service: `src/lib/services/storage.service.ts`
- Middleware: `src/lib/utils/storage-check.ts`
- Migration: `prisma/migrations/20251101000000_add_storage_tracking_to_organization/`
- Script: `scripts/calculate-storage.ts`
- API Endpoint: `src/app/api/storage/usage/route.ts`
