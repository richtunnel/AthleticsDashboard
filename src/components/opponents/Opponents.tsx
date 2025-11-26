"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { ReactSortable } from "react-sortablejs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Card,
  CardContent,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  Snackbar,
  Grid,
  Skeleton,
  Tooltip,
  Divider,
} from "@mui/material";
import { Add, Edit, Delete, Save, Cancel, School, Person, Close, PlayArrow } from "@mui/icons-material";
import { useOpponentsStore } from "@/lib/stores/OpponentStore";
import { LoadingButton } from "@/components/utils/LoadingButton";

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

// ============================================================================
// INTERFACES
// ============================================================================

interface OpponentFormData {
  name: string;
  mascot: string;
  colors: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
}

interface Opponent {
  id: string;
  name: string;
  mascot?: string;
  colors?: string;
  contact?: string;
  phone?: string;
  email?: string;
  notes?: string;
  sortOrder: number;
}

interface SortableOpponent extends Opponent {
  chosen?: boolean;
  selected?: boolean;
}

interface MatchupResult {
  id: string;
  opponentId: string;
  organizationScore: number;
  opponentScore: number;
  isWin: boolean;
  opponent: Opponent;
  gameDate?: string;
  createdAt: string;
}

// ============================================================================
// MEMOIZED COMPONENTS
// ============================================================================

const OpponentCard = memo(({ opponent, isEditing, editingId, onEdit, onUpdate, onDelete, onCancelEdit, updateField, onWin, onLoss, onDraw }: any) => {
  return (
    <Card
      sx={{
        mb: 2,
        transition: "all 0.2s ease",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "none",
        "&:hover": { borderColor: "primary.light" },
        userSelect: "none",
      }}
    >
      <CardContent sx={{ p: 0.75, "&:last-child": { pb: 0.75 } }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size="grow">
            {editingId === opponent.id ? (
              <Stack spacing={2} onClick={(e) => e.stopPropagation()}>
                <TextField label="School/Team Name" value={opponent.name} onChange={(e) => updateField(opponent.id, "name", e.target.value)} size="small" fullWidth />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Mascot" value={opponent.mascot || ""} onChange={(e) => updateField(opponent.id, "mascot", e.target.value)} size="small" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Colors" value={opponent.colors || ""} onChange={(e) => updateField(opponent.id, "colors", e.target.value)} size="small" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Contact Person" value={opponent.contact || ""} onChange={(e) => updateField(opponent.id, "contact", e.target.value)} size="small" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Phone" value={opponent.phone || ""} onChange={(e) => updateField(opponent.id, "phone", e.target.value)} size="small" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField label="Email" value={opponent.email || ""} onChange={(e) => updateField(opponent.id, "email", e.target.value)} size="small" fullWidth />
                  </Grid>
                </Grid>
              </Stack>
            ) : (
              <Box sx={{ pl: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 15 }}>
                  {opponent.name}
                </Typography>
                {opponent.mascot && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                    Mascot: {opponent.mascot}
                  </Typography>
                )}
                {opponent.colors && <Chip label={opponent.colors} size="small" sx={{ mt: 0.5 }} />}
                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                  {opponent.contact && (
                    <Grid size="auto">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Person fontSize="small" color="action" />
                        <Typography variant="body2" sx={{ fontSize: 12 }}>
                          {opponent.contact}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </Grid>

          <Grid size="auto">
            {editingId === opponent.id ? (
              <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                <IconButton size="small" color="primary" onClick={() => onUpdate(opponent.id)}>
                  <Save fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={onCancelEdit}>
                  <Cancel fontSize="small" />
                </IconButton>
              </Stack>
            ) : (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Record a Win (your team won)">
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWin(opponent);
                    }}
                    sx={{
                      minWidth: "32px",
                      width: "32px",
                      height: "32px",
                      padding: 0,
                      bgcolor: "rgba(76, 175, 80, 0.15)",
                      color: "success.main",
                      fontWeight: 700,
                      fontSize: "14px",
                      "&:hover": {
                        bgcolor: "rgba(76, 175, 80, 0.25)",
                      },
                    }}
                  >
                    W
                  </Button>
                </Tooltip>
                <Tooltip title="Record a Loss (your team lost)">
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLoss(opponent);
                    }}
                    sx={{
                      minWidth: "32px",
                      width: "32px",
                      height: "32px",
                      padding: 0,
                      bgcolor: "rgba(244, 67, 54, 0.15)",
                      color: "error.main",
                      fontWeight: 700,
                      fontSize: "14px",
                      "&:hover": {
                        bgcolor: "rgba(244, 67, 54, 0.25)",
                      },
                    }}
                  >
                    L
                  </Button>
                </Tooltip>
                <Tooltip title="Record a Draw (tie game)">
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDraw(opponent);
                    }}
                    sx={{
                      minWidth: "32px",
                      width: "32px",
                      height: "32px",
                      padding: 0,
                      bgcolor: "rgba(255, 152, 0, 0.15)",
                      color: "warning.main",
                      fontWeight: 700,
                      fontSize: "14px",
                      "&:hover": {
                        bgcolor: "rgba(255, 152, 0, 0.25)",
                      },
                    }}
                  >
                    D
                  </Button>
                </Tooltip>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(opponent.id);
                  }}
                >
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(opponent.id);
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
});

OpponentCard.displayName = "OpponentCard";

// ============================================================================
// SCORE DIALOG COMPONENT
// ============================================================================

interface ScoreDialogProps {
  open: boolean;
  onClose: () => void;
  yourTeamName: string;
  opponentName: string;
  resultType: "win" | "loss" | "draw";
  onSubmit: (yourScore: number, opponentScore: number) => void;
  loading: boolean;
}

const ScoreDialog = ({ open, onClose, yourTeamName, opponentName, resultType, onSubmit, loading }: ScoreDialogProps) => {
  const [yourScore, setYourScore] = useState<string>("");
  const [opponentScore, setOpponentScore] = useState<string>("");

  const handleSubmit = () => {
    const your = parseInt(yourScore);
    const opp = parseInt(opponentScore);

    if (isNaN(your) || isNaN(opp) || your < 0 || opp < 0) {
      return;
    }

    onSubmit(your, opp);
  };

  useEffect(() => {
    if (!open) {
      setYourScore("");
      setOpponentScore("");
    }
  }, [open]);

  const getTitle = () => {
    switch (resultType) {
      case "win":
        return "Win";
      case "loss":
        return "Loss";
      case "draw":
        return "Draw";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Enter Score - {getTitle()}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField label="Your Team" type="number" value={yourScore} onChange={(e) => setYourScore(e.target.value)} fullWidth autoFocus inputProps={{ min: 0 }} />
          <TextField label={opponentName} type="number" value={opponentScore} onChange={(e) => setOpponentScore(e.target.value)} fullWidth inputProps={{ min: 0 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <LoadingButton onClick={handleSubmit} variant="contained" loading={loading} disabled={!yourScore || !opponentScore}>
          Save Result
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OpponentsPage() {
  const { opponents, isLoading, isCreating, setOpponents, setLoading, setCreating, addOpponent, updateOpponent: storeUpdateOpponent, deleteOpponent, reorderOpponents } = useOpponentsStore();

  const queryClient = useQueryClient();

  // State management
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<OpponentFormData>({
    name: "",
    mascot: "",
    colors: "",
    contact: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Score dialog state
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [scoreDialogData, setScoreDialogData] = useState<{
    opponent: Opponent | null;
    resultType: "win" | "loss" | "draw";
  }>({ opponent: null, resultType: "win" });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
  });

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent));
  }, []);

  // Refs for performance
  const debouncedReorderRef = useRef<any>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const { data: matchupResultsData, refetch: refetchMatchupResults } = useQuery({
    queryKey: ["matchup-results"],
    queryFn: async () => {
      const res = await fetch("/api/matchup-results");
      if (!res.ok) throw new Error("Failed to fetch matchup results");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const { data: userData } = useQuery({
    queryKey: ["user-data"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) throw new Error("Failed to fetch user data");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const matchupResults = useMemo(() => matchupResultsData?.data || [], [matchupResultsData?.data]);
  const yourTeamName = useMemo(() => {
    return userData?.user?.teamName || userData?.user?.schoolName || "Your Team";
  }, [userData?.user]);

  const wonGamesCount = useMemo(() => {
    return matchupResults.filter((result: MatchupResult) => result.isWin).length;
  }, [matchupResults]);

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const createMatchupMutation = useMutation({
    mutationFn: async (data: { opponentId: string; organizationScore: number; opponentScore: number; isWin: boolean }) => {
      const res = await fetch("/api/matchup-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create matchup result");
      return res.json();
    },
    onSuccess: () => {
      refetchMatchupResults();
      showSnackbar("Matchup result saved!", "success");
      setScoreDialogOpen(false);
    },
    onError: (error: any) => {
      showSnackbar(error.message || "Failed to save matchup result", "error");
    },
  });

  const updateOpponentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/opponents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update opponent");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["opponents"] });
      const previousOpponents = opponents;
      storeUpdateOpponent(id, data);
      return { previousOpponents };
    },
    onError: (err, variables, context) => {
      if (context?.previousOpponents) {
        setOpponents(context.previousOpponents);
      }
      showSnackbar("Failed to update opponent", "error");
    },
    onSuccess: () => {
      setEditingId(null);
      showSnackbar("Opponent updated successfully", "success");
    },
  });

  const deleteOpponentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/opponents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete opponent");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["opponents"] });
      const previousOpponents = opponents;
      deleteOpponent(id);
      return { previousOpponents };
    },
    onError: (err, variables, context) => {
      if (context?.previousOpponents) {
        setOpponents(context.previousOpponents);
      }
      showSnackbar("Failed to delete opponent", "error");
    },
    onSuccess: () => {
      showSnackbar("Opponent deleted successfully", "success");
    },
  });

  const deleteMatchupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/matchup-results/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete matchup result");
      return res.json();
    },
    onSuccess: () => {
      refetchMatchupResults();
      showSnackbar("Matchup result deleted", "success");
    },
    onError: () => {
      showSnackbar("Failed to delete matchup result", "error");
    },
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const fetchOpponents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/opponents");
      const data = await res.json();
      if (data.success) {
        setOpponents(data.data);
      }
    } catch (error) {
      showSnackbar("Failed to fetch opponents", "error");
    } finally {
      setLoading(false);
    }
  }, [setLoading, setOpponents]);

  useEffect(() => {
    fetchOpponents();
  }, [fetchOpponents]);

  const debouncedReorder = useMemo(
    () =>
      debounce(async (newOrder: Opponent[]) => {
        try {
          const res = await fetch("/api/opponents/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reorderedOpponents: newOrder.map((opp, index) => ({
                id: opp.id,
                sortOrder: index + 1,
              })),
            }),
          });

          if (!res.ok) {
            throw new Error("Failed to update order");
          }
        } catch (error) {
          showSnackbar("Failed to update order", "error");
          fetchOpponents();
        }
      }, 500),
    [fetchOpponents]
  );

  useEffect(() => {
    debouncedReorderRef.current = debouncedReorder;
  }, [debouncedReorder]);

  const handleReorder = useCallback(
    (newOrder: Opponent[]) => {
      reorderOpponents(newOrder);
      debouncedReorderRef.current(newOrder);
    },
    [reorderOpponents]
  );

  const handleCreateOpponent = useCallback(async () => {
    if (!formData.name.trim()) {
      showSnackbar("School/Team name is required", "error");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/opponents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        addOpponent(data.data);
        setOpenCreateDialog(false);
        resetForm();
        showSnackbar("Opponent created successfully", "success");
      }
    } catch (error) {
      showSnackbar("Failed to create opponent", "error");
    } finally {
      setCreating(false);
    }
  }, [formData, addOpponent, setCreating]);

  const handleUpdateOpponent = useCallback(
    (id: string) => {
      const opponent = opponents.find((o) => o.id === id);
      if (!opponent) return;
      updateOpponentMutation.mutate({ id, data: opponent });
    },
    [opponents, updateOpponentMutation]
  );

  const handleDeleteOpponent = useCallback(
    (id: string) => {
      if (!confirm("Are you sure you want to delete this opponent?")) return;
      deleteOpponentMutation.mutate(id);
    },
    [deleteOpponentMutation]
  );

  const handleWin = useCallback((opponent: Opponent) => {
    setScoreDialogData({ opponent, resultType: "win" });
    setScoreDialogOpen(true);
  }, []);

  const handleLoss = useCallback((opponent: Opponent) => {
    setScoreDialogData({ opponent, resultType: "loss" });
    setScoreDialogOpen(true);
  }, []);

  const handleDraw = useCallback((opponent: Opponent) => {
    setScoreDialogData({ opponent, resultType: "draw" });
    setScoreDialogOpen(true);
  }, []);

  const handleScoreSubmit = useCallback(
    (yourScore: number, opponentScore: number) => {
      if (!scoreDialogData.opponent) return;

      const isWin = scoreDialogData.resultType === "win";

      createMatchupMutation.mutate({
        opponentId: scoreDialogData.opponent.id,
        organizationScore: yourScore,
        opponentScore: opponentScore,
        isWin: isWin,
      });
    },
    [scoreDialogData, createMatchupMutation]
  );

  const updateField = useCallback(
    (id: string, field: string, value: string) => {
      storeUpdateOpponent(id, { [field]: value });
    },
    [storeUpdateOpponent]
  );

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      mascot: "",
      colors: "",
      contact: "",
      phone: "",
      email: "",
      notes: "",
    });
  }, []);

  const showSnackbar = useCallback((message: string, severity: "success" | "error" | "warning" | "info") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debouncedReorderRef.current) {
        debouncedReorderRef.current.cancel();
      }
    };
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return (
      <Box sx={{ py: 4 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 5 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={120} sx={{ mb: 2, borderRadius: 2 }} />
            ))}
          </Grid>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Opponents & Win/Loss Tracker
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track your opponents and record game results with scores
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenCreateDialog(true)} sx={{ textTransform: "none" }}>
          Add Opponent
        </Button>
      </Box>

      {/* Two Column Layout */}
      <Grid container spacing={3}>
        {/* Left Column - Opponents List */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: 16 }}>
              Opponents List
              <Chip label={opponents.length} size="small" sx={{ ml: 1 }} />
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, mt: 0, py: 0 }}>
              Click W (Win), L (Loss), or D (Draw) on an opponent card to record your game result
            </Typography>

            {opponents.length > 0 ? (
              <Box
                sx={{
                  minHeight: 100,
                  maxHeight: "calc(100vh - 250px)",
                  overflowY: "auto",
                  overflowX: "hidden",
                  pr: 0.5,
                }}
              >
                {opponents.map((opponent) => (
                  <OpponentCard
                    key={opponent.id}
                    opponent={opponent}
                    isEditing={editingId === opponent.id}
                    editingId={editingId}
                    onEdit={setEditingId}
                    onUpdate={handleUpdateOpponent}
                    onDelete={handleDeleteOpponent}
                    onCancelEdit={() => {
                      setEditingId(null);
                      fetchOpponents();
                    }}
                    updateField={updateField}
                    onWin={handleWin}
                    onLoss={handleLoss}
                    onDraw={handleDraw}
                  />
                ))}
              </Box>
            ) : (
              <Paper sx={{ p: 4, textAlign: "center", bgcolor: "action.hover" }}>
                <School sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No opponents yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Click "Add Opponent" to start
                </Typography>
              </Paper>
            )}
          </Paper>
        </Grid>

        {/* Right Column - Score Tracker */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, minHeight: 500 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Score Tracker
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip label={`Total Games ${matchupResults.length}`} size="small" sx={{ bgcolor: "rgba(15, 23, 42, 0.08)" }} />
                <Chip
                  label={`Wins ${wonGamesCount}`}
                  size="small"
                  sx={{
                    bgcolor: "rgba(76, 175, 80, 0.15)",
                    color: "success.main",
                    fontWeight: 600,
                  }}
                />
              </Box>
            </Box>

            {matchupResults.length > 0 ? (
              <Stack spacing={2} sx={{ maxHeight: "calc(100vh - 350px)", overflowY: "auto" }}>
                {matchupResults.map((result: MatchupResult) => {
                  const isYourTeamWinner = result.isWin;
                  const winnerName = isYourTeamWinner ? yourTeamName : result.opponent.name;
                  const loserName = isYourTeamWinner ? result.opponent.name : yourTeamName;
                  const winnerScore = isYourTeamWinner ? result.organizationScore : result.opponentScore;
                  const loserScore = isYourTeamWinner ? result.opponentScore : result.organizationScore;

                  return (
                    <Card
                      key={result.id}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        position: "relative",
                        boxShadow: "none",
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (confirm("Delete this score entry?")) {
                            deleteMatchupMutation.mutate(result.id);
                          }
                        }}
                        sx={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          zIndex: 10,
                        }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                      <CardContent sx={{ padding: "12px 16px", "&:last-child": { pb: "12px" } }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {/* Left Side - Teams and Scores */}
                          <Box sx={{ flex: 1 }}>
                            {/* Winner Row */}
                            <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                              <PlayArrow
                                sx={{
                                  fontSize: 18,
                                  mr: 0.5,
                                  color: "text.secondary",
                                }}
                              />
                              <Box
                                sx={{
                                  bgcolor: "rgba(76, 175, 80, 0.15)",
                                  color: "success.main",
                                  fontWeight: 700,
                                  fontSize: "11px",
                                  borderRadius: "4px",
                                  px: 0.5,
                                  py: 0.25,
                                  mr: 0.75,
                                  lineHeight: 1,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minWidth: "18px",
                                }}
                              >
                                W
                              </Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "14px",
                                  flex: 1,
                                }}
                              >
                                {winnerName}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "16px",
                                  ml: 1,
                                }}
                              >
                                {winnerScore}
                              </Typography>
                            </Box>

                            {/* Divider */}
                            <Divider sx={{ my: 0.5, borderColor: "rgba(15, 23, 42, 0.90)" }} />

                            {/* Loser Row */}
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                              <Box sx={{ width: 18, mr: 0.5 }} />
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 400,
                                  fontSize: "14px",
                                  flex: 1,
                                }}
                              >
                                {loserName}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 400,
                                  fontSize: "16px",
                                  ml: 1,
                                }}
                              >
                                {loserScore}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Right Side - Final Label and Date */}
                          <Box
                            sx={{
                              ml: 2,
                              pl: 2,
                              borderLeft: "1px solid",
                              borderColor: "divider",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              minWidth: "80px",
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 600,
                                fontSize: "10px",
                                color: "text.secondary",
                                textTransform: "uppercase",
                                mb: 0.25,
                              }}
                            >
                              Final
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: "11px",
                                color: "text.secondary",
                              }}
                            >
                              {result.gameDate
                                ? new Date(result.gameDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : new Date(result.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            ) : (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <School sx={{ fontSize: 64, color: "text.secondary", opacity: 0.3, mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No scores recorded yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Record results by clicking the W, L, or D buttons on opponent cards
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Create Opponent Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Opponent</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField label="School/Team Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth autoFocus />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Mascot" value={formData.mascot} onChange={(e) => setFormData({ ...formData, mascot: e.target.value })} fullWidth />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Colors" value={formData.colors} onChange={(e) => setFormData({ ...formData, colors: e.target.value })} fullWidth />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Contact Person" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} fullWidth />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} fullWidth />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} fullWidth />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <LoadingButton onClick={handleCreateOpponent} variant="contained" loading={isCreating} disabled={!formData.name.trim()}>
            Add Opponent
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Score Dialog */}
      <ScoreDialog
        open={scoreDialogOpen}
        onClose={() => setScoreDialogOpen(false)}
        yourTeamName={yourTeamName}
        opponentName={scoreDialogData.opponent?.name || ""}
        resultType={scoreDialogData.resultType}
        onSubmit={handleScoreSubmit}
        loading={createMatchupMutation.isPending}
      />

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} message={snackbar.message} />
    </Box>
  );
}
