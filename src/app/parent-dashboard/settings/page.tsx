"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Snackbar,
  IconButton,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import {
  CreditCard, ChildCare, Add, School, Edit, AccountCircle,
  Sync, CheckCircle, HourglassTop, BlockOutlined, Warning,
} from "@mui/icons-material";
import Link from "next/link";
import { SupportFormWithDropdown } from "@/components/support/SupportFormWithDropdown";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import { mergeSports, mergeLevels } from "@/lib/utils/parentSportsData";

interface SchoolOption {
  id: string;
  name: string;
}

interface SportOption {
  id: string;
  name: string;
}

interface LevelOption {
  id: string;
  name: string;
}

type SyncStatus = "APPROVED" | "PENDING" | "REJECTED" | "REMOVED" | "NONE";

interface ParentLink {
  id: string;
  childName: string;
  childGrade: string | null;
  sportName: string;
  sportLevel: string;
  schoolName: string;
  schoolId: string;
  athleticDirectorName: string;
  status?: string;
  syncStatus: SyncStatus;
}

interface ParentSubscription {
  status: string;
  trialEnd: string | null;
  plan: string;
}

interface SyncRequest {
  id: string;
  sportName: string;
  sportLevel: string;
  schoolId: string;
  schoolName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}

interface ParentOverviewData {
  links: ParentLink[];
  subscription: ParentSubscription | null;
  syncRequests?: SyncRequest[];
}

type SnackbarState = { open: boolean; message: string; severity: AlertColor };
const DEFAULT_SNACKBAR: SnackbarState = { open: false, message: "", severity: "success" };

async function fetchParentOverview(): Promise<ParentOverviewData> {
  const res = await fetch("/api/parent/overview");
  if (!res.ok) throw new Error("Failed to fetch settings data");
  return res.json();
}

async function fetchSchools(): Promise<{ schools: SchoolOption[] }> {
  const res = await fetch("/api/parent/schools");
  if (!res.ok) throw new Error("Failed to fetch schools");
  return res.json();
}

async function fetchSports(schoolId: string): Promise<{ sports: SportOption[] }> {
  const res = await fetch(`/api/parent/sports?schoolId=${encodeURIComponent(schoolId)}`);
  if (!res.ok) throw new Error("Failed to fetch sports");
  return res.json();
}

async function fetchLevels(schoolId: string, sport: string): Promise<{ levels: LevelOption[] }> {
  const res = await fetch(
    `/api/parent/sport-levels?schoolId=${encodeURIComponent(schoolId)}&sport=${encodeURIComponent(sport)}`
  );
  if (!res.ok) throw new Error("Failed to fetch levels");
  return res.json();
}

async function fetchParentProfile(): Promise<{ name: string | null; email: string; phone: string | null }> {
  const res = await fetch("/api/parent/profile");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

async function updateAthleteLink(
  id: string,
  data: { athleteName?: string; schoolId?: string; sport?: string; gradeLevel?: string }
): Promise<{ success: boolean; message: string; schoolChanged?: boolean }> {
  const res = await fetch(`/api/parent/athlete-links/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to update");
  return result;
}

// ---------------------------------------------------------------------------
// EditProfileDialog
// ---------------------------------------------------------------------------
interface EditProfileDialogProps {
  open: boolean;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  onClose: () => void;
  onSaved: (message: string, isError?: boolean) => void;
}

function EditProfileDialog({
  open,
  initialName,
  initialEmail,
  initialPhone,
  onClose,
  onSaved,
}: EditProfileDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setEmail(initialEmail);
      setPhone(initialPhone);
    }
  }, [open, initialName, initialEmail, initialPhone]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch("/api/parent/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
        }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update profile");
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentCalendarStatusDedicated"] });
      queryClient.invalidateQueries({ queryKey: ["parentProfile"] });
      onSaved("Profile updated successfully");
      onClose();
    },
    onError: (err: Error) => onSaved(err.message, true),
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const canSave = Boolean(name.trim() && email.trim() && emailRegex.test(email.trim()));

  return (
    <Dialog open={open} onClose={() => !saveMutation.isPending && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            required
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            size="small"
            required
          />
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            size="small"
            placeholder="Add phone number"
            helperText="Optional"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSave || saveMutation.isPending}
          startIcon={saveMutation.isPending ? <CircularProgress size={14} /> : undefined}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// EditChildDialog
// ---------------------------------------------------------------------------
interface EditChildDialogProps {
  link: ParentLink | null;
  onClose: () => void;
  onSaved: (message: string, isWarning?: boolean) => void;
}

function EditChildDialog({ link, onClose, onSaved }: EditChildDialogProps) {
  const queryClient = useQueryClient();

  const [childName, setChildName] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [selectedSport, setSelectedSport] = useState<SportOption | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<LevelOption | null>(null);

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [sports, setSports] = useState<SportOption[]>(mergeSports([]));
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingSports, setLoadingSports] = useState(false);
  const [loadingLevels, setLoadingLevels] = useState(false);

  // Populate form when dialog opens
  useEffect(() => {
    if (!link) return;
    setChildName(link.childName || "");

    // Pre-fill school (by name only — we need the list to find id)
    setLoadingSchools(true);
    fetchSchools()
      .then(({ schools: list }) => {
        setSchools(list);
        const match = list.find(
          (s) => s.id === link.schoolId || s.name === link.schoolName
        );
        if (match) {
          setSelectedSchool(match);
          // Load sports for this school
          if (link.sportName) {
            setLoadingSports(true);
            fetchSports(match.id)
              .then(({ sports: sList }) => {
                setSports(mergeSports(sList));
                const sportMatch = sList.find((s) => s.name === link.sportName);
                if (sportMatch) {
                  setSelectedSport(sportMatch);
                  // Load levels
                  if (link.sportLevel) {
                    setLoadingLevels(true);
                    fetchLevels(match.id, sportMatch.name)
                      .then(({ levels: lList }) => {
                        setLevels(lList);
                        const lm = lList.find((l) => l.name === link.sportLevel);
                        setSelectedLevel(lm ?? { id: link.sportLevel, name: link.sportLevel });
                      })
                      .catch(console.error)
                      .finally(() => setLoadingLevels(false));
                  }
                }
              })
              .catch(console.error)
              .finally(() => setLoadingSports(false));
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingSchools(false));
  }, [link]);

  const handleSchoolChange = useCallback((_: any, newSchool: SchoolOption | null) => {
    setSelectedSchool(newSchool);
    setSelectedSport(null);
    setSelectedLevel(null);
    setLevels([]);
    if (newSchool) {
      setLoadingSports(true);
      fetchSports(newSchool.id)
        .then(({ sports: list }) => setSports(mergeSports(list)))
        .catch(console.error)
        .finally(() => setLoadingSports(false));
    } else {
      setSports(mergeSports([]));
    }
  }, []);

  const handleSportChange = useCallback(
    (_: any, newSport: SportOption | null) => {
      setSelectedSport(newSport);
      setSelectedLevel(null);
      setLevels([]);
      if (newSport && selectedSchool) {
        setLoadingLevels(true);
        fetchLevels(selectedSchool.id, newSport.name)
          .then(({ levels: list }) => setLevels(list))
          .catch(console.error)
          .finally(() => setLoadingLevels(false));
      }
    },
    [selectedSchool]
  );

  const levelOptions = mergeLevels(levels);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAthleteLink(link!.id, {
        athleteName: childName.trim(),
        schoolId: selectedSchool?.id,
        sport: selectedSport?.name,
        gradeLevel: selectedLevel?.name,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      onSaved(data.message, data.schoolChanged);
      onClose();
    },
    onError: (err: Error) => onSaved(err.message, false),
  });

  if (!link) return null;

  const canSave = Boolean(childName.trim() && selectedSchool && selectedSport && selectedLevel);

  return (
    <Dialog open={Boolean(link)} onClose={() => !saveMutation.isPending && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Child Information</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Child's Name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            fullWidth
            size="small"
          />

          <Autocomplete
            options={schools}
            getOptionLabel={(o) => o.name}
            value={selectedSchool}
            onChange={handleSchoolChange}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            loading={loadingSchools}
            renderInput={(params) => (
              <TextField
                {...params}
                label="School"
                size="small"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingSchools ? <CircularProgress size={14} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <Autocomplete
            options={sports}
            getOptionLabel={(o) => o.name}
            value={selectedSport}
            onChange={handleSportChange}
            isOptionEqualToValue={(o, v) => o.name === v.name}
            loading={loadingSports}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Sport"
                size="small"
                fullWidth
                placeholder="Search or select a sport..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingSports ? <CircularProgress size={14} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <Autocomplete
            options={levelOptions}
            getOptionLabel={(o) => o.name}
            value={selectedLevel}
            onChange={(_: any, v: LevelOption | null) => setSelectedLevel(v)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            disabled={!selectedSport}
            loading={loadingLevels}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Level"
                size="small"
                fullWidth
                placeholder={selectedSport ? "Search or select level..." : "Select a sport first"}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingLevels ? <CircularProgress size={14} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          {/* Warning if school changed */}
          {selectedSchool && link.schoolId && selectedSchool.id !== link.schoolId && (
            <Alert severity="warning" sx={{ mt: -0.5 }}>
              Changing the school requires approval from the new athletic director. Your link will be set to
              Pending until they approve.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSave || saveMutation.isPending}
          startIcon={saveMutation.isPending ? <CircularProgress size={14} /> : undefined}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// CalendarSyncCard — shows per-sport sync status and re-sync button
// ---------------------------------------------------------------------------
interface CalendarSyncCardProps {
  syncRequests: SyncRequest[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

function CalendarSyncCard({ syncRequests, onSuccess, onError }: CalendarSyncCardProps) {
  const queryClient = useQueryClient();
  const [requestingKey, setRequestingKey] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: async (payload: { schoolId: string; sportName: string; sportLevel: string }) => {
      const res = await fetch("/api/parent/calendar-sync-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      onSuccess(`Re-sync request sent for ${vars.sportName}. The athletic director will review it shortly.`);
    },
    onError: (err: Error) => onError(err.message),
    onSettled: () => setRequestingKey(null),
  });

  // Deduplicate: keep only the most-recent request per school+sport+level slot
  const slotMap = new Map<string, SyncRequest>();
  for (const req of syncRequests) {
    const key = `${req.schoolId}|${req.sportName.toLowerCase()}|${req.sportLevel.toLowerCase()}`;
    if (!slotMap.has(key)) slotMap.set(key, req);
  }
  const latestRequests = Array.from(slotMap.values());

  const statusChip = (status: SyncRequest["status"]) => {
    switch (status) {
      case "APPROVED":
        return <Chip icon={<CheckCircle />} label="Active" size="small" color="success" variant="outlined" />;
      case "PENDING":
        return <Chip icon={<HourglassTop />} label="Pending Approval" size="small" color="warning" variant="outlined" />;
      case "REJECTED":
        return <Chip icon={<BlockOutlined />} label="Removed" size="small" color="error" variant="outlined" />;
      default:
        return <Chip icon={<Warning />} label="Unknown" size="small" variant="outlined" />;
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Sync color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Calendar Sync Status
          </Typography>
        </Box>

        {latestRequests.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No calendar sync requests yet. Use the Overview page to request sync access for each sport.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {latestRequests.map((req) => {
              const slotKey = `${req.schoolId}|${req.sportName.toLowerCase()}|${req.sportLevel.toLowerCase()}`;
              const isRequesting = requestingKey === slotKey;
              const canRequest = req.status === "REJECTED";

              return (
                <Box
                  key={req.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1,
                    p: 1.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: req.status === "REJECTED" ? "error.light" : "divider",
                    bgcolor: req.status === "REJECTED" ? "error.50" : "background.paper",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.25 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {req.sportName}
                      </Typography>
                      <Chip label={req.sportLevel} size="small" variant="outlined" color="primary" />
                      {statusChip(req.status)}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {req.schoolName}
                      {req.status === "REJECTED" && req.rejectionReason && (
                        <> · Reason: <em>{req.rejectionReason}</em></>
                      )}
                    </Typography>
                  </Box>

                  {canRequest && (
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={isRequesting ? <CircularProgress size={12} color="inherit" /> : <Sync />}
                      disabled={isRequesting}
                      onClick={() => {
                        setRequestingKey(slotKey);
                        syncMutation.mutate({
                          schoolId: req.schoolId,
                          sportName: req.sportName,
                          sportLevel: req.sportLevel,
                        });
                      }}
                      sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      {isRequesting ? "Sending…" : "Request Re-sync"}
                    </Button>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------
export default function ParentSettingsPage() {
  const queryClient = useQueryClient();
  const [editLink, setEditLink] = useState<ParentLink | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR);

  const { data, isLoading, error } = useQuery({
    queryKey: ["parentOverview"],
    queryFn: fetchParentOverview,
  });

  const { data: calendarStatus } = useQuery({
    queryKey: ["parentCalendarStatusDedicated"],
    queryFn: async () => {
      const res = await fetch("/api/parent/calendar/status");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: profileData } = useQuery({
    queryKey: ["parentProfile"],
    queryFn: fetchParentProfile,
    staleTime: 5 * 60 * 1000,
  });

  const showMessage = (message: string, severity: AlertColor = "success") =>
    setSnackbar({ open: true, message, severity });

  const resyncMutation = useMutation({
    mutationFn: (link: ParentLink) =>
      fetch("/api/parent/calendar-sync-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: link.schoolId,
          sportName: link.sportName,
          sportLevel: link.sportLevel,
        }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit request");
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      showMessage("Re-sync request submitted! The Athletic Director will review it.");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load settings. Please try again.</Alert>;
  }

  const plan = data?.subscription?.plan || "parent_free";
  const isDonation = plan.includes("donation");
  const subscriptionStatus = data?.subscription?.status || "FREE";
  const links = data?.links || [];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account and preferences
        </Typography>
      </Box>

      {/* Account Details */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AccountCircle color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Account Details
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setEditProfileOpen(true)} aria-label="Edit profile">
              <Edit fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {calendarStatus?.userName && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                  Name:
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {calendarStatus.userName}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                Email:
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {calendarStatus?.userEmail ?? "—"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                Phone:
              </Typography>
              <Typography
                variant="body2"
                fontWeight={500}
                color={profileData?.phone ? "text.primary" : "text.disabled"}
              >
                {profileData?.phone ?? "—"}
              </Typography>
            </Box>
            {calendarStatus?.connectedEmail && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                  Calendar:
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {calendarStatus.connectedEmail}
                </Typography>
                <Chip label="Connected" size="small" color="success" variant="outlined" />
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CreditCard color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Subscription
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <Typography variant="body1">Current Plan:</Typography>
            <Chip label={isDonation ? "Donation Plan ($2.50/mo)" : "Free Plan"} color={isDonation ? "primary" : "success"} size="small" />
            {subscriptionStatus === "TRIALING" && <Chip label="Trial" size="small" variant="outlined" color="info" />}
          </Box>
          <Button variant="outlined" component={Link} href="/onboarding/parent/plans">
            Change Plan
          </Button>
        </CardContent>
      </Card>

      {/* My Children & Schools */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ChildCare color="primary" />
              <Typography variant="h6" fontWeight={600}>
                My Children & Schools
              </Typography>
            </Box>
            {links.length > 0 && (
              <Button variant="contained" size="small" startIcon={<Add />} component={Link} href="/onboarding/parent">
                Add Child
              </Button>
            )}
          </Box>

          {links.length === 0 ? (
            <>
              <Typography variant="body2" color="text.secondary">
                No children linked yet. Add a child to get started.
              </Typography>
              <br />
              <Button variant="contained" size="small" startIcon={<Add />} component={Link} href="/onboarding/parent">
                Add Child
              </Button>
            </>
          ) : (
            <Grid container spacing={2}>
              {links.map((link) => (
                <Grid size={{ xs: 12, sm: 6 }} key={link.id}>
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {link.childName}
                            {link.childGrade && (
                              <Typography component="span" variant="body2" color="text.secondary">
                                {" "}(Grade {link.childGrade})
                              </Typography>
                            )}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                            <School fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {link.schoolName}
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                            {link.sportName && <Chip label={link.sportName} size="small" variant="outlined" />}
                            {link.sportLevel && <Chip label={link.sportLevel} size="small" variant="outlined" color="primary" />}
                            {link.status && link.status !== "ACTIVE" && (
                              <Chip
                                label={link.status}
                                size="small"
                                color={link.status === "PENDING" ? "warning" : "default"}
                                variant="outlined"
                              />
                            )}
                          </Box>
                          {(link.syncStatus === "REMOVED" || link.syncStatus === "REJECTED" || link.syncStatus === "NONE") && link.sportName && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={
                                resyncMutation.isPending && (resyncMutation.variables as ParentLink)?.id === link.id
                                  ? <CircularProgress size={12} />
                                  : <Sync fontSize="small" />
                              }
                              disabled={resyncMutation.isPending}
                              onClick={() => resyncMutation.mutate(link)}
                              sx={{ mt: 1, py: 0.25, px: 1, fontSize: "0.7rem" }}
                            >
                              Request Re-sync
                            </Button>
                          )}
                        </Box>

                        <IconButton
                          size="small"
                          onClick={() => setEditLink(link)}
                          sx={{ ml: 1, mt: -0.5 }}
                          title="Edit child info"
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Calendar Sync Status */}
      <CalendarSyncCard
        syncRequests={data?.syncRequests ?? []}
        onSuccess={(msg) => showMessage(msg)}
        onError={(msg) => showMessage(msg, "error")}
      />

      {/* Support */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Create a Support Ticket
          </Typography>
          <SupportFormWithDropdown />
        </CardContent>
      </Card>

      {/* Delete Account */}
      <DeleteAccountSection
        apiEndpoint="/api/parent/delete-account"
        redirectPath="/parents?deleted=true"
        onSignOut={async () => {
          await fetch("/api/parent/signout", { method: "POST" });
        }}
      />

      <EditProfileDialog
        open={editProfileOpen}
        initialName={calendarStatus?.userName ?? profileData?.name ?? ""}
        initialEmail={calendarStatus?.userEmail ?? profileData?.email ?? ""}
        initialPhone={profileData?.phone ?? ""}
        onClose={() => setEditProfileOpen(false)}
        onSaved={(message, isError) => showMessage(message, isError ? "error" : "success")}
      />

      {/* Edit child dialog */}
      <EditChildDialog
        link={editLink}
        onClose={() => setEditLink(null)}
        onSaved={(message, isWarning) => showMessage(message, isWarning ? "warning" : "success")}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
