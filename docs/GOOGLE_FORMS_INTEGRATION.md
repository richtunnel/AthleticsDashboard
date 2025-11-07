# Google Forms Integration for Feedback

This document explains how to integrate Google Forms with your feedback form.

## Overview

The application supports embedding Google Forms as an alternative to the built-in feedback form. When configured, both the public feedback page (`/feedback`) and the dashboard feedback page (`/dashboard/feedback`) will display the embedded Google Form instead of the custom form.

## Setup Instructions

### 1. Create a Google Form

1. Go to [Google Forms](https://forms.google.com/)
2. Create a new form or use an existing one
3. Add your desired fields (e.g., Name, Email, Subject, Message)
4. Configure form settings as needed

### 2. Get the Form URL

1. Click the "Send" button in your Google Form
2. Click the link icon (🔗) to get the shareable link
3. Copy the full URL (it should look like `https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform`)

### 3. Configure Environment Variable

Add the following to your `.env` file:

```bash
GOOGLE_FORMS_FEEDBACK_URL="https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform"
```

Replace `YOUR_FORM_ID` with your actual form ID.

### 4. Restart Your Application

After setting the environment variable, restart your Next.js application for the changes to take effect.

## Features

### Automatic Embedding

The component automatically converts Google Forms URLs to embedded format by adding the `embedded=true` parameter.

### Fallback Options

- If the form cannot be embedded (e.g., due to CORS restrictions or shortened URLs), users are provided with a button to open the form in a new tab
- If the environment variable is not set, the application falls back to the built-in custom feedback form

### User Experience

- The embedded form is fully responsive and adjusts to different screen sizes
- Users can interact with the Google Form without leaving your application
- An "Open in New Tab" button is provided for users who prefer to fill out the form in a separate window

## Supported URL Formats

The integration supports the following Google Forms URL formats:

- `https://docs.google.com/forms/d/e/FORM_ID/viewform`
- `https://docs.google.com/forms/d/FORM_ID/viewform`

**Note:** Shortened URLs (e.g., `https://forms.gle/XXXXX`) cannot be embedded and will show the fallback option to open in a new tab.

## Viewing Responses

All form responses will be stored in your Google Forms account. You can view and manage them by:

1. Opening your form in Google Forms
2. Clicking the "Responses" tab
3. Viewing responses in the form or exporting to Google Sheets

## Disabling Google Forms Integration

To revert to the built-in custom feedback form:

1. Remove or comment out the `GOOGLE_FORMS_FEEDBACK_URL` environment variable
2. Restart your application

## Benefits of Using Google Forms

- **Familiar Interface:** Users may already be familiar with Google Forms
- **Spam Protection:** Google Forms includes built-in spam protection
- **Easy Response Management:** View and export responses directly in Google Sheets
- **Form Logic:** Use Google Forms' advanced features like conditional sections and response validation
- **No Database Storage:** Responses are stored in Google's infrastructure

## Keeping Both Options

If you want to offer both options to users, you can modify the pages to display both the Google Form and a link to the built-in form, or vice versa. The current implementation uses Google Forms as the primary option when configured.
