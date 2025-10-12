"use client";

import { useState, useEffect } from "react";
import { ReactSortable } from "react-sortablejs";
import { useQuery } from "@tanstack/react-query";
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
  Divider,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { Add, DragIndicator, Edit, Delete, Save, Cancel, School, Phone, Email, Person, ArrowForward, Close, Check, NavigateNext, SkipNext } from "@mui/icons-material";
import { useOpponentsStore } from "@/store/OpponentStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingButton } from "@/components/utils/LoadingButton";

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
}

export default function OpponentsPage() {
  const { opponents, isLoading, isDragging, isCreating, setOpponents, setLoading, setDragging, setCreating, addOpponent, updateOpponent, deleteOpponent, reorderOpponents } = useOpponentsStore();

  const queryClient = useQueryClient();

  // Dialog and form states
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
  const [selectedOpponents, setSelectedOpponents] = useState<any[]>([]);
  const [matchupStep, setMatchupStep] = useState<"select" | "form">("select");
  const [gameFormData, setGameFormData] = useState<GameFormData>({
    date: new Date().toISOString().split("T")[0],
    time: "",
    venueId: "",
    status: "SCHEDULED",
    notes: "",
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as any,
  });

  // Detect if mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Fetch data
  useEffect(() => {
    fetchOpponents();
  }, []);

  const { data: teamsResponse } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams");
      return res.json();
    },
  });

  const { data: venuesResponse } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const res = await fetch("/api/venues");
      return res.json();
    },
  });

  const teams = teamsResponse?.data || [];
  const venues = venuesResponse?.data || [];

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: async (gameData: any) => {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gameData),
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
      });
    },
    onError: (error: any) => {
      showSnackbar(error.message || "Failed to create game", "error");
    },
  });

  const fetchOpponents = async () => {
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
  };

  const handleCreateOpponent = async () => {
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
  };

  const handleUpdateOpponent = async (id: string) => {
    const opponent = opponents.find((o) => o.id === id);
    if (!opponent) return;

    try {
      const res = await fetch(`/api/opponents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opponent),
      });

      if (res.ok) {
        setEditingId(null);
        showSnackbar("Opponent updated successfully", "success");
      }
    } catch (error) {
      showSnackbar("Failed to update opponent", "error");
    }
  };

  const handleDeleteOpponent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this opponent?")) return;

    try {
      const res = await fetch(`/api/opponents/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        deleteOpponent(id);
        showSnackbar("Opponent deleted successfully", "success");
      }
    } catch (error) {
      showSnackbar("Failed to delete opponent", "error");
    }
  };

  const persistReorderedOpponents = async (newOrder: any[]) => {
    reorderOpponents(newOrder);

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
  };

  const handleOpponentClick = (opponent: any) => {
    if (selectedOpponents.length < 2 && !selectedOpponents.find((o) => o.id === opponent.id)) {
      setSelectedOpponents([...selectedOpponents, opponent]);
    }
  };

  const handleRemoveFromMatchup = (opponentId: string) => {
    setSelectedOpponents(selectedOpponents.filter((o) => o.id !== opponentId));
  };

  const handleNextStep = () => {
    setMatchupStep("form");
  };

  const handleSkipForm = () => {
    handleSubmitGame(true);
  };

  const handleSubmitGame = async (skipOptional = false) => {
    if (selectedOpponents.length !== 2) {
      showSnackbar("Please select exactly 2 opponents", "error");
      return;
    }

    // Find a matching team (you'll need to select sport/level)
    const homeTeam = teams[0]; // You might want to add team selection

    if (!homeTeam) {
      showSnackbar("No teams available. Please create a team first.", "error");
      return;
    }

    const gameData = {
      date: new Date(gameFormData.date).toISOString(),
      time: skipOptional ? null : gameFormData.time || null,
      homeTeamId: homeTeam.id,
      isHome: false, // Assuming away game when creating matchup
      opponentId: selectedOpponents[1].id, // Second selected is the opponent
      venueId: skipOptional ? null : gameFormData.venueId || null,
      status: gameFormData.status,
      notes: skipOptional ? null : gameFormData.notes || null,
    };

    createGameMutation.mutate(gameData);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      mascot: "",
      colors: "",
      contact: "",
      phone: "",
      email: "",
      notes: "",
    });
  };

  const showSnackbar = (message: string, severity: string) => {
    setSnackbar({ open: true, message, severity });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Opponents Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Drag to reorder your opponents list or create a new matchup
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenCreateDialog(true)} sx={{ textTransform: "none" }}>
          Add Opponent
        </Button>
      </Box>

      {/* Two Column Layout */}
      <Grid container spacing={3}>
        {/* Left Column - Opponents List */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {opponents.length > 0 ? (
            <ReactSortable
              list={opponents}
              setList={persistReorderedOpponents}
              animation={150}
              delayOnTouchStart={isMobile}
              delay={isMobile ? 200 : 0}
              onStart={() => setDragging(true)}
              onEnd={() => setDragging(false)}
              handle=".drag-handle"
              className="opponents-list"
            >
              {opponents.map((opponent) => (
                <Card
                  key={opponent.id}
                  sx={{
                    mb: 2,
                    opacity: isDragging ? 0.8 : 1,
                    transition: "all 0.3s ease",
                    "&:hover": { boxShadow: 4 },
                    cursor: selectedOpponents.length < 2 ? "pointer" : "default",
                    border: selectedOpponents.find((o) => o.id === opponent.id) ? "2px solid" : "1px solid",
                    borderColor: selectedOpponents.find((o) => o.id === opponent.id) ? "primary.main" : "divider",
                  }}
                  onClick={() => editingId !== opponent.id && handleOpponentClick(opponent)}
                >
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid size="auto">
                        <IconButton className="drag-handle" sx={{ cursor: "grab", "&:active": { cursor: "grabbing" } }}>
                          <DragIndicator />
                        </IconButton>
                      </Grid>

                      <Grid size="grow">
                        {editingId === opponent.id ? (
                          <Stack spacing={2}>
                            <TextField label="School/Team Name" value={opponent.name} onChange={(e) => updateOpponent(opponent.id, { name: e.target.value })} size="small" fullWidth />
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Mascot" value={opponent.mascot || ""} onChange={(e) => updateOpponent(opponent.id, { mascot: e.target.value })} size="small" fullWidth />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Colors" value={opponent.colors || ""} onChange={(e) => updateOpponent(opponent.id, { colors: e.target.value })} size="small" fullWidth />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Contact Person" value={opponent.contact || ""} onChange={(e) => updateOpponent(opponent.id, { contact: e.target.value })} size="small" fullWidth />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Phone" value={opponent.phone || ""} onChange={(e) => updateOpponent(opponent.id, { phone: e.target.value })} size="small" fullWidth />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <TextField label="Email" value={opponent.email || ""} onChange={(e) => updateOpponent(opponent.id, { email: e.target.value })} size="small" fullWidth />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <TextField
                                  label="Notes"
                                  value={opponent.notes || ""}
                                  onChange={(e) => updateOpponent(opponent.id, { notes: e.target.value })}
                                  size="small"
                                  fullWidth
                                  multiline
                                  rows={2}
                                />
                              </Grid>
                            </Grid>
                          </Stack>
                        ) : (
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {opponent.name}
                            </Typography>
                            {opponent.mascot && (
                              <Typography variant="body2" color="text.secondary">
                                Mascot: {opponent.mascot}
                              </Typography>
                            )}
                            {opponent.colors && <Chip label={opponent.colors} size="small" sx={{ mt: 1 }} />}
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              {opponent.contact && (
                                <Grid size="auto">
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Person fontSize="small" color="action" />
                                    <Typography variant="body2">{opponent.contact}</Typography>
                                  </Box>
                                </Grid>
                              )}
                              {opponent.phone && (
                                <Grid size="auto">
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Phone fontSize="small" color="action" />
                                    <Typography variant="body2">{opponent.phone}</Typography>
                                  </Box>
                                </Grid>
                              )}
                              {opponent.email && (
                                <Grid size="auto">
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Email fontSize="small" color="action" />
                                    <Typography variant="body2">{opponent.email}</Typography>
                                  </Box>
                                </Grid>
                              )}
                            </Grid>
                          </Box>
                        )}
                      </Grid>

                      <Grid size="auto">
                        {editingId === opponent.id ? (
                          <Stack direction="row" spacing={1}>
                            <IconButton
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateOpponent(opponent.id);
                              }}
                            >
                              <Save />
                            </IconButton>
                            <IconButton
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(null);
                                fetchOpponents();
                              }}
                            >
                              <Cancel />
                            </IconButton>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1}>
                            <IconButton
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(opponent.id);
                              }}
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOpponent(opponent.id);
                              }}
                            >
                              <Delete />
                            </IconButton>
                          </Stack>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </ReactSortable>
          ) : (
            <Paper sx={{ p: 6, textAlign: "center" }}>
              <School sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No opponents added yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Click "Add Opponent" to get started
              </Typography>
            </Paper>
          )}
        </Grid>

        {/* Right Column - Matchup Creator */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper
            sx={{
              p: 3,
              position: "sticky",
              top: 20,
              minHeight: 400,
              border: "2px dashed",
              borderColor: selectedOpponents.length === 2 ? "primary.main" : "divider",
              transition: "all 0.3s",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Create Matchup
            </Typography>

            <Stepper activeStep={matchupStep === "select" ? 0 : 1} sx={{ mb: 3 }}>
              <Step>
                <StepLabel>Select Teams</StepLabel>
              </Step>
              <Step>
                <StepLabel>Game Details</StepLabel>
              </Step>
            </Stepper>

            {matchupStep === "select" ? (
              <>
                {selectedOpponents.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 6,
                      color: "text.secondary",
                    }}
                  >
                    <School sx={{ fontSize: 48, mb: 2 }} />
                    <Typography variant="body2">Click on two opponents from the list to create a matchup</Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Maximum 2 teams
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {/* First Team Card */}
                    <Card
                      elevation={2}
                      sx={{
                        position: "relative",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "white",
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveFromMatchup(selectedOpponents[0].id)}
                        sx={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          color: "white",
                          bgcolor: "rgba(0,0,0,0.3)",
                          "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
                        }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                      <CardContent sx={{ pb: "16px !important" }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16 }}>
                          {selectedOpponents[0].name}
                        </Typography>
                        {selectedOpponents[0].mascot && (
                          <Typography variant="body2" sx={{ opacity: 0.9, fontSize: 13 }}>
                            {selectedOpponents[0].mascot}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>

                    {/* VS Indicator */}
                    {selectedOpponents.length === 2 && (
                      <Box
                        sx={{
                          textAlign: "center",
                          position: "relative",
                          "&::before, &::after": {
                            content: '""',
                            position: "absolute",
                            width: 2,
                            height: 20,
                            bgcolor: "primary.main",
                            left: "50%",
                            transform: "translateX(-50%)",
                          },
                          "&::before": { top: -20 },
                          "&::after": { bottom: -20 },
                        }}
                      >
                        <Chip
                          label="VS"
                          color="primary"
                          sx={{
                            fontWeight: 700,
                            fontSize: 16,
                            px: 2,
                          }}
                        />
                      </Box>
                    )}

                    {/* Second Team Card or Placeholder */}
                    {selectedOpponents.length === 2 ? (
                      <Card
                        elevation={2}
                        sx={{
                          position: "relative",
                          background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                          color: "white",
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveFromMatchup(selectedOpponents[1].id)}
                          sx={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            color: "white",
                            bgcolor: "rgba(0,0,0,0.3)",
                            "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
                          }}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                        <CardContent sx={{ pb: "16px !important" }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16 }}>
                            {selectedOpponents[1].name}
                          </Typography>
                          {selectedOpponents[1].mascot && (
                            <Typography variant="body2" sx={{ opacity: 0.9, fontSize: 13 }}>
                              {selectedOpponents[1].mascot}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Paper
                        sx={{
                          p: 3,
                          textAlign: "center",
                          border: "2px dashed",
                          borderColor: "divider",
                          bgcolor: "action.hover",
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Select one more opponent
                        </Typography>
                      </Paper>
                    )}
                  </Stack>
                )}

                {/* Next Button */}
                <Box sx={{ mt: 3 }}>
                  <Button fullWidth variant="contained" endIcon={<NavigateNext />} onClick={handleNextStep} disabled={selectedOpponents.length !== 2} sx={{ textTransform: "none" }}>
                    Next: Add Game Details
                  </Button>

                  {selectedOpponents.length > 0 && (
                    <Button fullWidth variant="text" onClick={() => setSelectedOpponents([])} sx={{ mt: 1, textTransform: "none" }}>
                      Clear Selection
                    </Button>
                  )}
                </Box>
              </>
            ) : (
              /* Game Details Form */
              <Stack spacing={2}>
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
                      {venue.name}
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
                />

                {/* Action Buttons */}
                <Stack spacing={1} sx={{ mt: 2 }}>
                  <LoadingButton fullWidth variant="contained" startIcon={<Check />} onClick={() => handleSubmitGame(false)} loading={createGameMutation.isPending} loadingText="Creating Game...">
                    Create Game
                  </LoadingButton>

                  <Button fullWidth variant="outlined" startIcon={<SkipNext />} onClick={handleSkipForm} disabled={createGameMutation.isPending} sx={{ textTransform: "none" }}>
                    Skip Optional Fields
                  </Button>

                  <Button fullWidth variant="text" onClick={() => setMatchupStep("select")} disabled={createGameMutation.isPending} sx={{ textTransform: "none" }}>
                    Back to Selection
                  </Button>
                </Stack>

                {/* Success Message */}
                {createGameMutation.isSuccess && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Game created successfully! Check the Games table for the new entry.
                  </Alert>
                )}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Create Opponent Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
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
          <Button
            onClick={() => {
              setOpenCreateDialog(false);
              resetForm();
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <LoadingButton variant="contained" onClick={handleCreateOpponent} disabled={!formData.name.trim()} loading={isCreating} loadingText="Creating..." startIcon={!isCreating && <Save />}>
            Create Opponent
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
