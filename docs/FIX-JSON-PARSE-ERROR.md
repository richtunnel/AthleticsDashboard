# Fix: JSON Parse Error in Games PATCH Endpoint

## Problem
The games PATCH endpoint (`/api/games/[id]`) was throwing a `SyntaxError: Unexpected end of JSON input` error when trying to parse the request body.

## Root Cause
The error occurred when:
1. The request body was empty or incomplete
2. Race conditions with AbortController in the autosave mechanism
3. Timing issues causing malformed requests

## Solution
Added comprehensive error handling at multiple layers:

### 1. API Route (`/src/app/api/games/[id]/route.ts`)
- Wrapped `request.json()` in a try-catch block to handle JSON parsing errors
- Added validation to reject empty request bodies
- Returns proper 400 Bad Request responses with descriptive error messages

### 2. Client-Side Mutation (`/src/components/games/GamesTable.tsx`)
- Added validation in `updateGameMutation` to prevent sending empty data
- Added validation in `executeBatchedSave` to skip empty updates
- Improved error messaging for debugging

## Changes Made

### API Route
```typescript
// Handle empty or malformed request body
let body;
try {
  body = await request.json();
} catch (error) {
  console.error("Error parsing request body:", error);
  return NextResponse.json(
    { error: "Invalid request body. Expected valid JSON." },
    { status: 400 }
  );
}

// Validate that body is not empty
if (!body || Object.keys(body).length === 0) {
  return NextResponse.json(
    { error: "Request body cannot be empty" },
    { status: 400 }
  );
}
```

### Client-Side
```typescript
// In updateGameMutation
if (!data || Object.keys(data).length === 0) {
  throw new Error("Cannot update game with empty data");
}

// In executeBatchedSave
if (!updateData || Object.keys(updateData).length === 0) {
  console.warn(`Skipping empty update for game ${gameId}`);
  pendingChangesRef.current.delete(gameId);
  return;
}
```

## Testing
The fix handles the following scenarios:
- Empty request body (empty string)
- Incomplete JSON (`{`)
- Valid but empty JSON object (`{}`)
- Malformed JSON

## Impact
- Prevents server crashes from JSON parsing errors
- Provides better error messages for debugging
- Improves user experience by handling edge cases gracefully
- No breaking changes to existing functionality
