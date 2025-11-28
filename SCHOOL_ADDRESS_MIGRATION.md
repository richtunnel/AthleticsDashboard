# School Address Field Migration

## Overview
This migration replaces the `mascot` field with a `schoolAddress` field in the User model, updating the signup flow and settings page accordingly.

## Changes Made

### 1. Database Schema
**File**: `prisma/schema.prisma`
- **Removed**: `mascot String?` field from User model
- **Added**: `schoolAddress String?` field to User model
- **Migration**: `20251128210235_replace_mascot_with_school_address/migration.sql`

### 2. Onboarding Flow
**File**: `src/app/onboarding/details/page.tsx`
- Replaced mascot state with schoolAddress state
- Updated form field from "Mascot" (optional) to "School Address" (required)
- Added placeholder text: "e.g., 123 Main St, City, State 12345"
- Updated submit button disabled condition to include schoolAddress validation
- Updated API call payload to send schoolAddress instead of mascot

### 3. Settings Page
**File**: `src/app/dashboard/settings/page.tsx`
- Updated Prisma query to select `schoolAddress` instead of `mascot`

**File**: `src/components/settings/SchoolDetailsForm.tsx`
- Updated Props type to include `schoolAddress` instead of `mascot`
- Updated form state and initial data to use schoolAddress
- Updated validation to require schoolAddress (minimum 5 characters)
- Changed form label from "Mascot" to "School Address"
- Added required field indicator and placeholder text
- Updated description text to mention "address" instead of "mascot"

### 4. API Routes
**File**: `src/app/api/user/update/route.ts`
- Updated request payload to accept `schoolAddress` instead of `mascot`
- Updated Prisma update to save schoolAddress

**File**: `src/app/dashboard/settings/actions.ts`
- Updated `UpdateSchoolDetailsPayload` type to include `schoolAddress` (required) instead of `mascot` (optional)
- Added validation for schoolAddress (minimum 5 characters)
- Updated Prisma update call to save schoolAddress

## Migration Details

### SQL Migration
```sql
-- AlterTable
ALTER TABLE "User" DROP COLUMN "mascot",
ADD COLUMN     "schoolAddress" TEXT;
```

### Field Characteristics
- **Name**: schoolAddress
- **Type**: String (optional in schema, required in forms)
- **Validation**: Minimum 5 characters
- **Purpose**: Store the physical address of the user's school

## User Impact

### Signup Flow
- Users are now required to enter their school address during signup
- The field includes helpful placeholder text
- The form cannot be submitted without a valid school address

### Settings Page
- Existing users can update their school address in the settings page
- The field is required when saving changes
- Address must be at least 5 characters long

## Testing Recommendations

1. **New User Signup**:
   - Verify that school address field is displayed and required
   - Test validation (minimum 5 characters)
   - Verify successful account creation with school address

2. **Existing User Settings**:
   - Verify that users can view and update their school address
   - Test validation on update
   - Verify changes are saved to database

3. **Database Migration**:
   - Verify mascot column is dropped
   - Verify schoolAddress column is added
   - Check that existing data is preserved (other fields)

## Notes

- The opponent mascot field remains unchanged (this migration only affects the User model)
- Existing users will have NULL in the schoolAddress field until they update their settings
- The migration is backwards compatible for reading (NULL values are handled gracefully)
