# Google Forms Integration for Feedback

## Quick Reference

### Environment Variable
```bash
GOOGLE_FORMS_FEEDBACK_URL="https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform"
```

### Affected Pages
- `/feedback` - Public feedback page
- `/dashboard/feedback` - Authenticated user feedback page

### Component
- `GoogleFeedbackForm` - Located at `/src/components/support/GoogleFeedbackForm.tsx`

## Usage

### Basic Setup

1. Create a Google Form
2. Get the form URL (must be full URL, not shortened)
3. Add to `.env`:
   ```bash
   GOOGLE_FORMS_FEEDBACK_URL="your-form-url"
   ```
4. Restart your application

### Disable Integration

Remove or comment out the environment variable:
```bash
# GOOGLE_FORMS_FEEDBACK_URL="..."
```

## Component API

### GoogleFeedbackForm Props

```typescript
interface GoogleFeedbackFormProps {
  formUrl: string;              // Required: The Google Forms URL
  title?: string;               // Optional: Form title (default: "Share Your Feedback")
  description?: string;         // Optional: Form description
  showFallbackLink?: boolean;   // Optional: Show "Open in New Tab" button (default: true)
}
```

### Example Usage

```tsx
import { GoogleFeedbackForm } from "@/components/support/GoogleFeedbackForm";

export default function CustomFeedbackPage() {
  return (
    <GoogleFeedbackForm 
      formUrl="https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform"
      title="Custom Title"
      description="Custom description text"
      showFallbackLink={true}
    />
  );
}
```

## How It Works

### URL Conversion
The component automatically converts standard Google Forms URLs to embedded format:

**Input:** `https://docs.google.com/forms/d/e/FORM_ID/viewform`  
**Output:** `https://docs.google.com/forms/d/e/FORM_ID/viewform?embedded=true`

### Fallback Behavior

1. **Shortened URLs:** Cannot be embedded, shows "Open in New Tab" option
2. **Iframe Errors:** Automatically falls back to "Open in New Tab" option
3. **No Environment Variable:** Falls back to custom `SupportFeedbackForm`

## Implementation Details

### Page Logic Flow

```
1. Load page (feedback/page.tsx or dashboard/feedback/page.tsx)
2. Check if GOOGLE_FORMS_FEEDBACK_URL is set
   ├─ YES: Render GoogleFeedbackForm component
   └─ NO: Render SupportFeedbackForm component (existing)
```

### Component Logic Flow

```
1. Receive formUrl prop
2. Convert to embedded URL
   ├─ Contains '/viewform': Replace with '/viewform?embedded=true'
   ├─ Contains 'forms.gle': Return null (cannot embed)
   └─ Other: Append '?embedded=true'
3. Render iframe or fallback message
```

## Architecture Decisions

### Why Conditional Rendering?

- **Zero Breaking Changes:** Existing functionality preserved
- **Easy Rollback:** Simply remove environment variable
- **Flexible:** Can switch between forms without code changes

### Why Not Remove Custom Form?

- **Support Tickets:** Still need custom form for support page
- **Fallback:** Ensures app always works even without Google Forms
- **Testing:** Useful for development/testing environments

### Why Environment Variable?

- **Configuration:** Easy to change without code deployment
- **Environment-Specific:** Can use different forms for dev/staging/prod
- **Security:** URL not exposed in client-side code

## Testing

### Manual Testing Checklist

```bash
# Test with Google Forms
export GOOGLE_FORMS_FEEDBACK_URL="https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform"
npm run dev
# Visit /feedback and /dashboard/feedback

# Test without Google Forms
unset GOOGLE_FORMS_FEEDBACK_URL
npm run dev
# Visit /feedback and /dashboard/feedback
```

### Test Cases

- [ ] Form embeds correctly on public page
- [ ] Form embeds correctly on dashboard page
- [ ] "Open in New Tab" button works
- [ ] Falls back to custom form when env var not set
- [ ] Handles invalid URLs gracefully
- [ ] Responsive on mobile devices
- [ ] Form submission works and appears in Google Forms responses

## Troubleshooting

### Form Not Appearing

**Symptom:** Blank space where form should be  
**Solution:** Check browser console for CORS errors or invalid URL

### "Open in New Tab" Always Showing

**Symptom:** Iframe never loads, only fallback button shown  
**Solution:** Ensure using full Google Forms URL, not shortened forms.gle link

### Changes Not Reflecting

**Symptom:** Still seeing old behavior  
**Solution:** Restart Next.js dev server (environment variables are cached)

### Form Too Small/Large

**Symptom:** Form doesn't fit properly  
**Solution:** Adjust height in GoogleFeedbackForm component:
```tsx
height: { xs: 800, md: 1000 } // Modify these values
```

## Security Considerations

### Environment Variable
- Stored server-side, not exposed to client
- Only read during server-side rendering

### Iframe Security
- Uses `noopener,noreferrer` for external links
- Form data submitted directly to Google
- No data flows through your application

### Data Privacy
- Responses stored in Google Forms, not your database
- Subject to Google's privacy policy
- Consider GDPR implications for EU users

## Performance

### Impact
- **Load Time:** Slightly slower due to iframe loading
- **Bundle Size:** Minimal (~2KB for component)
- **Runtime:** No additional API calls or database queries

### Optimization
- Iframe loads asynchronously
- No impact on Time to First Byte (TTFB)
- No impact on Lighthouse scores

## Future Considerations

### Potential Features
1. **Analytics:** Track form views and completions
2. **Pre-filling:** Auto-populate user data in form
3. **Multiple Forms:** Support different forms for different purposes
4. **Webhooks:** Receive notifications when form is submitted
5. **Custom Styling:** Match form colors to your brand

### Known Limitations
1. Cannot customize Google Form styling from your app
2. Shortened URLs cannot be embedded
3. Form must allow embedding (not disabled in settings)
4. Internet connection required (no offline support)

## Additional Resources

- [Google Forms Integration Guide](/docs/GOOGLE_FORMS_INTEGRATION.md)
- [Quick Start Example](/docs/google-forms-example.md)
- [Implementation Summary](/GOOGLE_FORMS_INTEGRATION.md)
- [Google Forms Help Center](https://support.google.com/docs/topic/9055404)
