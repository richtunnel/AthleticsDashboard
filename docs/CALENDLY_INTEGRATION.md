# Calendly Integration

This document describes the Calendly integration for booking demos within the application.

## Overview

The application includes a reusable `BookDemoButton` component that integrates with Calendly for scheduling demos and meetings.

## BookDemoButton Component

### Location
`/src/components/buttons/BookDemoButton.tsx`

### Features
- Opens Calendly scheduling page in a new page using target="_blank"
- Fully customizable styling through Material UI `sx` prop
- Round button design with custom brand colors
- Proper security attributes (rel="noopener noreferrer")
- Accessible link-based implementation
- Simple and reliable with no modal conflicts

### Default Styling
- Background color: `#ceff77` (lime green)
- Text color: `#0f172a` (dark slate)
- Border radius: `50px` (fully rounded)
- Hover effect: Lighter background and lift animation

### Usage

#### Basic Usage
```tsx
import BookDemoButton from "@/components/buttons/BookDemoButton";

<BookDemoButton />
```

#### With Custom Calendly URL
```tsx
<BookDemoButton calendlyUrl="https://calendly.com/your-username/demo" />
```

#### With Custom Label
```tsx
<BookDemoButton calendlyUrl="https://calendly.com/your-username/demo">
  Schedule a Call
</BookDemoButton>
```

#### With Custom Styling
```tsx
<BookDemoButton 
  calendlyUrl="https://calendly.com/your-username/demo"
  sx={{ 
    backgroundColor: "#ff0000",
    color: "#ffffff",
    px: 6,
    py: 2
  }}
>
  Custom Styled Button
</BookDemoButton>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `calendlyUrl` | `string` | `"https://calendly.com"` | The full URL to your Calendly booking page |
| `children` | `ReactNode` | `"Schedule live demo"` | The button text/content |
| `sx` | `SxProps` | Custom styles | Material UI sx prop for custom styling |
| `...props` | `ButtonProps` | - | All other Material UI Button props (except `onClick`, `href`, `target`, `rel`) |

## Environment Configuration

To configure your Calendly URL globally, add it to your `.env.local` file:

```bash
NEXT_PUBLIC_CALENDLY_URL="https://calendly.com/your-username/demo"
```

This URL will be used as the default if no `calendlyUrl` prop is provided to the component.

### Example `.env.local` Entry
```
NEXT_PUBLIC_CALENDLY_URL="https://calendly.com/athleticdirectorhub/demo"
```

## Current Implementation

The button is currently used on the following pages:

### Onboarding Plans Page
Location: `/src/app/onboarding/plans/page.tsx`

The button appears below the text "or get an assist from one of our experts" to allow users to schedule a demo before selecting a plan.

```tsx
<BookDemoButton calendlyUrl={process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com"} />
```

## How It Works

1. The button is rendered as an anchor link with `target="_blank"` attribute
2. When clicked, it opens the Calendly URL in a new browser tab/window
3. Security attributes `rel="noopener noreferrer"` protect against security vulnerabilities
4. This approach is accessible, SEO-friendly, and avoids any modal overlay conflicts with your site's design

## Calendly Setup

To set up Calendly for your application:

1. Create a Calendly account at [calendly.com](https://calendly.com)
2. Create an event type (e.g., "Demo", "Consultation", etc.)
3. Copy your Calendly event URL (e.g., `https://calendly.com/your-username/demo`)
4. Add the URL to your `.env.local` file as `NEXT_PUBLIC_CALENDLY_URL`
5. Deploy your application with the updated environment variable

## Customization

### Changing Button Colors

To match your brand colors, update the button colors in the component or pass custom styles:

```tsx
<BookDemoButton 
  sx={{ 
    backgroundColor: "#your-brand-color",
    color: "#your-text-color",
    "&:hover": {
      backgroundColor: "#your-hover-color"
    }
  }}
/>
```

### Changing Button Shape

To make the button less rounded or rectangular:

```tsx
<BookDemoButton 
  sx={{ 
    borderRadius: "8px" // or "4px" for slightly rounded corners
  }}
/>
```

## Browser Compatibility

The component works in all modern browsers that support:
- ES6+ JavaScript
- Dynamic script loading
- Popup windows (for fallback behavior)

## Security Considerations

- The component uses `rel="noopener noreferrer"` attributes for security when opening links in new tabs
- `noopener` prevents the new page from accessing the `window.opener` property
- `noreferrer` prevents the browser from sending the referrer information
- No sensitive data is passed to Calendly through the link

## Troubleshooting

### Button Does Nothing
- Check that the `NEXT_PUBLIC_CALENDLY_URL` environment variable is set correctly
- Ensure the Calendly URL starts with `https://calendly.com/`
- Verify your Calendly event is published and active
- Check if popup blockers are preventing the new window from opening

### Styling Issues
- Check that custom `sx` props are valid Material UI styles
- Ensure color values are in valid CSS format (hex, rgb, rgba, etc.)

### New Window is Blocked
- Some browsers or extensions may block new windows/tabs by default
- Users may need to allow popups for your site in their browser settings
