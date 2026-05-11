"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import {
  ExpandMore,
  ContentCopy,
  OpenInNew,
  Apple,
  Google,
  CheckCircle,
  CalendarMonth,
  School,
  Sports,
  Info,
} from "@mui/icons-material";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

interface CalendarFeed {
  id: string;
  schoolId: string;
  schoolName: string;
  sportName: string;
  level: string;
  teamName: string;
  feedUrl: string;
  description: string;
}

// Fetch calendar feeds for the parent
const fetchCalendarFeeds = async (): Promise<{ calendars: CalendarFeed[] }> => {
  const res = await fetch("/api/parent/calendar-feeds");
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch calendar feeds");
  }
  return res.json();
};

function CalendarsPageContent() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<string | false>(false);
  
  const { data: feedsData, isLoading, error } = useQuery({
    queryKey: ["parentCalendarFeeds"],
    queryFn: fetchCalendarFeeds,
  });

  const calendars = feedsData?.calendars || [];

  const handleCopyLink = async (feed: CalendarFeed) => {
    try {
      await navigator.clipboard.writeText(feed.feedUrl);
      setCopiedId(feed.id);
      trackEvent("Calendar Feed Link Copied", {
        sport: feed.sportName,
        level: feed.level,
        schoolId: feed.schoolId,
      });
      
      // Reset after 2 seconds
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleOpenFeed = (feed: CalendarFeed) => {
    trackEvent("Calendar Feed Opened", {
      sport: feed.sportName,
      level: feed.level,
      schoolId: feed.schoolId,
    });
    window.open(feed.feedUrl, '_blank');
  };

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error">
          Failed to load calendar feeds. Please try again later.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Subscribe to Calendars
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Subscribe to your child&apos;s game schedules using your preferred calendar app
        </Typography>
      </Box>

      {calendars.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No calendars available yet. Connect with a school to see available calendars for subscription.
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mb: 3 }}>
          You have {calendars.length} calendar{calendars.length !== 1 ? 's' : ''} available for subscription.
        </Alert>
      )}

      {/* iPhone Instructions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Apple color="primary" />
            <Typography variant="h6">
              Add to iPhone Calendar (Automatic)
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The easiest way to subscribe - tap the Subscribe button on each calendar below.
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            Add to iPhone Calendar (Manual)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            If automatic subscription doesn&apos;t work, follow these steps:
          </Typography>
          
          <List dense disablePadding>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Typography variant="body2" color="text.secondary">1.</Typography>
              </ListItemIcon>
              <ListItemText primary="Copy the calendar link using the button below" />
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Typography variant="body2" color="text.secondary">2.</Typography>
              </ListItemIcon>
              <ListItemText primary="Open Settings on your iPhone" />
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Typography variant="body2" color="text.secondary">3.</Typography>
              </ListItemIcon>
              <ListItemText primary="Tap Accounts & Passwords" />
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Typography variant="body2" color="text.secondary">4.</Typography>
              </ListItemIcon>
              <ListItemText primary="Tap Other > Add Subscribed Calendar" />
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Typography variant="body2" color="text.secondary">5.</Typography>
              </ListItemIcon>
              <ListItemText primary="Paste the calendar link and tap Next" />
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Typography variant="body2" color="text.secondary">6.</Typography>
              </ListItemIcon>
              <ListItemText primary="Tap Save to complete the subscription" />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Google Calendar Instructions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Google color="primary" />
            <Typography variant="h6">
              Add to Google Calendar
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            1. Copy the calendar link using the button below<br />
            2. Go to <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2' }}>Google Calendar</a><br />
            3. Click the + icon next to &quot;Add calendars&quot; on the left sidebar<br />
            4. Select &quot;From URL&quot;<br />
            5. Paste the calendar link and click &quot;Add calendar&quot;
          </Typography>
        </CardContent>
      </Card>

      {/* Available Calendars */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Available Calendars
      </Typography>

      {calendars.map((calendar) => (
        <Accordion 
          key={calendar.id}
          expanded={expandedPanel === calendar.id}
          onChange={handleAccordionChange(calendar.id)}
          sx={{ mb: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, pr: 2 }}>
              <CalendarMonth color="primary" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {calendar.sportName} - {calendar.level}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {calendar.schoolName}
                </Typography>
              </Box>
              <Chip
                label="Subscribe"
                color="primary"
                size="small"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  handleOpenFeed(calendar);
                }}
                onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {calendar.description}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Calendar Link:
                </Typography>
                <Tooltip title={copiedId === calendar.id ? "Copied!" : "Copy link"}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleCopyLink(calendar)}
                    color={copiedId === calendar.id ? "success" : "default"}
                  >
                    {copiedId === calendar.id ? <CheckCircle fontSize="small" /> : <ContentCopy fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Open calendar feed">
                  <IconButton 
                    size="small" 
                    onClick={() => handleOpenFeed(calendar)}
                  >
                    <OpenInNew fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              
              <Box sx={{ 
                p: 1.5, 
                bgcolor: 'grey.100', 
                borderRadius: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
              }}>
                {calendar.feedUrl}
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export default function ParentCalendarsPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    }>
      <CalendarsPageContent />
    </Suspense>
  );
}
