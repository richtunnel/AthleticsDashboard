"use client";

import { useState, useEffect } from "react";
import { ReactSortable } from "react-sortablejs";
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
} from "@mui/material";
import {
  Add,
  DragIndicator,
  Edit,
  Delete,
  Save,
  Cancel,
  School,
  Phone,
  Email,
  Person,
} from "@mui/icons-material";
import { useOpponentsStore } from "@/store/OpponentStore";

interface OpponentFormData {
  name: string;
  mascot: string;
  colors: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
}

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
    updateOpponent,
    deleteOpponent,
    reorderOpponents,
  } = useOpponentsStore();

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
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as any });
  
  // Detect if mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Fetch opponents on mount
  useEffect(() => {
    fetchOpponents();
  }, []);

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
    // Optimistically update UI
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
      // Rollback on failure
      fetchOpponents();
    } finally {
      setDragging(false);
    }
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
            Drag to reorder your opponents list
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenCreateDialog(true)}
          sx={{ textTransform: "none" }}
        >
          Add Opponent
        </Button>
      </Box>

      {/* Opponents List */}
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
              }}
            >
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs="auto">
                    <IconButton
                      className="drag-handle"
                      sx={{ cursor: "grab", "&:active": { cursor: "grabbing" } }}
                    >
                      <DragIndicator />
                    </IconButton>
                  </Grid>
                  
                  <Grid item xs>
                    {editingId === opponent.id ? (
                      <Stack spacing={2}>
                        <TextField
                          label="School/Team Name"
                          value={opponent.name}
                          onChange={(e) => updateOpponent(opponent.id, { name: e.target.value })}
                          size="small"
                          fullWidth
                        />
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label="Mascot"
                              value={opponent.mascot || ""}
                              onChange={(e) => updateOpponent(opponent.id, { mascot: e.target.value })}
                              size="small"
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label="Colors"
                              value={opponent.colors || ""}
                              onChange={(e) => updateOpponent(opponent.id, { colors: e.target.value })}
                              size="small"
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label="Contact Person"
                              value={opponent.contact || ""}
                              onChange={(e) => updateOpponent(opponent.id, { contact: e.target.value })}
                              size="small"
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label="Phone"
                              value={opponent.phone || ""}
                              onChange={(e) => updateOpponent(opponent.id, { phone: e.target.value })}
                              size="small"
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              label="Email"
                              value={opponent.email || ""}
                              onChange={(e) => updateOpponent(opponent.id, { email: e.target.value })}
                              size="small"
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={12}>
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
                        {opponent.colors && (
                          <Chip
                            label={opponent.colors}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        )}
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          {opponent.contact && (
                            <Grid item xs="auto">
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Person fontSize="small" color="action" />
                                <Typography variant="body2">{opponent.contact}</Typography>
                              </Box>
                            </Grid>
                          )}
                          {opponent.phone && (
                            <Grid item xs="auto">
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Phone fontSize="small" color="action" />
                                <Typography variant="body2">{opponent.phone}</Typography>
                              </Box>
                            </Grid>
                          )}
                          {opponent.email && (
                            <Grid item xs="auto">
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
                  
                  <Grid item xs="auto">
                    {editingId === opponent.id ? (
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          color="primary"
                          onClick={() => handleUpdateOpponent(opponent.id)}
                        >
                          <Save />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => {
                            setEditingId(null);
                            fetchOpponents(); // Reset changes
                          }}
                        >
                          <Cancel />
                        </IconButton>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          color="primary"
                          onClick={() => setEditingId(opponent.id)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteOpponent(opponent.id)}
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

      {/* Create Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Opponent</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="School/Team Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              autoFocus
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Mascot"
                  value={formData.mascot}
                  onChange={(e) => setFormData({ ...formData, mascot: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Colors"
                  value={formData.colors}
                  onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                  fullWidth
                  placeholder="e.g., Blue & Gold"
                />
              </Grid>
            </Grid>
            <TextField
              label="Contact Person"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenCreateDialog(false);
            resetForm();
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateOpponent}
            disabled={isCreating || !formData.name.trim()}
            startIcon={isCreating ? <CircularProgress size={20} /> : <Save />}
          >
            {isCreating ? "Creating..." : "Create Opponent"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}