"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
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
  FormControl,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Autocomplete,
  TextField,
  FormHelperText,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  Info,
  SyncLock,
  Warning,
} from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTheme as customTheme } from "@mui/material/styles";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

// ── Types ────────────────────────────────────────────────────────────────────

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

interface Workbook {
  id: string;
  name: string;
  sortOrder: number;
  _count?: { games: number };
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

const fetchCalendarGroupMappings = async (): Promise<{
  mappings: CalendarGroupMapping[];
}> => {
  const res = await fetch("/api/calendar/group-mappings");
  if (!res.ok) throw new Error("Failed to fetch calendar group mappings");
  return res.json();
};

const fetchGoogleCalendars = async (): Promise<{
  calendars: GoogleCalendar[];
}> => {
  const res = await fetch("/api/calendar/list-calendars");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch Google Calendars");
  }
  return res.json();
};

const fetchWorkbooks = async (): Promise<Workbook[]> => {
  const res = await fetch("/api/games-workbooks");
  if (!res.ok) throw new Error("Failed to fetch workbooks");
  const json = await res.json();
  return (Array.isArray(json) ? json : json?.data) ?? [];
};

// ── Props ────────────────────────────────────────────────────────────────────

interface CalendarGroupMappingsProps {
  /** Override the connected-account email shown in the header. */
  connectedEmailOverride?: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CalendarGroupMappings({
  connectedEmailOverride,
}: CalendarGroupMappingsProps = {}) {
  const { addNotification } = useNotifications();
  const theme = customTheme();
  const { data: session } = useSession();
  const connectedEmail =
    connectedEmailOverride !== undefined
      ? connectedEmailOverride
      : (session?.user as any)?.googleCalendarEmail || null;
  const queryClient = useQueryClient();
  const { disconnect: disconnectCalendar, connect: connectCalendar } =
    useGoogleCalendarConnection();

  // ── Dialog open / close ───────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const EMPTY_MAPPING = {
    columnName: "",
    columnValue: "",
    googleCalendarId: "",
    googleCalendarName: "",
  };
  const [newMapping, setNewMapping] = useState(EMPTY_MAPPING);

  // ── Worksheet selection ───────────────────────────────────────────────────
  const [selectedWorkbookId, setSelectedWorkbookId] = useState<string>("");
  const [editingWorkbook, setEditingWorkbook] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ["calendarGroupMappings"],
    queryFn: fetchCalendarGroupMappings,
  });

  const {
    data: calendarsData,
    isLoading: calendarsLoading,
    error: calendarsError,
  } = useQuery({
    queryKey: ["googleCalendars"],
    queryFn: fetchGoogleCalendars,
    retry: false,
  });

  // Workbooks — fetched eagerly so they're ready when the dialog opens
  const { data: workbooks = [] } = useQuery({
    queryKey: ["gamesWorkbooks", "mapping-picker"],
    queryFn: fetchWorkbooks,
    staleTime: 60_000,
  });

  // Column names for the selected workbook
  const { data: columnsData, isLoading: columnsLoading } = useQuery({
    queryKey: ["workbookColumns", selectedWorkbookId],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/workbook-columns?workbookId=${encodeURIComponent(selectedWorkbookId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch columns");
      return res.json() as Promise<{ columns: string[] }>;
    },
    enabled: dialogOpen && !!selectedWorkbookId,
    staleTime: 30_000,
  });

  // Unique values for the selected column
  const { data: valuesData, isLoading: valuesLoading } = useQuery({
    queryKey: ["workbookColumnValues", selectedWorkbookId, newMapping.columnName],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/workbook-columns?workbookId=${encodeURIComponent(
          selectedWorkbookId
        )}&columnName=${encodeURIComponent(newMapping.columnName)}`
      );
      if (!res.ok) throw new Error("Failed to fetch values");
      return res.json() as Promise<{ values: string[] }>;
    },
    enabled: dialogOpen && !!selectedWorkbookId && !!newMapping.columnName,
    staleTime: 30_000,
  });

  // Auto-select the first workbook when they load
  useEffect(() => {
    if (workbooks.length > 0 && !selectedWorkbookId) {
      setSelectedWorkbookId(workbooks[0].id);
    }
  }, [workbooks, selectedWorkbookId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMappingMutation = useMutation({
    mutationFn: async (
      mapping: Omit<CalendarGroupMapping, "id" | "createdAt" | "updatedAt">
    ) => {
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
      handleDialogClose();
    },
    onError: (error: Error) => {
      addNotification(error.message || "Failed to create mapping", "error");
    },
  });

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenDialog = () => {
    if (!selectedWorkbookId && workbooks.length > 0) {
      setSelectedWorkbookId(workbooks[0].id);
    }
    trackEvent("Calendar Mapping Add Clicked", {
      source: "calendar_sync_page",
      action: "open_add_mapping_dialog",
    });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingWorkbook(false);
    setNewMapping(EMPTY_MAPPING);
    // Keep selectedWorkbookId so the next open remembers the last choice
  };

  const handleWorkbookChange = (wb: Workbook | null) => {
    if (!wb) return;
    setSelectedWorkbookId(wb.id);
    setEditingWorkbook(false);
    // Clear column selections — they're specific to the workbook
    setNewMapping((prev) => ({ ...prev, columnName: "", columnValue: "" }));
  };

  const handleColumnNameChange = (value: string | null) => {
    setNewMapping((prev) => ({
      ...prev,
      columnName: value ?? "",
      columnValue: "", // reset value when column changes
    }));
  };

  const handleAddMapping = () => {
    if (
      !newMapping.columnName?.trim() ||
      !newMapping.columnValue?.trim() ||
      !newMapping.googleCalendarId?.trim() ||
      !newMapping.googleCalendarName?.trim()
    ) {
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
      columnName: newMapping.columnName.trim(),
      columnValue: newMapping.columnValue.trim(),
      googleCalendarId: newMapping.googleCalendarId.trim(),
      googleCalendarName: newMapping.googleCalendarName.trim(),
    });
  };

  const handleDeleteMapping = (id: string) => {
    if (window.confirm("Are you sure you want to delete this mapping?")) {
      deleteMappingMutation.mutate(id);
    }
  };

  const handleReconnect = async () => {
    try {
      setIsReconnecting(true);
      addNotification(
        "Redirecting to Google to update permissions...",
        "info"
      );
      await disconnectCalendar();
      await connectCalendar(window.location.pathname);
    } catch (error) {
      console.error("Reconnection error:", error);
      addNotification(
        "Failed to reconnect calendar. Please try again.",
        "error"
      );
      setIsReconnecting(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasInsufficientScopes =
    calendarsError instanceof Error &&
    (calendarsError.message.includes("Insufficient permissions") ||
      calendarsError.message.includes(
        "insufficient authentication scopes"
      ) ||
      calendarsError.message.includes("reconnect"));

  const selectedWorkbook = workbooks.find((w) => w.id === selectedWorkbookId);
  const columnNames = columnsData?.columns ?? [];
  const columnValues = valuesData?.values ?? [];
  const selectedCalendar =
    calendarsData?.calendars.find(
      (c) => c.id === newMapping.googleCalendarId
    ) ?? null;

  const canSubmit =
    !!newMapping.columnName.trim() &&
    !!newMapping.columnValue.trim() &&
    !!newMapping.googleCalendarId;

  // ── Render ────────────────────────────────────────────────────────────────

  if (mappingsLoading || calendarsLoading) {
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
            <Button
              color="inherit"
              size="small"
              onClick={handleReconnect}
              disabled={isReconnecting}
              sx={{ textTransform: "none" }}
            >
              {isReconnecting && (
                <CircularProgress
                  size={16}
                  color="inherit"
                  sx={{ mr: 1 }}
                />
              )}
              {isReconnecting ? "Reconnecting..." : "Reconnect Now"}
            </Button>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Calendar Permissions Update Required
          </Typography>
          <Typography variant="body2">
            Your Google Calendar connection needs additional permissions to
            list calendars. Please reconnect to grant access.
          </Typography>
        </Alert>
      )}

      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6">Calendar Group Mappings</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Map your game columns to specific Google Calendar groups for
            organized scheduling
          </Typography>
          {connectedEmail && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ mt: 0.5, display: "block" }}
            >
              Connected as: {connectedEmail}
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenDialog}
          disabled={
            hasInsufficientScopes ||
            calendarsLoading ||
            calendarsError !== null
          }
          sx={{
            textTransform: "none",
            color: theme.palette.themeButtonText.main,
          }}
        >
          Add Mapping
        </Button>
      </Box>

      {/* Info banner */}
      {!hasInsufficientScopes && !calendarsError && (
        <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>How it works:</strong> When syncing a game to your
            Google Calendar, the system checks your spreadsheet column
            values and routes games to the matching calendar group. Games
            with no matching mapping fall back to your primary calendar.
          </Typography>
        </Alert>
      )}

      {/* Mappings table */}
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
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <SyncLock sx={{ fontSize: 18, color: "success.main" }} />
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
            No calendar group mappings configured yet. Click &quot;Add
            Mapping&quot; to get started.
          </Typography>
        </Paper>
      )}

      {/* ── Add Mapping Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Calendar Group Mapping</DialogTitle>

        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>

            {/* ── Worksheet selector ──────────────────────────────────────── */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "action.hover",
                minHeight: 44,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ flexShrink: 0, fontWeight: 600, mr: 0.5 }}
              >
                Worksheet:
              </Typography>

              {editingWorkbook ? (
                <Autocomplete<Workbook>
                  options={workbooks}
                  getOptionLabel={(w) =>
                    w._count?.games !== undefined
                      ? `${w.name}  (${w._count.games} games)`
                      : w.name
                  }
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={selectedWorkbook ?? null}
                  onChange={(_, wb) => handleWorkbookChange(wb)}
                  autoFocus
                  openOnFocus
                  size="small"
                  sx={{ flex: 1 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search worksheets…"
                      variant="outlined"
                      size="small"
                    />
                  )}
                  noOptionsText="No worksheets found"
                  onBlur={() => setEditingWorkbook(false)}
                />
              ) : (
                <>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ flex: 1 }}
                  >
                    {selectedWorkbook?.name ?? (
                      <em style={{ fontWeight: 400, opacity: 0.6 }}>
                        No worksheet selected
                      </em>
                    )}
                    {selectedWorkbook?._count?.games !== undefined && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.75 }}
                      >
                        ({selectedWorkbook._count.games} games)
                      </Typography>
                    )}
                  </Typography>
                  <Tooltip title="Change worksheet">
                    <IconButton
                      size="small"
                      onClick={() => setEditingWorkbook(true)}
                      sx={{ flexShrink: 0 }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>

            {/* ── Column Name ─────────────────────────────────────────────── */}
            <Autocomplete
              options={columnNames}
              value={newMapping.columnName || null}
              onChange={(_, v) => handleColumnNameChange(v)}
              loading={columnsLoading}
              disabled={hasInsufficientScopes || !selectedWorkbookId}
              noOptionsText={
                !selectedWorkbookId
                  ? "Select a worksheet first"
                  : columnsLoading
                  ? "Loading columns…"
                  : "No columns found in this worksheet"
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Column Name"
                  placeholder="Search columns…"
                  helperText={
                    columnNames.length > 0
                      ? `${columnNames.length} column${columnNames.length !== 1 ? "s" : ""} found in this worksheet`
                      : "Select a worksheet to see its columns"
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {columnsLoading && (
                          <CircularProgress color="inherit" size={16} />
                        )}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            {/* ── Column Value ─────────────────────────────────────────────── */}
            <Autocomplete
              options={columnValues}
              value={newMapping.columnValue || null}
              onChange={(_, v) =>
                setNewMapping((prev) => ({ ...prev, columnValue: v ?? "" }))
              }
              loading={valuesLoading}
              disabled={
                hasInsufficientScopes ||
                !newMapping.columnName ||
                !selectedWorkbookId
              }
              noOptionsText={
                !newMapping.columnName
                  ? "Select a column first"
                  : valuesLoading
                  ? "Loading values…"
                  : "No values found for this column"
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Column Value"
                  placeholder="Search values…"
                  helperText={
                    !newMapping.columnName
                      ? "Select a column above to see its values"
                      : columnValues.length > 0
                      ? `${columnValues.length} unique value${columnValues.length !== 1 ? "s" : ""} in this column`
                      : "No values found"
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {valuesLoading && (
                          <CircularProgress color="inherit" size={16} />
                        )}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            {/* ── Google Calendar ──────────────────────────────────────────── */}
            <FormControl
              fullWidth
              error={!!calendarsError && !hasInsufficientScopes}
            >
              <Autocomplete<GoogleCalendar>
                options={calendarsData?.calendars ?? []}
                getOptionLabel={(c) => c.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={selectedCalendar}
                onChange={(_, cal) =>
                  setNewMapping((prev) => ({
                    ...prev,
                    googleCalendarId: cal?.id ?? "",
                    googleCalendarName: cal?.name ?? "",
                  }))
                }
                loading={calendarsLoading}
                disabled={
                  hasInsufficientScopes ||
                  calendarsLoading ||
                  (calendarsError !== null && !hasInsufficientScopes)
                }
                noOptionsText={
                  hasInsufficientScopes
                    ? "Please reconnect your calendar first"
                    : calendarsError
                    ? "Error loading calendars"
                    : "No calendars found"
                }
                renderOption={(props, cal) => (
                  <li {...props} key={cal.id}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        width: "100%",
                      }}
                    >
                      <SyncLock sx={{ fontSize: 18, color: "success.main" }} />
                      <span style={{ flex: 1 }}>{cal.name}</span>
                      {cal.primary && (
                        <Chip label="Primary" size="small" />
                      )}
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Google Calendar"
                    placeholder="Search calendars…"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {calendarsLoading && (
                            <CircularProgress color="inherit" size={16} />
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              {calendarsError && !hasInsufficientScopes && (
                <FormHelperText>
                  Error loading calendars. Try reconnecting your Google
                  Calendar.
                </FormHelperText>
              )}
            </FormControl>

            {/* Info tip */}
            <Alert severity="info">
              <Typography variant="caption">
                <strong>Example:</strong> Select the column that identifies
                teams (e.g. &quot;Team&quot; or &quot;Sports Level&quot;),
                then pick the exact value (e.g. &quot;Junior Varsity
                Basketball&quot;). All games with that value will sync to the
                chosen calendar.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={handleDialogClose}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddMapping}
            variant="contained"
            disabled={
              createMappingMutation.isPending ||
              hasInsufficientScopes ||
              !canSubmit
            }
            sx={{ textTransform: "none" }}
          >
            {createMappingMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              "Add Mapping"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
