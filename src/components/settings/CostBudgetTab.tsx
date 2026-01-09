"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Grid,
} from "@mui/material";
import { AttachMoney, TrendingUp, AccountBalanceWallet } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";

async function fetchCostBudgetData() {
  const [settingsRes, gamesRes] = await Promise.all([
    fetch("/api/user/cost-budget"),
    fetch("/api/games"),
  ]);

  if (!settingsRes.ok || !gamesRes.ok) {
    throw new Error("Failed to fetch cost budget data");
  }

  const settings = await settingsRes.json();
  const games = await gamesRes.json();

  return {
    settings,
    games: games.data?.games || [],
  };
}

export function CostBudgetTab() {
  const theme = useTheme();
  const [budgetInput, setBudgetInput] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["costBudgetData"],
    queryFn: fetchCostBudgetData,
    enabled: true,
  });

  const handleBudgetUpdate = async () => {
    try {
      await fetch("/api/user/cost-budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          monthlyBudget: parseFloat(budgetInput),
        }),
      });
      refetch();
    } catch (err) {
      console.error("Failed to update budget:", err);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load cost and budget data. Please try again.
      </Alert>
    );
  }

  const settings = data?.settings || {};
  const games = data?.games || [];
  const currentBudget = settings.monthlyBudget || 0;
  const isEnabled = settings.costBudgetEnabled || false;

  // Show disabled state if feature is not enabled
  if (!isEnabled) {
    return (
      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
            <AttachMoney sx={{ color: "text.secondary" }} /> Cost & Budget Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enable the Cost & Budget Calculator above to track and manage your game expenses.
          </Typography>
          <Alert severity="info">
            The Cost & Budget Calculator is currently disabled. Toggle the feature above to enable it and start tracking your game expenses.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Calculate total costs
  const totalCost = games.reduce((sum: number, game: any) => sum + (game.cost || 0), 0);
  const remainingBudget = currentBudget - totalCost;
  const budgetUsed = currentBudget > 0 ? (totalCost / currentBudget) * 100 : 0;

  // Get games with costs
  const gamesWithCosts = games.filter((game: any) => game.cost && game.cost > 0);
  const totalGamesWithCosts = gamesWithCosts.length;
  const averageCost = totalGamesWithCosts > 0 ? totalCost / totalGamesWithCosts : 0;

  return (
    <Card sx={{ mb: 3, boxShadow: "none!important" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
          Cost & Budget Analysis
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Track and analyze your game expenses throughout the month.
        </Typography>

        <Grid container spacing={3}>
          {/* Budget Overview */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <AccountBalanceWallet color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    Monthly Budget
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    + Add Budget
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <TextField
                      placeholder="00.00"
                      value={budgetInput}
                      onChange={(e) => {
                        // Only allow numbers and one decimal point
                        const value = e.target.value.replace(/[^0-9.]/g, "");
                        setBudgetInput(value);
                      }}
                      disabled={false}
                      fullWidth
                      size="small"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          fontSize: "1rem",
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleBudgetUpdate}
                      disabled={!budgetInput || isNaN(parseFloat(budgetInput))}
                      sx={{
                        color: theme.palette.mode === "dark" ? "#fff" : "",
                        bgcolor: "#0f172a",
                        "&:hover": { bgcolor: "#1e293b" },
                      }}
                    >
                      Set
                    </Button>
                  </Box>
                </Box>

                {currentBudget > 0 && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)",
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Current Budget
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        ${currentBudget.toFixed(2)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Spent
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="error.main">
                        ${totalCost.toFixed(2)}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">
                        Remaining
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={remainingBudget >= 0 ? "success.main" : "error.main"}
                      >
                        ${remainingBudget.toFixed(2)}
                      </Typography>
                    </Box>
                    {currentBudget > 0 && (
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
                              width: `${Math.min(budgetUsed, 100)}%`,
                              bgcolor: budgetUsed > 90 ? "error.main" : budgetUsed > 70 ? "warning.main" : "success.main",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                          {budgetUsed.toFixed(1)}% of budget used
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Cost Summary */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <AttachMoney color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    Cost Summary
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    bgcolor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)",
                    borderRadius: 2,
                    mb: 2,
                  }}
                >
                  <Typography variant="h4" fontWeight={600} sx={{ mb: 0.5 }}>
                    ${totalCost.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total cost across {totalGamesWithCosts} game{totalGamesWithCosts !== 1 ? "s" : ""}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Games with costs
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {totalGamesWithCosts}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Average cost
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      ${averageCost.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total games
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {games.length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent Costs Table */}
        {gamesWithCosts.length > 0 && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <TrendingUp color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Games with Costs
                </Typography>
              </Box>
              <Box sx={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${theme.palette.divider}` }}>
                        Date
                      </th>
                      <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${theme.palette.divider}` }}>
                        Opponent
                      </th>
                      <th style={{ textAlign: "right", padding: "8px", borderBottom: `1px solid ${theme.palette.divider}` }}>
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gamesWithCosts.slice(0, 10).map((game: any) => (
                      <tr key={game.id}>
                        <td style={{ padding: "8px", borderBottom: `1px solid ${theme.palette.divider}` }}>
                          {new Date(game.date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "8px", borderBottom: `1px solid ${theme.palette.divider}` }}>
                          {game.opponent?.name || "N/A"}
                        </td>
                        <td style={{ padding: "8px", borderBottom: `1px solid ${theme.palette.divider}`, textAlign: "right", fontWeight: 600 }}>
                          ${game.cost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {gamesWithCosts.length > 10 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Showing 10 of {gamesWithCosts.length} games with costs
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {gamesWithCosts.length === 0 && (
          <Alert severity="info" sx={{ mt: 3 }}>
            No costs have been entered yet. Go to the Game Center to add costs to your games.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
