"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Autocomplete,
  FormHelperText,
} from "@mui/material";
import { Add, Delete, Info, SyncLock, Warning } from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTheme as customTheme } from "@mui/material/styles";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

interface CalendarGroupMapping {
  id: string;
  columnName: string;
  columnValue: string;
  googleCalendarId: string;
  googleCalendarName: string;
  createdAt: string;
  updatedAt: string;
}

interface GoogleCalendar {
  id: string;
  name: string;
  description?: string;
  primary: boolean;
  backgroundColor?: string;
}

// Fetch calendar group mappings
const fetchCalendarGroupMappings = async (): Promise<{ mappings: CalendarGroupMapping[] }> => {
  const res = await fetch("/api/calendar/group-mappings");
  if (!res.ok) throw new Error("Failed to fetch calendar group mappings");
  return res.json();
};

// Fetch Google Calendars
const fetchGoogleCalendars = async (): Promise<{ calendars: GoogleCalendar[] }> => {
  const res = await fetch("/api/calendar/list-calendars");
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch Google Calendars");
  }
  return res.json();
};

// Fetch imported column names from user's spreadsheet
const fetchImportedColumns = async (): Promise<{ data: string[] }> => {
  const res = await fetch("/api/user/imported-columns");
  if (!res.ok) throw new Error("Failed to fetch imported columns");
  return res.json();
};

export function CalendarGroupMappings() {
  const { addNotification } = useNotifications();
  const theme = customTheme();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [newMapping, setNewMapping] = useState({
    columnName: "",
    columnValue: "",
    googleCalendarId: "",
    googleCalendarName: "",
  });

  // Fetch mappings
  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ["calendarGroupMappings"],
    queryFn: fetchCalendarGroupMappings,
  });

  // Fetch Google Calendars
  const {
    data: calendarsData,
    isLoading: calendarsLoading,
    error: calendarsError,
  } = useQuery({
    queryKey: ["googleCalendars"],
    queryFn: fetchGoogleCalendars,
    retry: false, // Don't retry on auth errors
  });

  // Fetch imported column names
  const { data: importedColumnsData, isLoading: importedColumnsLoading } = useQuery({
    queryKey: ["importedColumns"],
    queryFn: fetchImportedColumns,
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (mapping: Omit<CalendarGroupMapping, "id" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/calendar/group-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapping),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create mapping");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarGroupMappings"] });
      addNotification("Calendar group mapping created successfully", "success");
      setDialogOpen(false);
      setNewMapping({
        columnName: "",
        columnValue: "",
        googleCalendarId: "",
        googleCalendarName: "",
      });
    },
    onError: (error: Error) => {
      addNotification(error.message || "Failed to create mapping", "error");
    },
  });

  // Delete mapping mutation
  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/calendar/group-mappings?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to delete mapping");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarGroupMappings"] });
      addNotification("Calendar group mapping deleted successfully", "success");
    },
    onError: (error: Error) => {
      addNotification(error.message || "Failed to delete mapping", "error");
    },
  });

  const handleAddMapping = () => {
    if (!newMapping.columnName?.trim() || !newMapping.columnValue?.trim() || !newMapping.googleCalendarId?.trim() || !newMapping.googleCalendarName?.trim()) {
      addNotification("Please fill in all fields", "warning");
      return;
    }
    
    trackEvent("Calendar Mapping Created", {
      source: "calendar_sync_page",
      action: "create_calendar_mapping",
      column_name: newMapping.columnName,
      calendar_name: newMapping.googleCalendarName,
    });

    createMappingMutation.mutate({
      ...newMapping,
      columnName: newMapping.columnName.trim(),
      columnValue: newMapping.columnValue.trim(),
      googleCalendarId: newMapping.googleCalendarId.trim(),
      googleCalendarName: newMapping.googleCalendarName.trim(),
    });
  };

  const handleCalendarSelect = (calendarId: string) => {
    const selectedCalendar = calendarsData?.calendars.find((cal) => cal.id === calendarId);
    setNewMapping({
      ...newMapping,
      googleCalendarId: calendarId,
      googleCalendarName: selectedCalendar?.name || "",
    });
  };

  const handleDeleteMapping = (id: string) => {
    if (window.confirm("Are you sure you want to delete this mapping?")) {
      deleteMappingMutation.mutate(id);
    }
  };

  // Handle reconnection when scopes are insufficient
  const handleReconnect = async () => {
    try {
      setIsReconnecting(true);

      // Step 1: Disconnect to clear old tokens
      const disconnectRes = await fetch("/api/user/calendar-disconnect", {
        method: "POST",
      });

      if (!disconnectRes.ok) {
        throw new Error("Failed to disconnect calendar");
      }

      addNotification("Redirecting to Google to update permissions...", "info");

      // Step 2: Redirect to reconnect with new scopes
      setTimeout(() => {
        window.location.href = "/api/auth/calendar-connect";
      }, 500);
    } catch (error) {
      console.error("Reconnection error:", error);
      addNotification("Failed to reconnect calendar. Please try again.", "error");
      setIsReconnecting(false);
    }
  };

  // Check for scope errors
  const hasInsufficientScopes =
    calendarsError instanceof Error &&
    (calendarsError.message.includes("Insufficient permissions") || calendarsError.message.includes("insufficient authentication scopes") || calendarsError.message.includes("reconnect"));

  const importedColumns = importedColumnsData?.data || [];

  if (mappingsLoading || calendarsLoading || importedColumnsLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      {/* Scope Error Banner */}
      {hasInsufficientScopes && (
        <Alert
          severity="warning"
          icon={<Warning />}
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleReconnect} disabled={isReconnecting} sx={{ textTransform: "none" }}>
              {isReconnecting ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
              {isReconnecting ? "Reconnecting..." : "Reconnect Now"}
            </Button>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Calendar Permissions Update Required
          </Typography>
          <Typography variant="body2">Your Google Calendar connection needs additional permissions to list calendars. Please reconnect to grant access.</Typography>
          {/* <Typography variant="caption" sx={{ mt: 1, display: 'block', fontStyle: 'italic', opacity: 0.8 }}>
            Read-only access is used only to list calendars so we know where to sync events.
          </Typography> */}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h6">Calendar Group Mappings</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Map your game columns to specific Google Calendar groups for organized scheduling
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            trackEvent("Calendar Mapping Add Clicked", {
              source: "calendar_sync_page",
              action: "open_add_mapping_dialog",
            });
            setDialogOpen(true);
          }}
          disabled={hasInsufficientScopes || calendarsLoading || calendarsError !== null}
          sx={{ textTransform: "none", color: theme.palette.themeButtonText.main }}
        >
          Add Mapping
        </Button>
      </Box>

      {/* Show loading state for calendars */}
      {calendarsLoading && (
        <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 2 }}>
          Loading your Google Calendars...
        </Alert>
      )}

      {/* Info banner (only show if no scope error) */}
      {!hasInsufficientScopes && !calendarsError && (
        <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>How it works:</strong> When syncing a game to Google Calendar, the system will check the column value (e.g., "Junior Varsity Basketball") and sync to the corresponding Google
            Calendar group if a mapping exists. Otherwise, it will sync to your primary calendar.
          </Typography>
        </Alert>
      )}

      {mappingsData?.mappings && mappingsData.mappings.length > 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Column Name</TableCell>
                <TableCell>Column Value</TableCell>
                <TableCell>Google Calendar</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mappingsData.mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    <Chip label={mapping.columnName} size="small" />
                  </TableCell>
                  <TableCell>{mapping.columnValue}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <SyncLock
                        sx={{
                          fontSize: 18,
                          color: "success.main",
                        }}
                      />
                      {mapping.googleCalendarName}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete mapping">
                      <IconButton size="small" onClick={() => handleDeleteMapping(mapping.id)} disabled={deleteMappingMutation.isPending}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No calendar group mappings configured yet. Click "Add Mapping" to get started.
          </Typography>
        </Paper>
      )}

      {/* Add Mapping Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Calendar Group Mapping</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Autocomplete
              freeSolo
              options={importedColumns}
              value={newMapping.columnName}
              onChange={(event, newValue) => {
                setNewMapping({ ...newMapping, columnName: newValue || "" });
              }}
              onInputChange={(event, newInputValue) => {
                setNewMapping({ ...newMapping, columnName: newInputValue });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Column Name"
                  placeholder="Enter or select column name"
                  helperText={importedColumns.length > 0 ? "Select from your imported columns or type a custom name" : "Type the column name from your games table"}
                  fullWidth
                  disabled={hasInsufficientScopes}
                />
              )}
            />

            <TextField
              label="Column Value"
              placeholder="e.g., Junior Varsity Basketball, JV Football"
              value={newMapping.columnValue}
              onChange={(e) => setNewMapping({ ...newMapping, columnValue: e.target.value })}
              fullWidth
              helperText="Enter the exact value from your games table column"
              disabled={hasInsufficientScopes}
            />

            <FormControl fullWidth error={!!calendarsError && !hasInsufficientScopes}>
              <InputLabel>Google Calendar</InputLabel>
              <Select
                value={newMapping.googleCalendarId}
                label="Google Calendar"
                onChange={(e) => handleCalendarSelect(e.target.value)}
                disabled={hasInsufficientScopes || calendarsLoading || (calendarsError !== null && !hasInsufficientScopes)}
              >
                {calendarsData?.calendars && calendarsData.calendars.length > 0 ? (
                  calendarsData.calendars.map((calendar) => (
                    <MenuItem key={calendar.id} value={calendar.id}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                        <SyncLock sx={{ fontSize: 18, color: "success.main" }} />
                        {calendar.name}
                        {calendar.primary && <Chip label="Primary" size="small" sx={{ ml: "auto" }} />}
                      </Box>
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>{hasInsufficientScopes ? "Please reconnect your calendar first" : calendarsError ? "Error loading calendars" : "No calendars found"}</MenuItem>
                )}
              </Select>
              {calendarsError && !hasInsufficientScopes && <FormHelperText>Error loading calendars. Try reconnecting your Google Calendar.</FormHelperText>}
            </FormControl>

            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">
                <strong>Example:</strong> If your games table has a column with values like "Junior Varsity Basketball", enter the column name (e.g., "Sports Level" or "Team") and the exact value. All
                games matching that column value will sync to the selected Google Calendar.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button onClick={handleAddMapping} variant="contained" disabled={createMappingMutation.isPending || hasInsufficientScopes} sx={{ textTransform: "none" }}>
            {createMappingMutation.isPending ? <CircularProgress size={20} /> : "Add Mapping"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
