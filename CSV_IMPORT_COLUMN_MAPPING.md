# CSV Import Column Mapping

## Overview

The CSV import functionality automatically maps common column name aliases to standardized column names, making it easier to import data from various sources without having to manually rename columns.

## Opponent Column Aliases

When importing games from a CSV file, the system automatically recognizes the following column names (case-insensitive) and maps them to the "Opponent" column:

- `Away`
- `Other team`
- `Opponent`
- `Challenger`
- `Playing`
- `Against`

### Examples

All of the following CSV headers will be correctly mapped to the opponent field:

```csv
Date,Time,Sport,Level,Away,Venue
2024-01-15,3:00 PM,Basketball,Varsity,Lincoln High,Gym A
```

```csv
Date,Time,Sport,Level,Against,Venue
2024-01-15,3:00 PM,Basketball,Varsity,Lincoln High,Gym A
```

```csv
Date,Time,Sport,Level,Other Team,Venue
2024-01-15,3:00 PM,Basketball,Varsity,Lincoln High,Gym A
```

All three examples above will successfully import with "Lincoln High" as the opponent.

### Test File

A test CSV file with opponent aliases is available at `test-csv-opponent-aliases.csv` in the project root.

## Implementation Details

The column mapping is case-insensitive and happens during the CSV header parsing phase in the `ImportExportService.importGamesFromCSV()` method.

Location: `/src/lib/services/import-export.service.ts`

The mapping is performed by the `mapColumnAliases()` private method, which normalizes column names before processing the CSV data.

## Future Enhancements

This system can be extended to support additional column mappings for other fields like:
- Date aliases (game date, match date, date of game, etc.)
- Time aliases (start time, game time, kick-off, etc.)
- Venue aliases (location, field, court, etc.)
