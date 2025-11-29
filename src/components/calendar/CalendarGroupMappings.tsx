"use client";

import { useState, useEffect } from "react";
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
} from "@mui/material";
import { Add, Delete, Info } from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";

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
  if (!res.ok) throw new Error("Failed to fetch Google Calendars");
  return res.json();
};

// Common column names that users might use for sports level
const COMMON_COLUMN_NAMES = [
  "Sports Level",
  "Team Level",
  "Level",
  "Team",
  "Sport",
  "Sport & Level",
  "Custom Column",
];

export function CalendarGroupMappings() {
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const { data: calendarsData, isLoading: calendarsLoading } = useQuery({
    queryKey: ["googleCalendars"],
    queryFn: fetchGoogleCalendars,
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
      if (!res.ok) throw new Error("Failed to delete mapping");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarGroupMappings"] });
      addNotification("Calendar group mapping deleted successfully", "success");
    },
    onError: () => {
      addNotification("Failed to delete mapping", "error");
    },
  });

  const handleAddMapping = () => {
    if (!newMapping.columnName || !newMapping.columnValue || !newMapping.googleCalendarId) {
      addNotification("Please fill in all fields", "warning");
      return;
    }
    createMappingMutation.mutate(newMapping);
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

  if (mappingsLoading || calendarsLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
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
          onClick={() => setDialogOpen(true)}
          sx={{ textTransform: "none" }}
        >
          Add Mapping
        </Button>
      </Box>

      <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>How it works:</strong> When syncing a game to Google Calendar, the system will check the column value 
          (e.g., "Junior Varsity Basketball") and sync to the corresponding Google Calendar group if a mapping exists. 
          Otherwise, it will sync to your primary calendar.
        </Typography>
      </Alert>

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
                      {mapping.googleCalendarName}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete mapping">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteMapping(mapping.id)}
                        disabled={deleteMappingMutation.isPending}
                      >
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
            <FormControl fullWidth>
              <InputLabel>Column Name</InputLabel>
              <Select
                value={newMapping.columnName}
                label="Column Name"
                onChange={(e) => setNewMapping({ ...newMapping, columnName: e.target.value })}
              >
                {COMMON_COLUMN_NAMES.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Column Value"
              placeholder="e.g., Junior Varsity Basketball, JV Football"
              value={newMapping.columnValue}
              onChange={(e) => setNewMapping({ ...newMapping, columnValue: e.target.value })}
              fullWidth
              helperText="Enter the exact value from your games table column"
            />

            <FormControl fullWidth>
              <InputLabel>Google Calendar</InputLabel>
              <Select
                value={newMapping.googleCalendarId}
                label="Google Calendar"
                onChange={(e) => handleCalendarSelect(e.target.value)}
              >
                {calendarsData?.calendars.map((calendar) => (
                  <MenuItem key={calendar.id} value={calendar.id}>
                    {calendar.name}
                    {calendar.primary && (
                      <Chip label="Primary" size="small" sx={{ ml: 1 }} />
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">
                Example: If your games table has a "Sports Level" column with value "Junior Varsity Basketball", 
                and you map it to a Google Calendar named "JV Basketball", all games with that value will sync to 
                that specific calendar.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMapping}
            variant="contained"
            disabled={createMappingMutation.isPending}
            sx={{ textTransform: "none" }}
          >
            {createMappingMutation.isPending ? <CircularProgress size={20} /> : "Add Mapping"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
