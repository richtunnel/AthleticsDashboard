# Forms Components

This directory contains reusable form components for the application.

## SchoolAddressAutocomplete

A Google Places Autocomplete component for entering school addresses with intelligent suggestions.

### Features

- **Server-side API security**: All Google API calls made from backend
- **Debounced search**: 300ms delay to reduce API calls
- **Session token optimization**: Groups autocomplete + place details for billing efficiency
- **School detection**: Shows badge when a school is detected
- **Loading states**: Visual feedback during API requests
- **Keyboard navigation**: Full accessibility support

### Usage

```tsx
import SchoolAddressAutocomplete from "@/components/forms/SchoolAddressAutocomplete";

function MyForm() {
  const [address, setAddress] = useState("");

  return (
    <SchoolAddressAutocomplete
      value={address}
      onChange={(value, placeDetails) => {
        setAddress(value);
        // Optional: Use placeDetails for additional info
        if (placeDetails?.isSchool) {
          console.log("School detected!");
        }
      }}
      label="School Address"
      placeholder="Start typing to search..."
      required
      size="small"
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | Required | Current address value |
| `onChange` | `(value: string, placeDetails?: PlaceDetails) => void` | Required | Callback when address changes |
| `label` | `string` | `"School Address"` | Field label |
| `placeholder` | `string` | `"e.g., 123 Main St..."` | Input placeholder |
| `required` | `boolean` | `false` | Whether field is required |
| `disabled` | `boolean` | `false` | Disable input |
| `size` | `"small" \| "medium"` | `"small"` | Input size |
| `error` | `boolean` | `false` | Show error state |
| `helperText` | `string` | `undefined` | Helper/error text below input |

### PlaceDetails Type

```typescript
type PlaceDetails = {
  formattedAddress: string;
  addressComponents: any[];
  types: string[];
  isSchool: boolean;
  geometry: any;
};
```

### Integration Points

Currently used in:
- `/onboarding/details` - Onboarding flow for new users
- `/dashboard/settings` - School details form in settings

### API Endpoints

- `POST /api/google-places/autocomplete` - Returns address predictions
- `POST /api/google-places/details` - Returns full place details

### Environment Variables

Requires `GOOGLE_MAPS_API_KEY` to be configured in `.env` file.

### Documentation

See `/docs/GOOGLE_PLACES_AUTOCOMPLETE.md` for full documentation.
