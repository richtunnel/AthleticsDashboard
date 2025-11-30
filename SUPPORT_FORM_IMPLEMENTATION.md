# Support Form Implementation

## Overview
Implemented a comprehensive support form accessible from the user icon menu in the dashboard that allows users to submit support requests via email to support@athleticdirectorhub.com.

## Implementation Details

### 1. Icon Menu Link
**File**: `/src/app/dashboard/DashboardLayoutClient.tsx`
- Added a "Support" menu item to the user profile icon menu
- Uses `SupportAgent` icon to differentiate from the "Help" menu item
- Links to `/dashboard/support`

### 2. Dashboard Support Page
**File**: `/src/app/dashboard/support/page.tsx`
- New page at `/dashboard/support`
- Displays user-friendly header with support information
- Shows the email address where the user will receive responses
- Server-side rendered with session authentication

### 3. Support Form Component
**File**: `/src/components/support/SupportFormWithDropdown.tsx`

#### Features Implemented:
1. **Issue Type Dropdown** (Required)
   - Options: Technical Support, Billing, Account, Cancel Subscription, Troubleshoot, Other
   - First option is placeholder: "Select an issue type"
   - Submit button disabled until issue type is selected

2. **Subject Input** (Required)
   - Automatically populated with selected issue type in format: `[Issue Type]`
   - Example: `[Technical Support]`
   - Users can add additional text after the issue type
   - Minimum 3 characters required
   - When user changes issue type, the subject is automatically updated

3. **Message Textarea** (Required)
   - 500 character limit enforced
   - Real-time character counter: "X / 500 characters"
   - Minimum 10 characters required
   - Visual feedback:
     - Shows "X more characters needed" when under 10 characters
     - Shows "✓ Minimum length met" when 10+ characters
     - Character counter turns red when at 500 character limit
     - Error text turns red when under minimum
   - Submit button disabled until 10+ characters entered
   - Validation message: "Please write at least 10 characters in your message before submitting."

4. **Submit Button**
   - Disabled when:
     - No issue type selected
     - Message under 10 characters
     - Form is submitting
   - Shows loading state: "Submitting..." with spinner
   - Success state: Shows ticket number after submission
   - Error handling: Displays error messages if submission fails

5. **Form Validation**
   - Real-time validation for all fields
   - Error messages displayed inline
   - Character count updates as user types
   - Form resets after successful submission

### 4. Email Integration
**File**: `/src/lib/services/email.service.ts` (Existing)
- Uses existing `sendSupportNotificationEmail` method
- Sends emails to: **support@athleticdirectorhub.com**
- Email includes:
  - Ticket number
  - Submitter name and email
  - Subject (with issue type)
  - Full message
  - Timestamp

**File**: `/src/app/api/support/route.ts` (Existing)
- Uses existing API endpoint
- Creates support ticket in database
- Triggers email notification
- Returns ticket number to user

## User Flow

1. User clicks their profile icon in the dashboard header
2. Clicks "Support" from the dropdown menu
3. Navigates to `/dashboard/support`
4. Sees support form with clear instructions
5. Selects issue type from dropdown (e.g., "Technical Support")
6. Subject is automatically populated: `[Technical Support]`
7. User can add more text to subject
8. User types message (minimum 10 characters, maximum 500)
9. Real-time feedback shows character count and validation status
10. Submit button becomes enabled when all requirements met
11. User clicks "Submit Support Request"
12. System creates ticket and sends email to support@athleticdirectorhub.com
13. User sees success message with ticket number
14. Form resets for another submission if needed

## Technical Stack

- **Framework**: Next.js 15 (App Router)
- **UI Library**: Material UI (MUI)
- **Form Management**: React Hook Form
- **API Mutations**: TanStack Query (React Query)
- **Email Service**: Resend (via existing email service)
- **Database**: Prisma (support tickets stored in database)

## Validation Rules

| Field | Min Length | Max Length | Required | Validation Message |
|-------|-----------|-----------|----------|-------------------|
| Issue Type | N/A | N/A | Yes | "Please select an issue type" |
| Subject | 3 | N/A | Yes | "Subject must be at least 3 characters" |
| Message | 10 | 500 | Yes | "Message must be at least 10 characters" / "X more characters needed" |

## Email Recipients

- **To**: support@athleticdirectorhub.com
- **From**: noreply@athleticdirectorhub.com (or configured EMAIL_FROM)
- **Subject**: "New Support Ticket: [User's Subject]"

## Success Messages

- **On Submission**: "Support ticket created successfully! Ticket number: SUPPORT-XXXXXX"
- **Character Validation**: "✓ Minimum length met" (when 10+ characters)
- **Character Warning**: "X more characters needed" (when under 10)

## Error Handling

- Network errors: "Failed to submit support request"
- Validation errors: Inline field-specific messages
- API errors: Displays server error message to user

## Files Modified

1. `/src/app/dashboard/DashboardLayoutClient.tsx` - Added Support menu item
2. `/src/app/dashboard/support/page.tsx` - New page (created)
3. `/src/components/support/SupportFormWithDropdown.tsx` - New component (created)

## Files Used (Existing)

1. `/src/app/api/support/route.ts` - Existing API endpoint
2. `/src/lib/services/email.service.ts` - Existing email service

## Testing Checklist

- [x] Support link appears in icon menu
- [x] Support page loads correctly
- [x] Issue type dropdown has all required options
- [x] Subject updates when issue type changes
- [x] Message character limit enforced at 500
- [x] Message minimum validation at 10 characters
- [x] Real-time character counter works
- [x] Submit button disabled appropriately
- [x] Form validates all fields
- [x] Success message shows ticket number
- [x] Email sent to support@athleticdirectorhub.com
- [x] Form resets after successful submission
- [x] Error messages display correctly

## Notes

- The implementation reuses the existing `/api/support` endpoint
- All emails are sent to support@athleticdirectorhub.com (hardcoded in email.service.ts)
- Support tickets are stored in the database for tracking
- The form follows existing patterns in the codebase for consistency
- Character counting and validation provide excellent user experience
- Visual feedback keeps users informed of requirements
