# Games Table Multiple Workbooks Feature

## Overview
This feature allows users to create multiple separate games tables (workbooks) similar to Excel/Google Sheets, where users can organize their games into separate spreadsheets.

## Implementation

### Database Schema

**New Model: GamesWorkbook**
```prisma
model GamesWorkbook {
  id          String   @id @default(cuid())
  name        String
  sortOrder   Int      @default(0)
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  games   Game[]
}
```

**Updated Models:**
- `User`: Added `gamesWorkbooks` relation
- `Game`: Added `workbookId? String?` field with relation to `GamesWorkbook`

### API Endpoints

#### `/api/games-workbooks` (GET)
- Fetches all workbooks for the current user
- Includes game count for each workbook
- Returns: `{ data: GamesWorkbook[] }`

#### `/api/games-workbooks` (POST)
- Creates a new workbook
- Requires: `name` (string)
- Auto-assigns sort order
- Returns: `{ data: GamesWorkbook }`

#### `/api/games-workbooks/[id]` (PATCH)
- Renames an existing workbook
- Requires: `name` (string)
- Validates ownership
- Returns: `{ data: GamesWorkbook }`

#### `/api/games-workbooks/[id]` (DELETE)
- Deletes an empty workbook
- Cannot delete workbooks with games
- Validates ownership
- Returns: `{ data: { id: string } }`

### State Management

**New Store:** `gamesWorkbookStore` (`src/lib/stores/gamesWorkbookStore.ts`)

Features:
- Persists workbooks and selected workbook across page reloads
- Manages workbook selector visibility
- Provides methods: `addWorkbook`, `updateWorkbook`, `deleteWorkbook`, `setSelectedWorkbookId`

### UI Components

**GamesTable.tsx Updates:**

1. **"Create Table" Button**
   - Added next to "Create Game" button
   - Icon: `TableChart` from Material UI
   - Tooltip: "Add a separate table"
   - Opens workbook selector when clicked

2. **Workbook Selector View**
   - Displayed when `showWorkbookSelector` is true
   - Shows grid of workbook cards
   - Each card displays:
     - Workbook name (e.g., "Spreadsheet1", "Varsity Basketball")
     - Game count
     - Edit button (renames workbook)
     - Delete button (only for empty workbooks with multiple workbooks)
   - Selected workbook has thicker border
   - "Create Table" card with dashed border

3. **Workbook Rename Dialog**
   - Modal dialog for renaming workbooks
   - Enter key submits
   - Validates name is not empty

### Behavior

#### Default Workbook Creation
- When creating a new workbook, default naming is `SpreadsheetX`
- `X` represents the total number of workbooks + 1
- Example: If 2 workbooks exist, new one is named "Spreadsheet3"

#### Workbook Selection
- Games API is filtered by `workbookId` query parameter
- Only games in selected workbook are displayed
- Query cache key includes `selectedWorkbookId` for proper refetching

#### Existing Data
- Games without a workbook assigned (`workbookId = null`) remain visible in the default view
- When workbooks exist, the first workbook is auto-selected
- When no workbook exists, all games are shown (backward compatible)

### User Experience

1. User clicks "Create Table" button
2. Workbook selector view appears
3. User sees existing workbooks and can:
   - Click a workbook card to select it
   - Click "Create Table" card to create a new workbook
   - Rename existing workbooks via edit icon
   - Delete empty workbooks (when multiple exist)
4. Selecting a workbook shows the games table filtered to that workbook
5. "Create Table" button remains visible to switch back to selector

### Migration

**File:** `prisma/migrations/20250120000000_add_games_workbooks/migration.sql`

Creates:
- `GamesWorkbook` table with all fields and indexes
- `workbookId` column on `Game` table
- Foreign key constraint linking games to workbooks
- Indexes for filtering by workbook and user

### Security & Validation

- All workbook operations verify user ownership via `userId`
- Cannot delete workbooks containing games
- Workbook names are required
- Rate limiting applied (via existing games API)

### Analytics Tracking

- `Games Workbook Created` event tracked when creating workbooks
- `Games Table Create Table Clicked` event tracked on button click
- Includes workbook ID and name in event data

### Testing Checklist

- [ ] Create new workbook
- [ ] Rename existing workbook
- [ ] Delete empty workbook
- [ ] Switch between workbooks
- [ ] Create games in specific workbook
- [ ] Verify games are filtered by workbook
- [ ] Test with existing games (workbookId = null)
- [ ] Test default workbook selection
- [ ] Test "SpreadsheetX" naming convention
- [ ] Test dark mode styling
- [ ] Test mobile responsive layout
