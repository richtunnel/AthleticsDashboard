# Google Forms Integration - Quick Start Example

## Step-by-Step Setup

### 1. Create Your Google Form

Here's a recommended structure for your feedback form:

#### Form Fields:
1. **Name** (Short answer) - Required
2. **Email** (Short answer) - Required, Email validation
3. **Subject** (Short answer) - Required
4. **Message** (Paragraph) - Required
5. **Rating** (Linear scale or Multiple choice) - Optional

### 2. Configure Your Form Settings

1. In your Google Form, click on the "Settings" gear icon
2. Under "General":
   - ✅ Limit to 1 response (optional - prevents spam)
   - ✅ Respondents can edit after submit (optional)
3. Under "Presentation":
   - ✅ Show progress bar
   - Set confirmation message: "Thank you for your feedback! We'll review your submission shortly."

### 3. Get and Configure the URL

1. Click "Send" in your Google Form
2. Click the link icon (🔗)
3. Copy the URL (example: `https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform`)
4. Add to your `.env` file:

```bash
GOOGLE_FORMS_FEEDBACK_URL="https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform"
```

### 4. Test the Integration

1. Restart your Next.js server
2. Navigate to `/feedback` (public page) or `/dashboard/feedback` (authenticated page)
3. You should see your Google Form embedded
4. Submit a test response
5. Check your Google Form's "Responses" tab to verify

## Example Environment Configuration

```bash
# .env file
GOOGLE_FORMS_FEEDBACK_URL="https://docs.google.com/forms/d/e/1FAIpQLSdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/viewform"
```

## Troubleshooting

### Form Not Showing?
- Verify the environment variable is set correctly
- Restart your Next.js application
- Check the browser console for errors

### Form Showing "Open in New Tab" Alert?
- This happens with shortened URLs (forms.gle/XXX)
- Use the full Google Forms URL instead
- Or allow users to open in a new tab

### Want to Switch Back to Custom Form?
Simply remove or comment out the `GOOGLE_FORMS_FEEDBACK_URL` variable:

```bash
# GOOGLE_FORMS_FEEDBACK_URL="..."
```

## Advanced: Custom Pre-filled Responses

You can pre-fill form fields using URL parameters. For example, to pre-fill the email field:

```typescript
// In your component
const prefilledUrl = `${googleFormsUrl}?entry.123456789=${userEmail}`;
```

To find the entry IDs:
1. Open your form in edit mode
2. Click "Preview" (eye icon)
3. Open browser DevTools > Network tab
4. Fill out and submit the form
5. Look at the form submission request to see entry IDs

## Managing Responses

### View Responses in Google Forms
1. Open your form
2. Click "Responses" tab
3. View individual responses or summary

### Export to Google Sheets
1. In the "Responses" tab
2. Click the Google Sheets icon
3. Choose "Create a new spreadsheet" or "Select existing spreadsheet"
4. All responses will sync to the sheet

### Set Up Email Notifications
1. In Google Sheets with your responses
2. Click "Tools" > "Notification rules"
3. Configure when to receive email notifications about new responses
