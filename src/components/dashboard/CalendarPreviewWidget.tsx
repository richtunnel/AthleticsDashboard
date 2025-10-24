"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, CardHeader, CircularProgress, Divider, IconButton, List, ListItem, ListItemText, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import LaunchIcon from "@mui/icons-material/Launch";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { format, isToday, isTomorrow, parseISO } from "date-fns";

import { getUpcomingCalendarEvents } from "@/app/actions/calendar";
import type { UpcomingCalendarEvent } from "@/lib/services/calendar.service";

const REFRESH_INTERVAL_MS = 1000 * 60 * 5;

interface GroupedEvents {
  key: string;
  label: string;
  date: Date;
  items: Array<{ event: UpcomingCalendarEvent; startDate: Date }>;
}

export function CalendarPreviewWidget() {
  const { data: session } = useSession();

  const calendarAccountEmail = session?.user?.googleCalendarEmail || session?.user?.email || null;
  const calendarHref = calendarAccountEmail ? `https://calendar.google.com/calendar/u/0/r?account=${encodeURIComponent(calendarAccountEmail)}` : "https://calendar.google.com/calendar/u/0/r";
  const calendarTooltip = calendarAccountEmail ? `Open Google Calendar for ${calendarAccountEmail}` : "Open Google Calendar";

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-upcoming-calendar-events"],
    queryFn: async () => {
      const response = await getUpcomingCalendarEvents();
      if (!response.success) {
        throw new Error(response.error || "Failed to load events");
      }
      return response.events;
    },
    staleTime: 1000 * 60 * 1,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const events = data ?? [];

  const groupedEvents = useMemo(() => groupEventsByDate(events), [events]);

  const errorMessage = error instanceof Error ? error.message : "Failed to load calendar events.";
  const isConnectionError = /not connected/i.test(errorMessage);
  const displayErrorMessage = isConnectionError ? "Connect your Google account to preview upcoming games." : errorMessage;

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
          subheader="Next 3 days from Google Calendar"
          action={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                isConnectionError ? (
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button component={Link} href="/dashboard/gsync" color="inherit" size="small">
                      Connect Calendar
                    </Button>
                    <Button color="inherit" size="small" onClick={() => refetch()}>
                      Retry
                    </Button>
                  </Box>
                ) : (
                  <Button color="inherit" size="small" onClick={() => refetch()}>
                    Retry
                  </Button>
                )
              }
            >
              {displayErrorMessage}
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
          ) : (
            groupedEvents.map((group, groupIndex) => (
              <Box key={group.key} sx={{ pb: groupIndex < groupedEvents.length - 1 ? 2 : 0 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, mb: 1 }}>
                  {group.label}
                </Typography>
                <List disablePadding>
                  {group.items.map(({ event, startDate }, eventIndex) => (
                    <Fragment key={`${group.key}-${event.id}`}>
                      <ListItem
                        alignItems="flex-start"
                        disableGutters
                        secondaryAction={
                          event.htmlLink ? (
                            <Tooltip title="Open event in Google Calendar">
                              <IconButton edge="end" component="a" href={event.htmlLink} target="_blank" rel="noopener noreferrer" size="small" aria-label="Open event in Google Calendar">
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
                              {event.summary}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                              <Typography variant="body2" color="text.secondary">
                                {formatEventTime(startDate, event.isAllDay)}
                              </Typography>
                              {event.opponent && (
                                <Typography variant="body2" color="text.secondary">
                                  Opponent:{" "}
                                  <Typography component="span" color="text.primary">
                                    {event.opponent}
                                  </Typography>
                                </Typography>
                              )}
                              {event.location && (
                                <Typography variant="body2" color="text.secondary">
                                  Location:{" "}
                                  <Typography component="span" color="text.primary">
                                    {event.location}
                                  </Typography>
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {eventIndex < group.items.length - 1 && <Divider component="li" sx={{ ml: 2 }} />}
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

function groupEventsByDate(events: UpcomingCalendarEvent[]): GroupedEvents[] {
  const groupsMap = new Map<string, GroupedEvents>();

  for (const event of events) {
    const startDate = parseEventStart(event);

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
    group.items.push({ event, startDate });
  }

  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const group of sortedGroups) {
    group.items.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  return sortedGroups;
}

function parseEventStart(event: UpcomingCalendarEvent): Date | null {
  if (!event.start) {
    return null;
  }

  try {
    const parsed = parseISO(event.start);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (error) {
    // Ignore parse error and fall back to Date constructor
  }

  const fallback = new Date(event.start);
  if (!Number.isNaN(fallback.getTime())) {
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

function formatEventTime(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return "All day";
  }

  return format(date, "h:mm a");
}
