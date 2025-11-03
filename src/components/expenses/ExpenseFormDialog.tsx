"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  InputAdornment,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExpenseFormData, GameExpense } from "../../../types/expenses";

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameInfo?: {
    date: string;
    homeTeam: {
      name: string;
      sport: { name: string };
    };
    opponent?: { name: string };
  };
  existingExpense?: GameExpense | null;
}

export function ExpenseFormDialog({
  open,
  onClose,
  gameId,
  gameInfo,
  existingExpense,
}: ExpenseFormDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ExpenseFormData>({
    gameId,
    travelExpense: 0,
    foodExpense: 0,
    clothesExpense: 0,
    giftsExpense: 0,
    notes: "",
  });

  useEffect(() => {
    if (existingExpense) {
      setFormData({
        gameId: existingExpense.gameId,
        travelExpense: existingExpense.travelExpense,
        foodExpense: existingExpense.foodExpense,
        clothesExpense: existingExpense.clothesExpense,
        giftsExpense: existingExpense.giftsExpense,
        notes: existingExpense.notes || "",
      });
    } else {
      setFormData({
        gameId,
        travelExpense: 0,
        foodExpense: 0,
        clothesExpense: 0,
        giftsExpense: 0,
        notes: "",
      });
    }
  }, [existingExpense, gameId, open]);

  const mutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save expense");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (field: keyof ExpenseFormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const totalExpense =
    Number(formData.travelExpense) +
    Number(formData.foodExpense) +
    Number(formData.clothesExpense) +
    Number(formData.giftsExpense);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {existingExpense ? "Edit Game Expense" : "Add Game Expense"}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {gameInfo && (
            <Box sx={{ mb: 3, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Game Details
              </Typography>
              <Typography variant="body2">
                <strong>{gameInfo.homeTeam.sport.name}</strong> -{" "}
                {gameInfo.homeTeam.name}
                {gameInfo.opponent && ` vs ${gameInfo.opponent.name}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {new Date(gameInfo.date).toLocaleDateString()}
              </Typography>
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Travel Expense"
                type="number"
                value={formData.travelExpense}
                onChange={(e) =>
                  handleChange("travelExpense", parseFloat(e.target.value) || 0)
                }
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  inputProps: { min: 0, step: 0.01 },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Food Expense"
                type="number"
                value={formData.foodExpense}
                onChange={(e) =>
                  handleChange("foodExpense", parseFloat(e.target.value) || 0)
                }
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  inputProps: { min: 0, step: 0.01 },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Clothes Expense"
                type="number"
                value={formData.clothesExpense}
                onChange={(e) =>
                  handleChange("clothesExpense", parseFloat(e.target.value) || 0)
                }
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  inputProps: { min: 0, step: 0.01 },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Gifts Expense"
                type="number"
                value={formData.giftsExpense}
                onChange={(e) =>
                  handleChange("giftsExpense", parseFloat(e.target.value) || 0)
                }
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  inputProps: { min: 0, step: 0.01 },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: "primary.main",
                  color: "white",
                  borderRadius: 1,
                  textAlign: "center",
                }}
              >
                <Typography variant="h6">
                  Total: ${totalExpense.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
