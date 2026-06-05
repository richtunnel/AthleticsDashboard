import re

with open('/home/engine/project/src/components/games/GamesTable.tsx', 'r') as f:
    content = f.read()

# Remove the banner JSX section (lines 7858-7898)
old_banner_jsx = """              {hasTBDOpponents && !bannerDismissed && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2,
                    p: 2,
                    mb: 2,
                    borderRadius: 2,
                    bgcolor: (theme) => alpha(theme.palette.warning.light, 0.12),
                    border: "1px solid",
                    borderColor: "warning.light",
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Team names showing as TBD?
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Use the select menu to correspond your csv team columns with this view.
                    </Typography>
                  </Box>
                  <Select size="small" value={selectedBannerColumn} onChange={(e) => setSelectedBannerColumn(e.target.value as string)} displayEmpty sx={{ minWidth: 200 }}>
                    <MenuItem value="" disabled>
                      Select a column…
                    </MenuItem>
                    {availableCustomColumns.map((col) => (
                      <MenuItem key={col} value={col}>
                        {col}
                      </MenuItem>
                    ))}
                  </Select>
                  <Button variant="contained" size="small" onClick={handleSaveBannerColumn} disabled={!selectedBannerColumn}>
                    Save
                  </Button>
                  <IconButton size="small" onClick={handleDismissBanner} aria-label="Dismiss">
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
              )}
              """

# The replacement will just be empty (the ScheduleCalendarView render stays)
new_jsx = ""

if old_banner_jsx in content:
    content = content.replace(old_banner_jsx, new_jsx)
    with open('/home/engine/project/src/components/games/GamesTable.tsx', 'w') as f:
        f.write(content)
    print("Banner JSX removal: SUCCESS")
else:
    print("Banner JSX removal: FAILED - block not found")