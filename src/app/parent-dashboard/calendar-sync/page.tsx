"use client";

import { useState, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Delete, CalendarMonth, CheckCircle, Warning, Info, Sync } from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";

interface LinkedSchool {
  id: string;
  schoolId: string;
  schoolName: string;
}

interface CalendarSyncRequest {
  id: string;
  schoolId: string;
  sportName: string;
  sportLevel: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REMOVED";
  rejectionReason?: string;
  requestedAt: string;
  googleCalendarId?: string;
  school: {
    name: string;
  };
}

interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
}

function CalendarSyncPageContent() {
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedSportName, setSelectedSportName] = useState("");
  const [selectedSportLevel, setSelectedSportLevel] = useState("");
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [selectedRequestForSync, setSelectedRequestForSync] = useState<CalendarSyncRequest | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState("");

  const { data: schoolsData, isLoading: schoolsLoading } = useQuery({
    queryKey: ["parentLinkedSchools"],
    queryFn: async () => {
      const res = await fetch("/api/parent/linked-schools");
      if (!res.ok) throw new Error("Failed to fetch linked schools");
      return res.json() as Promise<{ schools: LinkedSchool[] }>;
    },
  });

  const { data: sportsData, isLoading: sportsLoading } = useQuery({
    queryKey: ["parentSports", selectedSchoolId],
    queryFn: async () => {
      if (!selectedSchoolId) return { sports: [] };
      const res = await fetch(`/api/parent/sports?schoolId=${selectedSchoolId}`);
      if (!res.ok) throw new Error("Failed to fetch sports");
      return res.json() as Promise<{ sports: { id: string; name: string }[] }>;
    },
    enabled: !!selectedSchoolId,
  });

  const { data: levelsData, isLoading: levelsLoading } = useQuery({
    queryKey: ["parentLevels", selectedSchoolId, selectedSportName],
    queryFn: async () => {
      if (!selectedSchoolId || !selectedSportName) return { levels: [] };
      const res = await fetch(`/api/parent/sport-levels?schoolId=${selectedSchoolId}&sport=${selectedSportName}`);
      if (!res.ok) throw new Error("Failed to fetch levels");
      return res.json() as Promise<{ levels: { id: string; name: string }[] }>;
    },
    enabled: !!selectedSchoolId && !!selectedSportName,
  });

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["parentCalendarSyncRequests"],
    queryFn: async () => {
      const res = await fetch("/api/parent/calendar-sync-requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json() as Promise<{ requests: CalendarSyncRequest[] }>;
    },
  });

  const { data: calendarStatus, isLoading: calendarStatusLoading } = useQuery({
    queryKey: ["parentCalendarStatus"],
    queryFn: async () => {
      const res = await fetch("/api/parent/calendar/status");
      if (!res.ok) return { isConnected: false, connectedEmail: null };
      return res.json() as Promise<{ isConnected: boolean; connectedEmail: string | null }>;
    },
  });

  const { data: calendarsData, isLoading: calendarsLoading } = useQuery({
    queryKey: ["parentGoogleCalendars"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/list-calendars");
      if (!res.ok) return { calendars: [] };
      return res.json() as Promise<{ calendars: GoogleCalendar[] }>;
    },
    enabled: calendarStatus?.isConnected === true,
  });

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch("/api/parent/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/parent-dashboard/calendar-sync" }),
      });
      if (!res.ok) throw new Error("Failed to initiate calendar connection");
      const { authUrl } = await res.json();
      if (authUrl) window.location.href = authUrl;
    } catch (err) {
      addNotification("Failed to start Google Calendar connection", "error");
    }
  };

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/parent/calendar-sync-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          sportName: selectedSportName,
          sportLevel: selectedSportLevel,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentCalendarSyncRequests"] });
      addNotification("Request submitted successfully", "success");
      setActiveStep(0);
      setSelectedSchoolId("");
      setSelectedSportName("");
      setSelectedSportLevel("");
    },
    onError: (error: Error) => {
      addNotification(error.message, "error");
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/parent/calendar-sync-requests/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentCalendarSyncRequests"] });
      addNotification("Request cancelled", "info");
    },
    onError: (error: Error) => {
      addNotification(error.message, "error");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ id, googleCalendarId }: { id: string; googleCalendarId: string }) => {
      const res = await fetch(`/api/parent/calendar-sync-requests/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleCalendarId }),
      });
      if (!res.ok) throw new Error("Failed to sync calendar");
      return res.json();
    },
    onSuccess: () => {
      addNotification("Calendar sync started successfully", "success");
      setSyncDialogOpen(false);
    },
    onError: (error: Error) => {
      addNotification(error.message, "error");
    },
  });

  const handleSyncClick = (request: CalendarSyncRequest) => {
    setSelectedRequestForSync(request);
    setSyncDialogOpen(true);
  };

  const steps = ["Select School", "Select Sport", "Select Level"];

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Calendar Sync Approval
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Request approval from the Athletic Director to sync specific team schedules to your Google Calendar.
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            New Sync Request
          </Typography>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Autocomplete
              options={schoolsData?.schools || []}
              getOptionLabel={(o) => o.schoolName}
              value={schoolsData?.schools.find((s) => s.schoolId === selectedSchoolId) ?? null}
              onChange={(_: any, v) => setSelectedSchoolId(v?.schoolId ?? "")}
              isOptionEqualToValue={(o, v) => o.schoolId === v.schoolId}
              loading={schoolsLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="School"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {schoolsLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}

          {activeStep === 1 && (
            <Autocomplete
              options={sportsData?.sports || []}
              getOptionLabel={(o) => o.name}
              value={sportsData?.sports.find((s) => s.name === selectedSportName) ?? null}
              onChange={(_: any, v) => setSelectedSportName(v?.name ?? "")}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              loading={sportsLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Sport"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {sportsLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}

          {activeStep === 2 && (
            <Autocomplete
              options={levelsData?.levels || []}
              getOptionLabel={(o) => o.name}
              value={levelsData?.levels.find((l) => l.name === selectedSportLevel) ?? null}
              onChange={(_: any, v) => setSelectedSportLevel(v?.name ?? "")}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              loading={levelsLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Level"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {levelsLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3, gap: 2 }}>
            {activeStep > 0 && <Button onClick={handleBack}>Back</Button>}
            {activeStep < 2 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={
                  (activeStep === 0 && !selectedSchoolId) ||
                  (activeStep === 1 && !selectedSportName)
                }
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => createRequestMutation.mutate()}
                disabled={!selectedSportLevel || createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? <CircularProgress size={24} /> : "Submit Request"}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Your Requests
      </Typography>
      {requestsLoading ? (
        <CircularProgress />
      ) : requestsData?.requests.length === 0 ? (
        <Alert severity="info">You haven&apos;t submitted any sync requests yet.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Sport</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requestsData?.requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.school.name}</TableCell>
                  <TableCell>{request.sportName}</TableCell>
                  <TableCell>{request.sportLevel}</TableCell>
                  <TableCell>
                    <Chip
                      label={request.status === "REMOVED" ? "Removed" : request.status}
                      color={
                        request.status === "APPROVED"
                          ? "success"
                          : request.status === "REJECTED"
                          ? "error"
                          : request.status === "REMOVED"
                          ? "default"
                          : "warning"
                      }
                      size="small"
                    />
                    {request.status === "REJECTED" && request.rejectionReason && (
                      <Tooltip title={request.rejectionReason}>
                        <IconButton size="small">
                          <Warning fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {request.status === "PENDING" && (
                      <IconButton
                        color="error"
                        onClick={() => cancelRequestMutation.mutate(request.id)}
                        disabled={cancelRequestMutation.isPending}
                      >
                        <Delete />
                      </IconButton>
                    )}
                    {request.status === "APPROVED" && (
                      <Button
                        variant="outlined"
                        startIcon={<Sync />}
                        size="small"
                        onClick={() => handleSyncClick(request)}
                      >
                        Sync Now
                      </Button>
                    )}
                    {request.status === "REMOVED" && (
                      <Typography variant="caption" color="text.secondary">
                        Removed by AD — use the form above to re-request
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)}>
        <DialogTitle>Sync to Google Calendar</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select which of your Google Calendars you want to sync{" "}
            <strong>{selectedRequestForSync?.sportName} {selectedRequestForSync?.sportLevel}</strong> games to.
          </Typography>

          {calendarStatusLoading || calendarsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !calendarStatus?.isConnected ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                You haven&apos;t connected your Google Calendar yet. Connect it to start syncing.
              </Alert>
              <Button
                variant="contained"
                startIcon={<CalendarMonth />}
                onClick={handleConnectCalendar}
              >
                Connect Google Calendar
              </Button>
            </Box>
          ) : calendarsData?.calendars && calendarsData.calendars.length > 0 ? (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Your Calendar</InputLabel>
              <Select
                value={selectedCalendarId}
                label="Your Calendar"
                onChange={(e) => setSelectedCalendarId(e.target.value)}
              >
                {calendarsData.calendars.map((cal) => (
                  <MenuItem key={cal.id} value={cal.id}>
                    {cal.name} {cal.primary && "(Primary)"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Could not load your calendars. Your Google Calendar may need to be reconnected.
              </Alert>
              <Button
                variant="outlined"
                startIcon={<CalendarMonth />}
                onClick={handleConnectCalendar}
              >
                Reconnect Google Calendar
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!selectedCalendarId || !calendarStatus?.isConnected || syncMutation.isPending}
            onClick={() => syncMutation.mutate({ id: selectedRequestForSync!.id, googleCalendarId: selectedCalendarId })}
          >
            {syncMutation.isPending ? <CircularProgress size={24} /> : "Start Sync"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function ParentCalendarSyncPage() {
  return (
    <Suspense fallback={<CircularProgress />}>
      <CalendarSyncPageContent />
    </Suspense>
  );
}
