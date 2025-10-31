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
  Alert,
  Snackbar,
  Grid,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Skeleton,
} from "@mui/material";
import { Add, DragIndicator, Edit, Delete, Save, Cancel, School, Phone, Email, Person, Close, Check, NavigateNext, SkipNext, Warning } from "@mui/icons-material";
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

interface GameFormData {
  date: string;
  time: string;
  venueId: string;
  status: string;
  notes: string;
  homeTeamId: string;
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

// ============================================================================
// MEMOIZED COMPONENTS FOR PERFORMANCE
// ============================================================================

const OpponentCard = memo(({ opponent, isSelected, isEditing, editingId, onEdit, onUpdate, onDelete, onCancelEdit, updateField, onSelect }: any) => {
  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) {
        e.stopPropagation();
        return;
      }
      onSelect(opponent);
    },
    [isEditing, onSelect, opponent]
  );

  return (
    <Card
      sx={{
        mb: 2,
        transition: "all 0.2s ease",
        cursor: !isEditing ? "pointer" : "default",
        border: isSelected ? "2px solid" : "1px solid",
        borderColor: isSelected ? "primary.main" : "divider",
        boxShadow: "none",
        "&:hover": !isEditing ? { borderColor: "primary.light" } : {},
        userSelect: "none",
      }}
      onClick={handleCardClick}
    >
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid size="auto">
            <IconButton
              className="drag-handle"
              sx={{
                cursor: "grab",
                "&:active": { cursor: "grabbing" },
                touchAction: "none",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <DragIndicator />
            </IconButton>
          </Grid>

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
              <Box>
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
// MAIN COMPONENT
// ============================================================================

export default function OpponentsPage() {
  const {
    opponents,
    isLoading,
    isDragging,
    isCreating,
    setOpponents,
    setLoading,
    setDragging,
    setCreating,
    addOpponent,
    updateOpponent: storeUpdateOpponent,
    deleteOpponent,
    reorderOpponents,
  } = useOpponentsStore();

  const queryClient = useQueryClient();

  // Refs for performance
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>(null);

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

  // Matchup creator states
  const [selectedOpponents, setSelectedOpponents] = useState<Opponent[]>([]);
  const [matchupStep, setMatchupStep] = useState<"select" | "form">("select");
  const [gameFormData, setGameFormData] = useState<GameFormData>({
    date: new Date().toISOString().split("T")[0],
    time: "",
    venueId: "",
    status: "SCHEDULED",
    notes: "",
    homeTeamId: "",
  });

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

  // ============================================================================
  // DATA FETCHING WITH CACHING
  // ============================================================================

  const { data: teamsResponse } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: venuesResponse } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const res = await fetch("/api/venues");
      if (!res.ok) throw new Error("Failed to fetch venues");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const teams = useMemo(() => teamsResponse?.data || [], [teamsResponse?.data]);
  const venues = useMemo(() => venuesResponse?.data || [], [venuesResponse?.data]);

  // ============================================================================
  // MUTATIONS WITH OPTIMISTIC UPDATES
  // ============================================================================

  const createGameMutation = useMutation({
    mutationFn: async (gameData: any) => {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gameData),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create game");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      showSnackbar("Game created successfully! 🎉", "success");

      // Reset matchup creator
      setSelectedOpponents([]);
      setMatchupStep("select");
      setGameFormData({
        date: new Date().toISOString().split("T")[0],
        time: "",
        venueId: "",
        status: "SCHEDULED",
        notes: "",
        homeTeamId: "",
      });
    },
    onError: (error: any) => {
      if (error.name === "AbortError") return;
      showSnackbar(error.message || "Failed to create game", "error");
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
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
      // Optimistic update
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

  // ============================================================================
  // HANDLERS WITH DEBOUNCING
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
        } finally {
          setDragging(false);
        }
      }, 500),
    [fetchOpponents, setDragging]
  );

  const handleReorder = useCallback(
    (newOrder: Opponent[]) => {
      reorderOpponents(newOrder);
      debouncedReorder(newOrder);
    },
    [reorderOpponents, debouncedReorder]
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

  const handleOpponentSelect = useCallback(
    (opponent: Opponent) => {
      if (editingId) return;

      setSelectedOpponents((prev) => {
        const isAlreadySelected = prev.find((o) => o.id === opponent.id);

        if (isAlreadySelected) {
          return prev.filter((o) => o.id !== opponent.id);
        }

        if (prev.length >= 2) {
          return prev;
        }

        return [...prev, opponent];
      });
    },
    [editingId]
  );

  const handleRemoveFromMatchup = useCallback((opponentId: string) => {
    setSelectedOpponents((prev) => prev.filter((o) => o.id !== opponentId));
  }, []);

  const handleNextStep = useCallback(() => {
    setMatchupStep("form");
  }, []);

  const handleSkipForm = useCallback(() => {
    handleSubmitGame(true);
  }, []);

  const handleSubmitGame = useCallback(
    (skipOptional = false) => {
      if (selectedOpponents.length !== 2) {
        showSnackbar("Please select exactly 2 opponents", "error");
        return;
      }

      const selectedTeamId = gameFormData.homeTeamId || teams[0]?.id;

      if (!selectedTeamId) {
        showSnackbar("No teams available. Please create a team first.", "error");
        return;
      }

      const gameData = {
        date: new Date(gameFormData.date).toISOString(),
        time: skipOptional ? null : gameFormData.time || null,
        homeTeamId: selectedTeamId,
        isHome: false,
        opponentId: selectedOpponents[1].id,
        venueId: skipOptional ? null : gameFormData.venueId || null,
        status: gameFormData.status,
        notes: skipOptional ? null : gameFormData.notes || null,
      };

      createGameMutation.mutate(gameData);
    },
    [selectedOpponents, gameFormData, teams, createGameMutation]
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      debouncedReorder.cancel();
    };
  }, [debouncedReorder]);

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
            Add Teams & Create Matchups
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add new teams that you'll play here. You can use our custom match maker feature to create games in Game Center.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenCreateDialog(true)} sx={{ textTransform: "none" }}>
          Add Opponent
        </Button>
      </Box>

      {/* Two Column Layout - Right column is larger (7) */}
      <Grid container spacing={3}>
        {/* Left Column - Opponents List (Smaller - 5 columns) */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 16 }}>
              Opponents List
              <Chip label={opponents.length} size="small" sx={{ ml: 1 }} />
            </Typography>

            {opponents.length > 0 ? (
              <ReactSortable
                list={opponents as SortableOpponent[]}
                setList={handleReorder}
                group={{
                  name: "shared",
                  pull: "clone", // Clone instead of move
                  put: false,
                }}
                animation={200}
                delayOnTouchStart={isMobile}
                delay={isMobile ? 200 : 0}
                onStart={() => setDragging(true)}
                onEnd={() => setDragging(false)}
                handle=".drag-handle"
                forceFallback={true}
                fallbackClass="sortable-fallback"
                ghostClass="sortable-ghost"
                chosenClass="sortable-chosen"
                dragClass="sortable-drag"
                filter=".no-drag"
                preventOnFilter={false}
                sort={true} // Enable sorting within the list
                style={{
                  minHeight: 100,
                  maxHeight: "calc(100vh - 250px)",
                  overflowY: "auto",
                  overflowX: "hidden",
                }}
              >
                {opponents.map((opponent) => (
                  <OpponentCard
                    key={opponent.id}
                    opponent={opponent}
                    isSelected={selectedOpponents.some((o) => o.id === opponent.id)}
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
                    onSelect={handleOpponentSelect}
                  />
                ))}
              </ReactSortable>
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

        {/* Right Column - Matchup Creator (Larger - 7 columns) */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper
            elevation={2}
            sx={{
              p: 4,
              position: "sticky",
              top: 20,
              minHeight: 500,
              border: "2px solid",
              borderColor: selectedOpponents.length === 2 ? "primary.main" : "divider",
              transition: "all 0.3s",
              bgcolor: selectedOpponents.length === 2 ? "primary.50" : "background.paper",
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Create Matchup
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {matchupStep === "select" ? "Drag & drop or click 2 opponents to create a game" : "Fill in game details or skip to use defaults"}
            </Typography>

            <Stepper activeStep={matchupStep === "select" ? 0 : 1} sx={{ mb: 4 }}>
              <Step>
                <StepLabel>Select Teams</StepLabel>
              </Step>
              <Step>
                <StepLabel>Game Details</StepLabel>
              </Step>
            </Stepper>

            {matchupStep === "select" ? (
              <>
                {/* DROP ZONE for dragging opponents */}
                <ReactSortable
                  list={selectedOpponents as SortableOpponent[]}
                  setList={(newState) => {
                    // Only keep first 2 items
                    const filtered = newState.slice(0, 2);
                    setSelectedOpponents(filtered);
                  }}
                  group={{
                    name: "shared",
                    put: selectedOpponents.length < 2, // Only allow drops if less than 2
                    pull: false,
                  }}
                  animation={200}
                  sort={false}
                  onAdd={(evt) => {
                    // Ensure we don't exceed 2 opponents
                    if (selectedOpponents.length >= 2) {
                      evt.item.remove();
                    }
                  }}
                  style={{
                    minHeight: 400,
                    padding: 16,
                    borderRadius: 8,
                    border: selectedOpponents.length === 2 ? "2px solid var(--accent)" : "2px dashed var(--border-color)",
                    backgroundColor: selectedOpponents.length === 2 ? "var(--surface-selected)" : "var(--surface-muted)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {selectedOpponents.length === 0 ? (
                    <Box
                      sx={{
                        textAlign: "center",
                        py: 8,
                        color: "text.secondary",
                        borderRadius: 2,
                      }}
                    >
                      <School sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Drop Teams Here
                      </Typography>
                      <Typography variant="body2">Drag & drop or click opponents from the list</Typography>
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Maximum 2 teams required
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={3}>
                      {/* First Team Card */}
                      {selectedOpponents[0] && (
                        <Card
                          elevation={4}
                          sx={{
                            position: "relative",
                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            color: "white",
                            transform: "scale(1)",
                            transition: "transform 0.2s",
                            "&:hover": { transform: "scale(1.02)" },
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveFromMatchup(selectedOpponents[0].id)}
                            sx={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              color: "white",
                              bgcolor: "rgba(0,0,0,0.3)",
                              "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
                              zIndex: 10,
                            }}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                          <CardContent sx={{ pb: "16px !important", pt: 3 }}>
                            <Typography variant="overline" sx={{ opacity: 0.8, fontSize: 11 }}>
                              Team 1
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                              {selectedOpponents[0].name}
                            </Typography>
                            {selectedOpponents[0].mascot && (
                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                {selectedOpponents[0].mascot}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* VS Indicator with connecting lines */}
                      {selectedOpponents.length === 2 && (
                        <Box
                          sx={{
                            textAlign: "center",
                            position: "relative",
                            "&::before, &::after": {
                              content: '""',
                              position: "absolute",
                              width: 3,
                              height: 30,
                              bgcolor: "primary.main",
                              left: "50%",
                              transform: "translateX(-50%)",
                            },
                            "&::before": { top: -30 },
                            "&::after": { bottom: -30 },
                          }}
                        >
                          <Chip
                            label="VS"
                            color="primary"
                            sx={{
                              fontWeight: 700,
                              fontSize: 20,
                              px: 3,
                              py: 2.5,
                              height: "auto",
                            }}
                          />
                        </Box>
                      )}

                      {/* Second Team Card or Placeholder */}
                      {selectedOpponents.length === 2 ? (
                        <Card
                          elevation={4}
                          sx={{
                            position: "relative",
                            background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                            color: "white",
                            transform: "scale(1)",
                            transition: "transform 0.2s",
                            "&:hover": { transform: "scale(1.02)" },
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveFromMatchup(selectedOpponents[1].id)}
                            sx={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              color: "white",
                              bgcolor: "rgba(0,0,0,0.3)",
                              "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
                              zIndex: 10,
                            }}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                          <CardContent sx={{ pb: "16px !important", pt: 3 }}>
                            <Typography variant="overline" sx={{ opacity: 0.8, fontSize: 11 }}>
                              Team 2
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                              {selectedOpponents[1].name}
                            </Typography>
                            {selectedOpponents[1].mascot && (
                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                {selectedOpponents[1].mascot}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <Paper
                          sx={{
                            p: 4,
                            textAlign: "center",
                            border: "3px dashed",
                            borderColor: "primary.main",
                            bgcolor: "primary.50",
                            minHeight: 120,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Box>
                            <Add sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
                            <Typography variant="body1" color="primary.main" fontWeight={600}>
                              Drop or click second opponent
                            </Typography>
                          </Box>
                        </Paper>
                      )}
                    </Stack>
                  )}
                </ReactSortable>

                {/* Action Buttons */}
                <Stack spacing={2} sx={{ mt: 4 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    endIcon={<NavigateNext />}
                    onClick={handleNextStep}
                    disabled={selectedOpponents.length !== 2}
                    sx={{ textTransform: "none", py: 1.5 }}
                  >
                    Next: Add Game Details
                  </Button>

                  {selectedOpponents.length > 0 && (
                    <Button fullWidth variant="outlined" onClick={() => setSelectedOpponents([])} sx={{ textTransform: "none" }}>
                      Clear Selection ({selectedOpponents.length})
                    </Button>
                  )}
                </Stack>
              </>
            ) : (
              /* Game Details Form */
              <Stack spacing={2.5}>
                {/* Team Selection */}
                {teams.length > 0 && (
                  <TextField
                    select
                    label="Your Team (Home Team)"
                    value={gameFormData.homeTeamId}
                    onChange={(e) => setGameFormData({ ...gameFormData, homeTeamId: e.target.value })}
                    fullWidth
                    size="small"
                    required
                  >
                    {teams.map((team: any) => (
                      <MenuItem key={team.id} value={team.id}>
                        {team.sport?.name} - {team.level} ({team.name})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                <TextField
                  label="Game Date"
                  type="date"
                  value={gameFormData.date}
                  onChange={(e) => setGameFormData({ ...gameFormData, date: e.target.value })}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  required
                />

                <TextField
                  label="Game Time (Optional)"
                  type="time"
                  value={gameFormData.time}
                  onChange={(e) => setGameFormData({ ...gameFormData, time: e.target.value })}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />

                <TextField select label="Venue (Optional)" value={gameFormData.venueId} onChange={(e) => setGameFormData({ ...gameFormData, venueId: e.target.value })} fullWidth size="small">
                  <MenuItem value="">
                    <em>Select venue</em>
                  </MenuItem>
                  {venues.map((venue: any) => (
                    <MenuItem key={venue.id} value={venue.id}>
                      {venue.name} - {venue.city}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField select label="Status" value={gameFormData.status} onChange={(e) => setGameFormData({ ...gameFormData, status: e.target.value })} fullWidth size="small">
                  <MenuItem value="SCHEDULED">Scheduled</MenuItem>
                  <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                  <MenuItem value="POSTPONED">Postponed</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                </TextField>

                <TextField
                  label="Notes (Optional)"
                  value={gameFormData.notes}
                  onChange={(e) => setGameFormData({ ...gameFormData, notes: e.target.value })}
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  placeholder="Add any additional notes about this game..."
                />

                {/* Action Buttons */}
                <Stack spacing={1.5} sx={{ mt: 3 }}>
                  <LoadingButton
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={<Check />}
                    onClick={() => handleSubmitGame(false)}
                    loading={createGameMutation.isPending}
                    loadingText="Creating Game..."
                    disabled={!gameFormData.homeTeamId}
                  >
                    Create Game
                  </LoadingButton>

                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<SkipNext />}
                    onClick={handleSkipForm}
                    disabled={createGameMutation.isPending || !gameFormData.homeTeamId}
                    sx={{ textTransform: "none" }}
                  >
                    Skip Optional Fields
                  </Button>

                  <Button fullWidth variant="text" onClick={() => setMatchupStep("select")} disabled={createGameMutation.isPending} sx={{ textTransform: "none" }}>
                    ← Back to Selection
                  </Button>
                </Stack>

                {/* Success Message */}
                {createGameMutation.isSuccess && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Game created successfully!
                    </Typography>
                    <Typography variant="caption">Check the Games table to view your new matchup.</Typography>
                  </Alert>
                )}

                {/* Error Message */}
                {createGameMutation.isError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    <Typography variant="body2">Failed to create game. Please try again.</Typography>
                  </Alert>
                )}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Create Opponent Dialog */}
      <Dialog open={openCreateDialog} onClose={() => !isCreating && setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Opponent</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField label="School/Team Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth required autoFocus />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField label="Mascot" value={formData.mascot} onChange={(e) => setFormData({ ...formData, mascot: e.target.value })} fullWidth />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField label="Colors" value={formData.colors} onChange={(e) => setFormData({ ...formData, colors: e.target.value })} fullWidth placeholder="e.g., Blue & Gold" />
              </Grid>
            </Grid>
            <TextField label="Contact Person" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} fullWidth />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} fullWidth />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} fullWidth />
              </Grid>
            </Grid>
            <TextField label="Notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} fullWidth multiline rows={3} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)} disabled={isCreating}>
            Cancel
          </Button>
          <LoadingButton variant="contained" onClick={handleCreateOpponent} disabled={!formData.name.trim()} loading={isCreating} loadingText="Creating..." startIcon={!isCreating && <Save />}>
            Create Opponent
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Global Styles for Sortable */}
      <style jsx global>{`
        .sortable-ghost {
          opacity: 0.4;
          background: #e3f2fd;
        }

        .sortable-chosen {
          cursor: grabbing !important;
        }

        .sortable-drag {
          opacity: 1;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
        }

        .sortable-fallback {
          opacity: 0.8;
        }
      `}</style>
    </Box>
  );
}
