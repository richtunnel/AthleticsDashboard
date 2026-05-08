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
  Tooltip,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import { CreditCard, ChildCare, Add, School, Edit, DeleteOutline, DeleteForever } from "@mui/icons-material";
import Link from "next/link";
import { SupportFormWithDropdown } from "@/components/support/SupportFormWithDropdown";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

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

interface ParentLink {
  id: string;
  childName: string;
  childGrade: string | null;
  sportName: string;
  sportLevel: string;
  schoolName: string;
  schoolId?: string;
  athleticDirectorName: string;
  status?: string;
}

interface ParentSubscription {
  status: string;
  trialEnd: string | null;
  plan: string;
}

interface ParentOverviewData {
  links: ParentLink[];
  subscription: ParentSubscription | null;
}

type SnackbarState = { open: boolean; message: string; severity: AlertColor };
const DEFAULT_SNACKBAR: SnackbarState = { open: false, message: "", severity: "success" };

const FALLBACK_LEVELS = ["Varsity", "Junior Varsity", "Freshman", "Middle School"];

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
  const [sports, setSports] = useState<SportOption[]>([]);
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
                setSports(sList);
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
    setSports([]);
    setSelectedLevel(null);
    setLevels([]);
    if (newSchool) {
      setLoadingSports(true);
      fetchSports(newSchool.id)
        .then(({ sports: list }) => setSports(list))
        .catch(console.error)
        .finally(() => setLoadingSports(false));
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

  const levelOptions =
    levels.length > 0
      ? levels
      : FALLBACK_LEVELS.map((l) => ({ id: l, name: l }));

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
            isOptionEqualToValue={(o, v) => o.id === v.id}
            disabled={!selectedSchool}
            loading={loadingSports}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Sport"
                size="small"
                fullWidth
                placeholder={selectedSchool ? "Select sport..." : "Select a school first"}
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
// Main settings page
// ---------------------------------------------------------------------------
export default function ParentSettingsPage() {
  const queryClient = useQueryClient();
  const [editLink, setEditLink] = useState<ParentLink | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ParentLink | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR);

  const { data, isLoading, error } = useQuery({
    queryKey: ["parentOverview"],
    queryFn: fetchParentOverview,
  });

  const deleteChildMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/parent/athlete-links/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete child");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      showMessage("Child removed successfully.");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const deleteAllMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/parent/athlete-links/${id}`, { method: "DELETE" }).then((r) => r.json())
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      showMessage("All children removed successfully.");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const showMessage = (message: string, severity: AlertColor = "success") =>
    setSnackbar({ open: true, message, severity });

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
              <Box sx={{ display: "flex", gap: 1 }}>
                <Tooltip title="Remove all children">
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<DeleteForever fontSize="small" />}
                    onClick={() => setDeleteAllConfirm(true)}
                  >
                    Remove All
                  </Button>
                </Tooltip>
                <Button variant="contained" size="small" startIcon={<Add />} component={Link} href="/onboarding/parent">
                  Add Child
                </Button>
              </Box>
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
                            <Chip label={link.sportName} size="small" variant="outlined" />
                            <Chip label={link.sportLevel} size="small" variant="outlined" color="primary" />
                            {link.status && link.status !== "ACTIVE" && (
                              <Chip
                                label={link.status}
                                size="small"
                                color={link.status === "PENDING" ? "warning" : "default"}
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>

                        <Box sx={{ display: "flex", gap: 0.5, ml: 1, mt: -0.5 }}>
                          <Tooltip title="Edit child info">
                            <IconButton size="small" onClick={() => setEditLink(link)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove this child">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteConfirm(link)}
                              disabled={deleteChildMutation.isPending}
                            >
                              {deleteChildMutation.isPending && deleteConfirm?.id === link.id ? (
                                <CircularProgress size={14} color="error" />
                              ) : (
                                <DeleteOutline fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

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
      <DeleteAccountSection />

      {/* Edit child dialog */}
      <EditChildDialog
        link={editLink}
        onClose={() => setEditLink(null)}
        onSaved={(message, isWarning) => showMessage(message, isWarning ? "warning" : "success")}
      />

      {/* Delete single child confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: "error.main" }}>Remove Child?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove <strong>{deleteConfirm?.childName}</strong> from your account?
            This will also cancel any pending calendar sync requests for this child.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteChildMutation.isPending}
            startIcon={deleteChildMutation.isPending ? <CircularProgress size={14} /> : undefined}
            onClick={() => {
              if (deleteConfirm) {
                deleteChildMutation.mutate(deleteConfirm.id, {
                  onSettled: () => setDeleteConfirm(null),
                });
              }
            }}
          >
            {deleteChildMutation.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete all children confirm */}
      <Dialog open={deleteAllConfirm} onClose={() => setDeleteAllConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: "error.main" }}>Remove All Children?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove <strong>all {links.length} child links</strong> from your account and cancel
            any pending calendar sync requests. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllConfirm(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteAllMutation.isPending}
            startIcon={deleteAllMutation.isPending ? <CircularProgress size={14} /> : undefined}
            onClick={() => {
              deleteAllMutation.mutate(
                links.map((l) => l.id),
                { onSettled: () => setDeleteAllConfirm(false) }
              );
            }}
          >
            {deleteAllMutation.isPending ? "Removing…" : "Remove All"}
          </Button>
        </DialogActions>
      </Dialog>

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
