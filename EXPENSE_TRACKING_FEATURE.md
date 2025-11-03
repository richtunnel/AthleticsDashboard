# Game Expense Tracking Feature

## Overview
This feature allows athletic directors to track expenses per game across multiple categories (Travel, Food, Clothes, and Gifts) and provides comprehensive analytics with visualization through year/month charts.

## Features Implemented

### 1. Database Schema
- **New Model**: `GameExpense`
  - Fields: `travelExpense`, `foodExpense`, `clothesExpense`, `giftsExpense`, `notes`
  - One-to-one relationship with `Game`
  - Automatic cascading delete when game is removed

### 2. API Endpoints

#### Expense Management (`/api/expenses`)
- **GET**: Fetch all expenses or a specific game's expense
  - Query param: `gameId` (optional)
  - Returns expenses with full game details
  
- **POST**: Create or update expense for a game
  - Upsert operation (creates if doesn't exist, updates if exists)
  - Validates game ownership
  
- **DELETE**: Remove expense record
  - Query param: `gameId` (required)
  - Validates game ownership

#### Analytics (`/api/expenses/analytics`)
- **GET**: Retrieve expense analytics
  - Returns monthly breakdown by category
  - Calculates totals and averages
  - Groups data by year-month

#### Export (`/api/export/expenses`)
- **GET**: Export all expenses to CSV
  - Includes game details and all expense categories
  - Formatted for easy spreadsheet import

### 3. Frontend Components

#### ExpenseFormDialog
- Modal dialog for adding/editing game expenses
- Input fields for all expense categories (Travel, Food, Clothes, Gifts)
- Real-time total calculation
- Notes field for additional context
- Game details display for context

#### ExpenseManager
- Comprehensive expense management interface
- Two-section view:
  1. Games with tracked expenses (editable table)
  2. Games without expenses (quick add buttons)
- Inline editing and deletion
- Real-time updates with React Query

#### ExpenseAnalytics
- Visual analytics dashboard with:
  - Summary cards (Total Expenses, Average per Game, Games Tracked)
  - Monthly expense breakdown (stacked bar chart)
  - Total expenses over time (line chart)
  - Category totals breakdown
- Export button for CSV download
- Built with Recharts for responsive visualizations

### 4. Navigation
- New "Expenses" menu item in dashboard sidebar
- Dedicated `/dashboard/expenses` page
- Analytics integrated into `/dashboard/analytics` page

## Usage Guide

### Adding Expenses to a Game
1. Navigate to "Expenses" from the dashboard menu
2. Find the game in the "Games Without Expenses" section
3. Click "Add Expense" button
4. Fill in expense amounts for each category
5. Add optional notes
6. Click "Save"

### Editing Expenses
1. Go to "Expenses" page
2. Find the game in "Games with Tracked Expenses" table
3. Click the edit (pencil) icon
4. Modify expense values
5. Click "Save"

### Viewing Analytics
1. Navigate to "Analytics" from the dashboard menu
2. Scroll to "Expense Analytics" section
3. View charts and summary statistics
4. Click "Export Data" to download CSV

### Exporting Data
- **From Analytics Page**: Click "Export Data" button in Expense Analytics section
- Downloads CSV with all expense records including:
  - Date, Sport, Team, Level, Opponent, Venue
  - Travel, Food, Clothes, Gifts expenses
  - Total expense per game
  - Notes

## Data Structure

### GameExpense Model
```typescript
{
  id: string
  gameId: string (unique)
  travelExpense: number
  foodExpense: number
  clothesExpense: number
  giftsExpense: number
  notes?: string
  createdAt: Date
  updatedAt: Date
}
```

### Analytics Data
```typescript
{
  monthlyData: Array<{
    month: string (e.g., "Jan 2024")
    year: number
    travelExpense: number
    foodExpense: number
    clothesExpense: number
    giftsExpense: number
    totalExpense: number
    gameCount: number
  }>
  totals: {
    travelExpense: number
    foodExpense: number
    clothesExpense: number
    giftsExpense: number
    totalExpense: number
    gameCount: number
  }
  averagePerGame: number
}
```

## Technical Stack

### Backend
- Next.js API Routes (App Router)
- Prisma ORM
- PostgreSQL Database
- TypeScript

### Frontend
- React 19
- Material UI v7
- TanStack Query (React Query)
- Recharts for data visualization
- TypeScript

## Migration

A database migration has been created:
- Location: `/prisma/migrations/20251103004815_add_game_expenses/`
- Run migration: `npx prisma migrate deploy`

## Security

- All endpoints protected with `requireAuth()`
- Organization-level access control
- Validates game ownership before operations
- No cross-organization data access

## Future Enhancements

Potential improvements:
1. Budget setting and alerts
2. Year-over-year comparison charts
3. Expense forecasting
4. Category customization
5. Bulk import from CSV
6. Mobile-responsive expense entry
7. Receipt attachment support
8. Approval workflow for large expenses
9. Integration with accounting software
10. Multi-currency support

## Testing

To test the feature:
1. Create some games in the system
2. Add expenses to those games
3. View the expense analytics
4. Export the data
5. Edit existing expenses
6. Delete expense records

## Dependencies Added

- `recharts` - For chart visualizations (^2.x)

## Files Created/Modified

### New Files
- `/prisma/migrations/20251103004815_add_game_expenses/migration.sql`
- `/types/expenses.ts`
- `/src/app/api/expenses/route.ts`
- `/src/app/api/expenses/analytics/route.ts`
- `/src/app/api/export/expenses/route.ts`
- `/src/components/expenses/ExpenseFormDialog.tsx`
- `/src/components/expenses/ExpenseManager.tsx`
- `/src/components/expenses/ExpenseAnalytics.tsx`
- `/src/app/dashboard/expenses/page.tsx`

### Modified Files
- `/prisma/schema.prisma` - Added GameExpense model
- `/src/app/dashboard/analytics/page.tsx` - Added expense analytics
- `/src/app/dashboard/DashboardLayoutClient.tsx` - Added navigation link
- `/src/app/api/games/route.ts` - Include expense relation

## Support

For issues or questions about the expense tracking feature:
1. Check the analytics page for data consistency
2. Verify database migration has been applied
3. Ensure proper authentication and organization access
4. Review console for API errors
