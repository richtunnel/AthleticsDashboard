# Button Components

This directory contains reusable button components used throughout the application.

## Available Components

### BookDemoButton
**File:** `BookDemoButton.tsx`

A round, branded button that integrates with Calendly for scheduling demos and meetings.

**Features:**
- Opens Calendly in a new page using target="_blank"
- Custom brand colors (#0f172a background, #ceff77 text)
- Round button design (50px border radius)
- Hover animations and effects
- Proper security attributes (rel="noopener noreferrer")
- Accessible link-based implementation

**Usage:**
```tsx
import BookDemoButton from "@/components/buttons/BookDemoButton";

<BookDemoButton calendlyUrl="https://calendly.com/your-username/demo" />
```

See [docs/CALENDLY_INTEGRATION.md](/docs/CALENDLY_INTEGRATION.md) for detailed documentation.

---

### EnableAiButton
**File:** `EnableAiButton.tsx`

A gradient AI-styled button with an animated icon.

**Features:**
- Gradient background (primary to secondary theme colors)
- Custom gradient AI icon
- Hover lift animation
- Box shadow effects

**Usage:**
```tsx
import AIButton from "@/components/buttons/EnableAiButton";

<AIButton />
```

---

## Creating New Button Components

When creating new button components, follow these guidelines:

1. **Use Material UI Button as base:** Start with MUI's `Button` component
2. **Use "use client" directive:** All button components should be client components
3. **Accept sx prop:** Allow customization through Material UI's `sx` prop
4. **Provide sensible defaults:** Pre-style buttons but allow overrides
5. **Document usage:** Add examples to this README

### Example Template

```tsx
"use client";

import { Button, ButtonProps } from "@mui/material";

interface MyButtonProps extends Omit<ButtonProps, 'onClick'> {
  customProp?: string;
}

export default function MyButton({ 
  customProp,
  children,
  sx,
  ...props 
}: MyButtonProps) {
  const handleClick = () => {
    // Custom click logic
  };

  return (
    <Button
      variant="contained"
      onClick={handleClick}
      sx={{
        // Custom styles
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
```
