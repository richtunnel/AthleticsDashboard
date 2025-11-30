# Email Campaign Manager Bug Fix - Email Not Displayed After Adding

## Issue
When users added an email to a group in the Email Campaign Manager, the email was not displayed in the UI. This occurred when trying to add an email that already existed in ANY other group.

## Root Cause
The bug was caused by a schema design flaw in the `EmailAddress` model:

```prisma
model EmailAddress {
  id      String     @id @default(uuid())
  email   String     @unique  // ❌ GLOBAL unique constraint
  groupId String
  group   EmailGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
}
```

### The Problem:
1. **Schema**: The `email` field had a `@unique` constraint, making emails globally unique across ALL groups
2. **Duplicate Check**: The API only checked for duplicates within the current group
3. **Failure Scenario**: When adding an email that existed in another group:
   - ✅ Passed the duplicate check (email not in current group)
   - ❌ Failed at database insertion due to global unique constraint
   - 🐛 Caught by error handler but returned incomplete response without proper fields

### Expected vs Actual Behavior:
- **Expected**: Users should be able to add the same email to multiple groups (e.g., "parent@example.com" in both "Varsity Parents" and "JV Parents")
- **Actual**: The second group would fail to add the email due to the global unique constraint

## Solution

### 1. Schema Fix
Changed the unique constraint from global to per-group:

```prisma
model EmailAddress {
  id      String     @id @default(uuid())
  email   String     // ✅ No global unique
  groupId String
  group   EmailGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([email, groupId])  // ✅ Compound unique: email unique per group
  @@index([groupId])           // ✅ Added index for performance
}
```

### 2. API Response Fix
Added null checks and proper response formatting in `/src/app/api/email-groups/[groupId]/emails/route.ts`:

```typescript
// Main success path
const updated = await prisma.emailGroup.findUnique({
  where: { id: groupId },
  include: emailGroupInclude,
});

if (!updated) {
  return NextResponse.json({ error: "Email group not found after update" }, { status: 404 });
}

return NextResponse.json({
  ...updated,
  addedCount: newEmails.length,
  duplicateCount: duplicateEmails.length,
  duplicates: duplicateEmails,
});
```

### 3. Error Handling Fix
Improved P2002 error handler to return consistent response format:

```typescript
if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
  const updated = await prisma.emailGroup.findUnique({
    where: { id: groupId },
    include: emailGroupInclude,
  });

  if (!updated) {
    return NextResponse.json({ error: "Email group not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...updated,
    addedCount: 0,
    duplicateCount: normalizedEmails.length,
    duplicates: normalizedEmails,
  });
}
```

## Migration
Created migration: `20251130201525_fix_email_address_unique_constraint`

```sql
-- Drop global unique constraint
DROP INDEX IF EXISTS "EmailAddress_email_key";

-- Add compound unique constraint (email unique per group)
CREATE UNIQUE INDEX "EmailAddress_email_groupId_key" ON "EmailAddress"("email", "groupId");

-- Add performance index
CREATE INDEX "EmailAddress_groupId_idx" ON "EmailAddress"("groupId");
```

## Impact
✅ **Fixed**: Users can now add the same email to multiple groups
✅ **Fixed**: Emails properly display after being added
✅ **Fixed**: Duplicate detection works correctly within each group
✅ **Improved**: Better error handling with consistent response format
✅ **Improved**: Database performance with proper indexing

## Testing Scenarios
1. ✅ Add new email to group → Email displays immediately
2. ✅ Add same email twice to same group → Duplicate message shown
3. ✅ Add same email to different groups → Works successfully in both groups
4. ✅ Bulk add emails with duplicates → Correct counts shown (added vs duplicates)

## Files Changed
- `prisma/schema.prisma` - Fixed EmailAddress model unique constraint
- `prisma/migrations/20251130201525_fix_email_address_unique_constraint/migration.sql` - Database migration
- `src/app/api/email-groups/[groupId]/emails/route.ts` - Added null checks and improved error handling
