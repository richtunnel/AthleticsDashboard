# Custom React Hooks

This directory contains reusable React hooks for the application.

## useDebounce

A lightweight, custom debounce hook with **zero external dependencies** - no lodash needed!

### Why Custom Instead of Lodash?

- ✅ **Zero dependencies** = smaller bundle size (~70KB saved!)
- ✅ **Better React integration** with proper cleanup
- ✅ **Modern hooks-based API**
- ✅ **More maintainable** for React applications
- ✅ **Type-safe** with full TypeScript support

### Features

- Automatic cleanup on component unmount
- Ref-based callback to avoid stale closures
- Configurable delay (default: 300ms)
- Full TypeScript support with generics
- Prevents memory leaks with proper timeout cleanup

### Usage

```tsx
import { useDebounce } from '@/hooks/useDebounce';

function SearchComponent() {
  const [query, setQuery] = useState('');

  // Define your function to debounce
  const fetchResults = async (searchQuery: string) => {
    const response = await fetch(`/api/search?q=${searchQuery}`);
    const data = await response.json();
    // Handle results...
  };

  // Create debounced version with 300ms delay
  const debouncedFetch = useDebounce(fetchResults, 300);

  return (
    <input
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
        debouncedFetch(e.target.value);
      }}
      placeholder="Search..."
    />
  );
}
```

### Advanced Example

```tsx
import { useDebounce } from '@/hooks/useDebounce';

function AutosaveForm() {
  const [formData, setFormData] = useState({ name: '', email: '' });

  // Save function
  const saveToBackend = async (data: typeof formData) => {
    await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  // Debounce with 1 second delay
  const debouncedSave = useDebounce(saveToBackend, 1000);

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    debouncedSave(newData);
  };

  return (
    <form>
      <input
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
      />
      <input
        value={formData.email}
        onChange={(e) => handleChange('email', e.target.value)}
      />
    </form>
  );
}
```

### API

```typescript
function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay?: number
): T
```

**Parameters:**
- `callback: T` - The function to debounce
- `delay?: number` - Delay in milliseconds (default: 300)

**Returns:**
- Debounced version of the callback function

### How It Works

1. **Ref Storage**: Uses `useRef` to store the timeout ID and callback
2. **Callback Updates**: Updates callback ref when it changes (no stale closures)
3. **Cleanup**: Automatically clears timeout on component unmount
4. **Debouncing**: Clears previous timeout and sets new one on each call

### Implementation Details

```typescript
export function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Return debounced function
  return ((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }) as T;
}
```

### Used By

- **SchoolAddressAutocomplete** (`/src/components/forms/SchoolAddressAutocomplete.tsx`)
  - Debounces Google Places API calls
  - 300ms delay to reduce API costs
  - Provides smooth typing experience

### Performance

- **Bundle Size**: ~0.5KB (vs ~70KB for lodash.debounce)
- **Runtime**: Minimal overhead, uses native JavaScript timers
- **Memory**: Proper cleanup prevents memory leaks

### Testing

```typescript
// Test debouncing behavior
const mockFn = jest.fn();
const { result } = renderHook(() => useDebounce(mockFn, 500));

act(() => {
  result.current('test1');
  result.current('test2');
  result.current('test3');
});

// Only the last call should execute after delay
jest.advanceTimersByTime(500);
expect(mockFn).toHaveBeenCalledTimes(1);
expect(mockFn).toHaveBeenCalledWith('test3');
```

### Common Use Cases

1. **Search Input**: Debounce API calls as user types
2. **Form Autosave**: Save form data after user stops typing
3. **Window Resize**: Debounce resize event handlers
4. **Scroll Events**: Debounce expensive scroll calculations
5. **Validation**: Debounce real-time form validation

### Comparison with Lodash

| Feature | useDebounce (Custom) | lodash.debounce |
|---------|---------------------|-----------------|
| Bundle Size | ~0.5KB | ~70KB |
| Dependencies | None | lodash |
| React Integration | Native (hooks) | Manual cleanup needed |
| TypeScript | Full support | Requires @types/lodash |
| Cleanup | Automatic | Manual |
| Memory Leaks | Prevented | Risk if not cleaned up |

### Migration from Lodash

**Before (with lodash):**
```tsx
import debounce from 'lodash/debounce';
import { useCallback } from 'react';

function MyComponent() {
  const debouncedFn = useCallback(
    debounce((value) => {
      console.log(value);
    }, 300),
    []
  );

  // Manual cleanup needed!
  useEffect(() => {
    return () => debouncedFn.cancel();
  }, [debouncedFn]);

  return <input onChange={(e) => debouncedFn(e.target.value)} />;
}
```

**After (with useDebounce):**
```tsx
import { useDebounce } from '@/hooks/useDebounce';

function MyComponent() {
  const myFunction = (value: string) => {
    console.log(value);
  };

  const debouncedFn = useDebounce(myFunction, 300);

  // Cleanup automatic! 🎉

  return <input onChange={(e) => debouncedFn(e.target.value)} />;
}
```

### Best Practices

1. **Keep callbacks simple**: Debounced functions should be focused and single-purpose
2. **Use appropriate delays**: 
   - Search: 300-500ms
   - Autosave: 1000-2000ms
   - Events: 100-200ms
3. **Avoid debouncing critical actions**: Don't debounce form submissions or save buttons
4. **Consider user experience**: Too long = laggy, too short = too many calls

### Related Hooks

This is part of a collection of custom hooks. Other hooks to be added:
- `useThrottle` - Limit function calls to once per interval
- `useLocalStorage` - Sync state with localStorage
- `useMediaQuery` - Responsive design hooks

## Contributing

When adding new hooks:
1. Keep them simple and focused
2. Add TypeScript types
3. Document with examples
4. Consider performance implications
5. Test edge cases
