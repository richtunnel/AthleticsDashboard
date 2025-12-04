"use client";

import { Fragment, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, CardHeader, CircularProgress, Divider, IconButton, List, ListItem, ListItemText, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import LaunchIcon from "@mui/icons-material/Launch";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MinimizeIcon from "@mui/icons-material/Minimize";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { format, isToday, isTomorrow, parseISO } from "date-fns";

import { useGamesFiltersStore } from "@/lib/stores/gamesFiltersStore";
import { useDashboardPreferencesStore } from "@/lib/stores/dashboardPreferencesStore";
import { formatLevelDisplay } from "@/lib/utils/formatters";

const REFRESH_INTERVAL_MS = 1000 * 60 * 1;

interface Game {
  id: string;
  date: string;
  time: string | null;
  status: string;
  isHome: boolean;
  customFields?: Record<string, any>;
  homeTeam: {
    id?: string;
    name: string;
    level: string;
    location: string;
    sport: {
      name: string;
    };
  };
  opponent?: {
    id?: string;
    name: string;
  };
  venue?: {
    id?: string;
    name: string;
  };
  googleCalendarHtmlLink?: string | null;
}

interface GroupedEvents {
  key: string;
  label: string;
  date: Date;
  items: Array<{ game: Game; startDate: Date }>;
}

// Helper functions for extracting data from customFields
const convertTimeFormat = (timeStr: string): string => {
  try {
    // Handle formats like "3:00 PM", "15:00", "3:00pm", etc.
    const timeRegex = /^(\d{1,2}):(\d{2})(\s*(am|pm|AM|PM))?$/;
    const match = timeStr.trim().match(timeRegex);

    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = match[4]?.toLowerCase();

      if (ampm) {
        // Convert 12-hour to 24-hour
        if (ampm === "pm" && hours !== 12) {
          hours += 12;
        } else if (ampm === "am" && hours === 12) {
          hours = 0;
        }
      }

      return `${hours.toString().padStart(2, "0")}:${minutes}`;
    }

    // If already in HH:MM format, return as is
    if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
      const [h, m] = timeStr.split(":");
      return `${h.padStart(2, "0")}:${m}`;
    }

    return timeStr; // Return original if we can't parse it
  } catch (error) {
    console.warn("⚠️ Could not convert time format:", timeStr, error);
    return timeStr;
  }
};

const getGameTime = (game: Game): string | null => {
  // First check the standard game.time field
  if (game.time) {
    console.log("⏰ Found time in game.time:", game.time);
    return game.time;
  }

  // Then check customFields for time data
  const customFields = game.customFields || {};
  if (Object.keys(customFields).length > 0) {
    const allFields = Object.keys(customFields);

    // Look for time-related fields
    const timeField = allFields.find((key) => {
      const lowerKey = key.toLowerCase();
      return (
        lowerKey.includes("time") ||
        lowerKey.includes("start") ||
        lowerKey.includes("kickoff") ||
        lowerKey.includes("begin") ||
        lowerKey.includes("hour") ||
        // Check if the VALUE looks like a time (HH:MM format or similar)
        (customFields[key] && String(customFields[key]).match(/^\d{1,2}:\d{2}(\s*(am|pm|AM|PM))?$|^\d{1,2}:\d{2}$/))
      );
    });

    if (timeField && customFields[timeField]) {
      const timeValue = String(customFields[timeField]);
      console.log("⏰ Found time in customFields:", timeValue, "from field:", timeField);

      // Convert various time formats to HH:MM
      const convertedTime = convertTimeFormat(timeValue);
      return convertedTime;
    }

    // If no specific time field found, look through all fields for time-like values
    for (const [key, value] of Object.entries(customFields)) {
      if (value && typeof value === "string") {
        const val = String(value);
        // Check if this looks like a time
        if (val.match(/^\d{1,2}:\d{2}(\s*(am|pm|AM|PM))?$|^\d{1,2}:\d{2}$/)) {
          console.log("⏰ Found time by content:", val, "in field:", key);
          return convertTimeFormat(val);
        }
      }
    }
  }

  return null;
};

export function CalendarPreviewWidget() {
  const { data: session } = useSession();
  const columnFilters = useGamesFiltersStore((state) => state.columnFilters);
  const { calendarWidgetState, setCalendarWidgetState } = useDashboardPreferencesStore();

  const calendarAccountEmail = session?.user?.googleCalendarEmail || session?.user?.email || null;
  const calendarHref = calendarAccountEmail ? `https://calendar.google.com/calendar/u/0/r?account=${encodeURIComponent(calendarAccountEmail)}` : "https://calendar.google.com/calendar/u/0/r";
  const calendarTooltip = calendarAccountEmail ? `Open Google Calendar for ${calendarAccountEmail}` : "Open Google Calendar";

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-upcoming-games", columnFilters],
    queryFn: async () => {
      const params = new URLSearchParams();

      // Apply filters from the store
      Object.entries(columnFilters).forEach(([columnId, filter]) => {
        params.append(`filter_${columnId}_type`, filter.type);
        if (filter.type === "condition") {
          params.append(`filter_${columnId}_condition`, filter.condition || "");
          params.append(`filter_${columnId}_value`, filter.value || "");
          if (filter.secondValue) {
            params.append(`filter_${columnId}_secondValue`, filter.secondValue);
          }
        } else if (filter.type === "values") {
          params.append(`filter_${columnId}_values`, JSON.stringify(filter.values || []));
        }
      });

      // Only fetch upcoming games (future games from today onwards)
      const now = new Date();

      // Add date filter for games from today onwards
      params.append("filter_date_type", "condition");
      params.append("filter_date_condition", "greaterThanOrEqual");
      params.append("filter_date_value", now.toISOString().split("T")[0]);

      // Sort by date ascending to get the earliest upcoming games
      params.append("sortBy", "date");
      params.append("sortOrder", "asc");
      params.append("page", "1");
      params.append("limit", "3");

      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error("Failed to fetch games");
      const response = await res.json();

      // Also get the column mapping
      const prefsRes = await fetch("/api/user/table-preferences?table=games");
      const prefsData = prefsRes.ok ? await prefsRes.json() : null;
      const columnMapping = prefsData?.data?.columnMapping || {};

      return {
        games: response.data?.games || [],
        columnMapping,
      };
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const games = data?.games ?? [];
  const columnMapping = data?.columnMapping ?? {};
  console.log("Calendar widget data:", { games: games.slice(0, 1), columnMapping });
  if (games.length > 0) {
    console.log("First game customFields:", games[0].customFields);
  }

  const groupedEvents = useMemo(() => groupGamesByDate(games), [games]);

  const errorMessage = error instanceof Error ? error.message : "Failed to load upcoming games.";

  // If hidden, show a compact button to show the calendar
  if (calendarWidgetState === "hidden") {
    return (
      <Box
        sx={{
          display: { xs: "none", md: "block" },
          minWidth: { md: 320 },
          maxWidth: { md: 360 },
          position: { md: "sticky" },
          top: { md: 96 },
          alignSelf: { md: "flex-start" },
        }}
      >
        <Button variant="outlined" startIcon={<EventNoteIcon />} onClick={() => setCalendarWidgetState("full")} fullWidth sx={{ py: 1.5 }}>
          Show Calendar
        </Button>
      </Box>
    );
  }

  // Helper function to get display name from imported data
  const getDisplayName = (game: Game) => {
    const customFields = game.customFields || {};

    // Debug log to see what's in customFields
    console.log("🔍 Game customFields:", customFields);
    console.log("🔍 Available column names:", Object.keys(customFields));

    // For imported games, try to find sport/opponent in custom fields first
    let sportName = game.homeTeam?.sport?.name || "General";
    let opponentName = game.opponent?.name || "TBD";

    // If we have custom fields, look for ANY field that contains relevant data
    if (Object.keys(customFields).length > 0) {
      // Try to find sport in any field
      const allFields = Object.keys(customFields);

      // Look for sport-related field with a much broader search
      const sportField = allFields.find((key) => {
        const lowerKey = key.toLowerCase();
        return (
          lowerKey.includes("sport") ||
          lowerKey.includes("team") ||
          lowerKey.includes("game") ||
          lowerKey.includes("activity") ||
          lowerKey.includes("event") ||
          // Check if the VALUE looks like a sport
          (customFields[key] &&
            String(customFields[key])
              .toLowerCase()
              .match(/basketball|football|soccer|tennis|baseball|softball|volleyball|golf|track|cross|swimming|wrestling|hockey/))
        );
      });

      if (sportField && customFields[sportField]) {
        sportName = String(customFields[sportField]);
        console.log("🏀 Found sport:", sportName, "in field:", sportField);
      }

      // Look for opponent-related field with broader search
      const opponentField = allFields.find((key) => {
        const lowerKey = key.toLowerCase();
        return (
          lowerKey.includes("opponent") ||
          lowerKey.includes("against") ||
          lowerKey.includes("vs") ||
          lowerKey.includes("versus") ||
          lowerKey.includes("away") ||
          lowerKey.includes("visitor") ||
          lowerKey.includes("visiting") ||
          lowerKey.includes("enemy") ||
          // Common school naming patterns
          (customFields[key] &&
            String(customFields[key])
              .toLowerCase()
              .match(/high|school|college|university|academy|\s+hs\s+/))
        );
      });

      if (opponentField && customFields[opponentField]) {
        opponentName = String(customFields[opponentField]);
        console.log("🏫 Found opponent:", opponentName, "in field:", opponentField);
      }

      // If we still don't have good data, let's check all non-date fields for potential sport/opponent data
      if (sportName === "General") {
        for (const [key, value] of Object.entries(customFields)) {
          if (value && typeof value === "string" && !key.toLowerCase().includes("date")) {
            const val = String(value).toLowerCase();
            // Check if this looks like a sport
            if (val.match(/basketball|football|soccer|tennis|baseball|softball|volleyball|golf|track|cross|swimming|wrestling|hockey|lacrosse/)) {
              sportName = String(value);
              console.log("🎯 Found sport by content:", sportName, "in field:", key);
              break;
            }
          }
        }
      }

      if (opponentName === "TBD") {
        for (const [key, value] of Object.entries(customFields)) {
          if (value && typeof value === "string" && !key.toLowerCase().includes("date") && !key.toLowerCase().includes("time")) {
            const val = String(value);
            // Check if this looks like a school/team name (has "High" or "School" or similar patterns)
            if (val.match(/high|school|college|university|academy/i) || val.match(/\b[A-Z][a-z]+\s+(High|HS|School)\b/)) {
              opponentName = val;
              console.log("🏫 Found opponent by content:", opponentName, "in field:", key);
              break;
            }
          }
        }
      }
    }

    const result = `${sportName} - ${opponentName}`;
    console.log("📋 Final display name:", result);
    return result;
  };

  // Get the first game for minimized view
  const firstGame = calendarWidgetState === "minimized" && groupedEvents.length > 0 ? groupedEvents[0].items[0] : null;

  return (
    <Box
      sx={{
        display: { xs: "none", md: "block" },
        minWidth: { md: 320 },
        maxWidth: { md: 360 },
        position: { md: "sticky" },
        top: { md: 96 },
        alignSelf: { md: "flex-start" },
      }}
    >
      <Card elevation={3} sx={{ borderRadius: 3 }}>
        <CardHeader
          avatar={<EventNoteIcon color="primary" />}
          title="Upcoming Games"
          subheader={calendarWidgetState === "minimized" ? "Next game" : "Next 3 upcoming games"}
          action={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Tooltip title={calendarTooltip}>
                <IconButton component="a" href={calendarHref} target="_blank" rel="noopener noreferrer" size="small" aria-label="Open Google Calendar">
                  <LaunchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <span>
                  <IconButton onClick={() => refetch()} size="small" disabled={isFetching} aria-label="Refresh">
                    {isFetching ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              {calendarWidgetState === "full" ? (
                <Tooltip title="Minimize">
                  <IconButton onClick={() => setCalendarWidgetState("minimized")} size="small" aria-label="Minimize calendar">
                    <MinimizeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Expand">
                  <IconButton onClick={() => setCalendarWidgetState("full")} size="small" aria-label="Expand calendar">
                    <ExpandMoreIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Hide calendar">
                <IconButton onClick={() => setCalendarWidgetState("hidden")} size="small" aria-label="Hide calendar">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          }
        />
        <CardContent sx={{ pt: 0 }}>
          {isLoading ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 2 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Loading upcoming games...
              </Typography>
            </Box>
          ) : isError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            >
              {errorMessage}
            </Alert>
          ) : groupedEvents.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                No upcoming games scheduled
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Synchronize your schedule or add games to see them here.
              </Typography>
            </Box>
          ) : calendarWidgetState === "minimized" && firstGame ? (
            <List disablePadding>
              <ListItem
                alignItems="flex-start"
                disableGutters
                secondaryAction={
                  firstGame.game.googleCalendarHtmlLink ? (
                    <Tooltip title="Open event in Google Calendar">
                      <IconButton
                        edge="end"
                        component="a"
                        href={firstGame.game.googleCalendarHtmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        aria-label="Open event in Google Calendar"
                      >
                        <LaunchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : undefined
                }
                sx={{ py: 1.5, px: 0 }}
              >
                <ListItemText
                  primary={
                    <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>
                      {getDisplayName(firstGame.game)}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                      <Typography variant="body2" color="text.secondary" component="span">
                        {formatGameTime(firstGame.startDate, getGameTime(firstGame.game))}
                      </Typography>
                      {firstGame.game.homeTeam.level && (
                        <Typography variant="body2" color="text.secondary" component="span">
                          Level:{" "}
                          <Typography component="span" color="text.primary">
                            {formatLevelDisplay(firstGame.game.homeTeam.level)}
                          </Typography>
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary" component="span">
                        Location:{" "}
                        <Typography component="span" color="text.primary">
                          {firstGame.game.isHome ? "Home" : firstGame.game.venue?.name || "TBD"}
                        </Typography>
                      </Typography>
                    </Box>
                  }
                  secondaryTypographyProps={{ component: "div" }}
                />
              </ListItem>
            </List>
          ) : (
            groupedEvents.map((group, groupIndex) => (
              <Box key={group.key} sx={{ pb: groupIndex < groupedEvents.length - 1 ? 2 : 0 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, mb: 1 }}>
                  {group.label}
                </Typography>
                <List disablePadding>
                  {group.items.map(({ game, startDate }, gameIndex) => (
                    <Fragment key={`${group.key}-${game.id}`}>
                      <ListItem
                        alignItems="flex-start"
                        disableGutters
                        secondaryAction={
                          game.googleCalendarHtmlLink ? (
                            <Tooltip title="Open event in Google Calendar">
                              <IconButton edge="end" component="a" href={game.googleCalendarHtmlLink} target="_blank" rel="noopener noreferrer" size="small" aria-label="Open event in Google Calendar">
                                <LaunchIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : undefined
                        }
                        sx={{ py: 1.5, px: 0 }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>
                              {getDisplayName(game)}{" "}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                              <Typography variant="body2" color="text.secondary" component="span">
                                {formatGameTime(startDate, getGameTime(game))}
                              </Typography>
                              {game.homeTeam.level && (
                                <Typography variant="body2" color="text.secondary" component="span">
                                  Level:{" "}
                                  <Typography component="span" color="text.primary">
                                    {formatLevelDisplay(game.homeTeam.level)}
                                  </Typography>
                                </Typography>
                              )}
                              <Typography variant="body2" color="text.secondary" component="span">
                                Location:{" "}
                                <Typography component="span" color="text.primary">
                                  {game.isHome ? "Home" : game.venue?.name || "TBD"}
                                </Typography>
                              </Typography>
                            </Box>
                          }
                          secondaryTypographyProps={{ component: "div" }}
                        />
                      </ListItem>
                      {gameIndex < group.items.length - 1 && <Divider component="li" sx={{ ml: 2 }} />}
                    </Fragment>
                  ))}
                </List>
                {groupIndex < groupedEvents.length - 1 && <Divider sx={{ my: 2 }} />}
              </Box>
            ))
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function groupGamesByDate(games: Game[]): GroupedEvents[] {
  const groupsMap = new Map<string, GroupedEvents>();

  for (const game of games) {
    const startDate = parseGameDate(game);

    if (!startDate) {
      continue;
    }

    const key = format(startDate, "yyyy-MM-dd");

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        label: formatDateLabel(startDate),
        date: startDate,
        items: [],
      });
    }

    const group = groupsMap.get(key)!;
    group.items.push({ game, startDate });
  }

  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const group of sortedGroups) {
    group.items.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  return sortedGroups;
}

function parseGameDate(game: Game): Date | null {
  if (!game.date) {
    return null;
  }

  try {
    const parsed = parseISO(game.date);
    if (!Number.isNaN(parsed.getTime())) {
      // Use the new getGameTime helper to find time from any source
      const gameTime = getGameTime(game);
      if (gameTime) {
        const [hours, minutes] = gameTime.split(":");
        parsed.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      } else {
        // If no time found, normalize time to noon (12:00 PM)
        parsed.setHours(12, 0, 0, 0);
      }
      return parsed;
    }
  } catch (error) {
    // Ignore parse error and fall back to Date constructor
  }

  const fallback = new Date(game.date);
  if (!Number.isNaN(fallback.getTime())) {
    // Use the new getGameTime helper to find time from any source
    const gameTime = getGameTime(game);
    if (gameTime) {
      const [hours, minutes] = gameTime.split(":");
      fallback.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    } else {
      // Normalize to noon (12:00 PM) for fallback date objects as well
      fallback.setHours(12, 0, 0, 0);
    }
    return fallback;
  }

  return null;
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) {
    return "Today";
  }

  if (isTomorrow(date)) {
    return "Tomorrow";
  }

  return format(date, "EEEE, MMM d");
}

function formatGameTime(date: Date, time: string | null): string {
  if (!time) {
    return "Time TBD";
  }

  return format(date, "h:mm a");
}
