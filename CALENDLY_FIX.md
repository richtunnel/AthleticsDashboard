# Calendly Demo Button Fix

## Problem
The demo button in the HomePageContent component wasn't opening the correct Calendly URL. The button action wasn't navigating to "https://calendly.com/athleticdirectorhub/30min" as expected.

## Root Cause
The `NEXT_PUBLIC_CALENDLY_URL` environment variable was not defined in the project. There was no `.env` or `.env.local` file, causing the environment variable to be undefined and falling back to a generic URL.

## Solution

### 1. Created `.env.local` file
Added the Calendly URL to a new `.env.local` file:
```
NEXT_PUBLIC_CALENDLY_URL="https://calendly.com/athleticdirectorhub/30min"
```

### 2. Updated HomePageContent component
Modified `/src/components/home/HomePageContent.tsx`:
- Added a constant `CALENDLY_URL` that reads from the environment variable with a fallback
- Updated the BookDemoButton to use this constant instead of inline `process.env` access

### 3. Updated `.env.example`
Updated the example file to include the correct Calendly URL as a reference for other developers.

## How It Works

The BookDemoButton component now:
1. Receives the correct Calendly URL via the `calendlyUrl` prop
2. Attempts to open a Calendly popup widget when clicked
3. Falls back to opening the URL in a new browser tab if the Calendly script hasn't loaded

## Testing
After restarting the development server, the demo button should:
- Open the Calendly popup widget with the URL: https://calendly.com/athleticdirectorhub/30min
- Or open this URL in a new tab if the popup fails to load

## Note
Remember to restart your development server (`npm run dev` or `yarn dev`) to pick up the new environment variable from `.env.local`.
