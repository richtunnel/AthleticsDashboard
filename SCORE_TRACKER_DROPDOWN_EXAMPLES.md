# Score Tracker Dropdown Options - Visual Guide

## ✅ Correctly Implemented: Single Combined Dropdown

### What Users See in Both Dropdowns:

#### 1. Score Input Modal Dropdown
When clicking the scoreboard icon to add a score, users see ONE dropdown with combined options:

```
┌─────────────────────────────────────────┐
│ Sport & Level                     ▼     │
├─────────────────────────────────────────┤
│ Badminton                               │
│ ✓ Boys Frosh-Soph Baseball              │ ← Single combined option
│   Boys Frosh-Soph Basketball            │
│   Boys Frosh-Soph Cross Country         │
│   Boys Frosh-Soph Football              │
│   Boys Frosh-Soph Soccer                │
│   Boys Frosh-Soph Wrestling             │
│   Boys Freshmen Baseball                │
│   Boys Freshmen Basketball              │
│   Boys Freshmen Football                │
│   Boys Freshmen Soccer                  │
│   Boys Freshmen Volleyball              │
│   Boys Junior Varsity Badminton         │
│   Boys Junior Varsity Baseball          │
│   Boys Junior Varsity Basketball        │
│   Boys Varsity Basketball               │
│   Boys Varsity Football                 │
│   Coed Varsity Cheerleading             │
│   Coed Varsity Esports                  │
│   Girls Frosh-Soph Basketball           │
│   Girls Frosh-Soph Field Hockey         │
│   Girls Junior Varsity Basketball       │
│   Girls Varsity Basketball              │
│   Girls Varsity Soccer                  │
│   Girls Varsity Softball                │
└─────────────────────────────────────────┘
```

#### 2. Score Tracker Filter Dropdown
In the score tracker section, users see filtered options (only combinations that have scores):

```
┌─────────────────────────────────────────┐
│ Filter by Sport & Level           ▼     │
├─────────────────────────────────────────┤
│ All Sports (default)                    │
│ Boys Varsity Basketball                 │ ← Only shows combinations
│ Girls Varsity Soccer                    │    that have recorded scores
│ Boys Junior Varsity Football            │
└─────────────────────────────────────────┘
```

## ❌ NOT Implemented (What We Don't Have):

### Three Separate Dropdowns (Old Approach - NOT USED)
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Gender    ▼     │ │ Level     ▼     │ │ Sport     ▼     │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ Boys            │ │ Varsity         │ │ Basketball      │
│ Girls           │ │ Junior Varsity  │ │ Football        │
│ Coed            │ │ Frosh-Soph      │ │ Soccer          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```
**This is NOT how it works** - We use ONE combined dropdown instead!

## Implementation Details

### How the Combined Labels Are Created:

From `getSportLevelOptions()`:
```typescript
// For each sport and team combination:
{
  label: `${team.gender} ${team.level} ${sport.name}`,  // ← COMBINED STRING
  sport: sport.name,    // Stored separately for filtering
  gender: team.gender,  // Stored separately for filtering  
  level: team.level     // Stored separately for filtering
}
```

**Examples of generated labels:**
- "Boys Varsity Basketball"
- "Girls Junior Varsity Soccer"
- "Coed Varsity Esports"
- "Boys Frosh-Soph Football"
- "Girls Varsity (Flag) Football"

### Why We Store Separate Fields:

The `sport`, `gender`, and `level` fields are stored separately in the database for:
1. **Efficient filtering** - Query by sport/gender/level combinations
2. **Future analytics** - Analyze performance by sport, gender, or level
3. **Flexible display** - Can format labels differently if needed

But the **user interface shows only the combined label** in a single dropdown!

## Total Number of Options:

Based on the canonical sports data:
- **27 sports** with various gender/level combinations
- **Approximately 150+ combined options** in the full dropdown
- Examples:
  - Football: 6 options (Boys Varsity, Boys JV, Boys Frosh-Soph, Boys Freshmen, Girls Varsity Flag, Girls JV Flag)
  - Basketball: 8 options (Boys/Girls × Varsity/JV/Frosh-Soph/Freshmen)
  - Esports: 2 options (Coed Varsity, Coed JV)
  - Skiing: 2 options (Boys Varsity, Girls Varsity)

## User Flow Example:

1. **User clicks scoreboard icon** on "Lincoln High" opponent
2. **Score modal opens** with ONE dropdown
3. **User types** "girls" → dropdown filters to show:
   - Girls Varsity Basketball
   - Girls Varsity Soccer
   - Girls Varsity Volleyball
   - ... (all girls options)
4. **User selects** "Girls Varsity Basketball"
5. **User enters scores** - Your Team: 65, Lincoln High: 58
6. **Score card appears** with "Girls Varsity Basketball" chip
7. **Filter dropdown** now includes "Girls Varsity Basketball" as an option
8. **User can filter** score tracker to show only "Girls Varsity Basketball" scores

## ✅ Confirmation

✔️ **Single combined dropdown** in score input modal  
✔️ **Single filter dropdown** in score tracker  
✔️ **Combined labels** like "Boys Varsity Basketball"  
✔️ **Alphabetically sorted** options  
✔️ **Search/filter** functionality in dropdowns  
✔️ **No separate gender/level/sport dropdowns**  

The implementation is **correct and complete**! 🎉
