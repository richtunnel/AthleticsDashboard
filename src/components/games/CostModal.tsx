"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, CircularProgress, Alert, Divider } from "@mui/material";
import { AttachMoney, TrendingUp, AccountBalanceWallet } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";

interface CostModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  currentCost?: number | null;
  onSave: (cost: number) => Promise<void>;
  allGamesCosts?: number;
  monthlyBudget?: number | null;
}

export function CostModal({ open, onClose, gameId, gameName, currentCost, onSave, allGamesCosts = 0, monthlyBudget = null }: CostModalProps) {
  const [costInput, setCostInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCostInput(currentCost ? currentCost.toFixed(2) : "");
      setError(null);
    }
  }, [open, currentCost]);

  // Calculate totals
  const currentTotal = allGamesCosts - (currentCost || 0); // Remove current game cost
  const newCost = parseFloat(costInput) || 0;
  const newTotal = currentTotal + newCost;
  const remainingBudget = monthlyBudget ? monthlyBudget - newTotal : null;
  const budgetPercentage = monthlyBudget ? (newTotal / monthlyBudget) * 100 : null;

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Only allow numbers and one decimal point
    const cleanedValue = value.replace(/[^0-9.]/g, "");

    // Ensure only one decimal point
    const parts = cleanedValue.split(".");
    if (parts.length > 2) {
      setCostInput(parts[0] + "." + parts.slice(1).join(""));
      return;
    }

    setCostInput(cleanedValue);
    setError(null);
  };

  const handleSave = async () => {
    const costValue = parseFloat(costInput);

    if (costInput && isNaN(costValue)) {
      setError("Please enter a valid number");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(costValue);
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to save cost");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setCostInput("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AttachMoney />
          <Typography variant="h6">Game Cost</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {gameName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Enter the cost for this game
          </Typography>
          <TextField
            placeholder="00.00"
            value={costInput}
            onChange={handleCostChange}
            fullWidth
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              sx: {
                fontSize: "1.5rem",
                fontWeight: 600,
                "& .MuiOutlinedInput-input": {
                  textAlign: "center",
                },
              },
            }}
            autoFocus
            error={!!error}
          />
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Total and Budget Summary */}
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                New cost for this game
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                ${costInput || "0.00"}
              </Typography>
            </Box>

            <Box
              sx={{
                p: 3,
                bgcolor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)",
                borderRadius: 2,
                mb: 2,
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                <TrendingUp sx={{ color: theme.palette.primary.main }} />
                <Typography variant="h5" fontWeight={600}>
                  ${newTotal.toFixed(2)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Total cost across all games
              </Typography>
            </Box>

            {monthlyBudget && (
              <>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <AccountBalanceWallet sx={{ color: theme.palette.success.main }} />
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="h5" fontWeight={600} color={remainingBudget !== null && remainingBudget >= 0 ? "success.main" : "error.main"}>
                      ${remainingBudget !== null ? remainingBudget.toFixed(2) : "0.00"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Remaining budget
                    </Typography>
                  </Box>
                </Box>

                {budgetPercentage !== null && (
                  <Box sx={{ mt: 2 }}>
                    <Box
                      sx={{
                        height: 8,
                        bgcolor: "divider",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          height: "100%",
                          width: `${Math.min(budgetPercentage, 100)}%`,
                          bgcolor: budgetPercentage > 90 ? "error.main" : budgetPercentage > 70 ? "warning.main" : "success.main",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {budgetPercentage.toFixed(1)}% of ${monthlyBudget.toFixed(2)} budget used
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} sx={{ color: "text.secondary" }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isSaving || (!!costInput && isNaN(parseFloat(costInput)))}
          sx={{
            color: theme.palette.mode === "dark" ? "#fff" : "",
            bgcolor: "#0f172a",
            "&:hover": { bgcolor: "#1e293b" },
          }}
        >
          {isSaving ? <CircularProgress size={20} sx={{ color: "white" }} /> : "Save Cost"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
