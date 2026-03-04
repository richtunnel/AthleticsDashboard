"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import { Add, Delete, Link as LinkIcon, LinkOff } from "@mui/icons-material";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

interface CalendarGroupMapping {
  id: string;
  columnName: string;
  columnValue: string;
  googleCalendarId: string;
  googleCalendarName: string;
}

interface GoogleCalendar {
  id: string;
  name: string;
  description?: string;
  primary: boolean;
}

// Fetch calendar connection status
const fetchCalendarStatus = async () => {
  const res = await fetch("/api/user/calendar-status");
  if (!res.ok) throw new Error("Failed to fetch calendar status");
  return res.json();
};

// Fetch Google Calendars
const fetchGoogleCalendars = async () => {
  const res = await fetch("/api/calendar/list-calendars");
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch calendars");
  }
  return res.json();
};

// Fetch calendar group mappings
const fetchCalendarGroupMappings = async () => {
  const res = await fetch("/api/parent/calendar-mappings");
  if (!res.ok) throw new Error("Failed to fetch mappings");
  return res.json();
};

function CalendarConnectionHandler({ refetch }: { refetch: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("calendar_connected") === "true" || searchParams.get("calendar") === "connected") {
      setConnectionMessage("Google Calendar connected successfully!");
      refetch();
      router.replace("/parent-dashboard/calendars");
    }
  }, [searchParams, router, refetch]);

  if (!connectionMessage) return null;

  return (
    <Alert severity="success" sx={{ mb: 2 }}>
      {connectionMessage}
    </Alert>
  );
}

function CalendarsPageContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["calendarConnectionStatus"],
    queryFn: fetchCalendarStatus,
  });

  const { data: calendarsData, isLoading: calendarsLoading, error: calendarsError } = useQuery({
    queryKey: ["googleCalendars"],
    queryFn: fetchGoogleCalendars,
    enabled: !!statusData?.isConnected,
  });

  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ["parentCalendarMappings"],
    queryFn: fetchCalendarGroupMappings,
  });

  const isConnected = statusData?.isConnected;
  const calendars = calendarsData?.calendars || [];
  const mappings = mappingsData?.mappings || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({
    columnName: "",
    columnValue: "",
    googleCalendarId: "",
    googleCalendarName: "",
  });

  const handleConnect = () => {
    trackEvent("Calendar Connect Clicked", {
      source: "parent_dashboard_calendars",
    });
    router.push("/api/auth/calendar-connect?returnTo=/parent-dashboard/calendars");
  };

  const handleDisconnect = async () => {
    if (window.confirm("Are you sure you want to disconnect your Google Calendar?")) {
      try {
        await fetch("/api/auth/google-calendar/disconnect", { method: "POST" });
        refetchStatus();
      } catch (error) {
        console.error("Failed to disconnect:", error);
      }
    }
  };

  const handleCreateMapping = async () => {
    if (!newMapping.columnName || !newMapping.googleCalendarId) return;

    try {
      const res = await fetch("/api/parent/calendar-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMapping),
      });

      if (res.ok) {
        setDialogOpen(false);
        setNewMapping({ columnName: "", columnValue: "", googleCalendarId: "", googleCalendarName: "" });
        queryClient.invalidateQueries({ queryKey: ["parentCalendarMappings"] });
      }
    } catch (error) {
      console.error("Failed to create mapping:", error);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!window.confirm("Are you sure you want to delete this mapping?")) return;

    try {
      const res = await fetch(`/api/parent/calendar-mappings?id=${mappingId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["parentCalendarMappings"] });
      }
    } catch (error) {
      console.error("Failed to delete mapping:", error);
    }
  };

  if (statusLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Calendars
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Connect your Google Calendar to sync game schedules
        </Typography>
      </Box>

      <CalendarConnectionHandler refetch={refetchStatus} />

      {/* Connection Card */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Google Calendar Connection
          </Typography>
          
          {isConnected ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Your Google Calendar is connected
              </Alert>
              <Button
                variant="outlined"
                color="error"
                startIcon={<LinkOff />}
                onClick={handleDisconnect}
              >
                Disconnect Calendar
              </Button>
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Connect your Google Calendar to automatically sync game schedules and get updates.
              </Typography>
              <Button
                variant="contained"
                startIcon={<LinkIcon />}
                onClick={handleConnect}
              >
                Connect Google Calendar
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Calendar Group Mappings */}
      {isConnected && (
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6">
                Calendar Mappings
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setDialogOpen(true)}
              >
                Add Mapping
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Map sport levels to specific Google Calendars for better organization
            </Typography>

            {mappingsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : mappings.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Sport</TableCell>
                      <TableCell>Level</TableCell>
                      <TableCell>Google Calendar</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mappings.map((mapping: CalendarGroupMapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>{mapping.columnName}</TableCell>
                        <TableCell>
                          <Chip label={mapping.columnValue} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{mapping.googleCalendarName}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleDeleteMapping(mapping.id)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                No calendar mappings yet. Add a mapping to organize your calendars by sport level.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Mapping Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Calendar Mapping</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Google Calendar</InputLabel>
              <Select
                value={newMapping.googleCalendarId}
                label="Google Calendar"
                onChange={(e) => {
                  const cal = calendars.find((c: GoogleCalendar) => c.id === e.target.value);
                  setNewMapping({
                    ...newMapping,
                    googleCalendarId: e.target.value,
                    googleCalendarName: cal?.name || "",
                  });
                }}
              >
                {calendars.map((cal: GoogleCalendar) => (
                  <MenuItem key={cal.id} value={cal.id}>
                    {cal.name} {cal.primary ? "(Primary)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Sport"
              value={newMapping.columnName}
              onChange={(e) => setNewMapping({ ...newMapping, columnName: e.target.value })}
              placeholder="e.g., Soccer"
            />
            
            <TextField
              fullWidth
              label="Level"
              value={newMapping.columnValue}
              onChange={(e) => setNewMapping({ ...newMapping, columnValue: e.target.value })}
              placeholder="e.g., Junior Varsity"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateMapping}
            disabled={!newMapping.googleCalendarId || !newMapping.columnName}
          >
            Add Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function ParentCalendarsPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    }>
      <CalendarsPageContent />
    </Suspense>
  );
}
