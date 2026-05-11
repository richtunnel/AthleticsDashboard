"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Chip,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { AttachMoney, TrendingUp, AccountBalanceWallet, ExpandMore, KeyboardArrowDown, Download, Delete, TableChart, Email } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useGamesWorkbookStore } from "@/lib/stores/gamesWorkbookStore";
import { Select, MenuItem, FormControl, InputLabel } from "@mui/material";

async function fetchCostBudgetData(workbookId?: string | null) {
  const params = new URLSearchParams();
  if (workbookId && workbookId !== "all") {
    params.append("workbookId", workbookId);
  }
  
  const [settingsRes, gamesRes] = await Promise.all([
    fetch("/api/user/cost-budget"),
    fetch(`/api/games?${params}&limit=1000`), // Increase limit to get more games for cost analysis
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
  const queryClient = useQueryClient();
  const { workbooks } = useGamesWorkbookStore();
  const [budgetInput, setBudgetInput] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [selectedWorkbookId, setSelectedWorkbookId] = useState<string>("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["costBudgetData", selectedWorkbookId],
    queryFn: () => fetchCostBudgetData(selectedWorkbookId),
    enabled: true,
  });

  // Email preference: whether the cost column is included when sending games
  const { data: emailPrefsData } = useQuery({
    queryKey: ["emailSettings"],
    queryFn: async () => {
      const res = await fetch("/api/user/table-preferences?table=email-settings");
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as { includeCostInEmail?: boolean } | null;
    },
  });

  const includeCostInEmail = emailPrefsData?.includeCostInEmail ?? false;

  const saveEmailPref = useCallback(async (checked: boolean) => {
    await fetch("/api/user/table-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "email-settings",
        preferences: { includeCostInEmail: checked },
      }),
    });
    queryClient.invalidateQueries({ queryKey: ["emailSettings"] });
  }, [queryClient]);

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

  const handleResetData = async () => {
    if (!confirm("Are you sure you want to reset all cost and budget data? This will clear your monthly budget and all costs associated with your games. This action cannot be undone.")) {
      return;
    }
    
    try {
      const res = await fetch("/api/user/cost-budget", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to reset data");
      setBudgetInput("");
      refetch();
    } catch (err) {
      console.error("Failed to reset budget data:", err);
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
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
      <Accordion 
        expanded={expanded} 
        onChange={() => setExpanded(!expanded)}
        sx={{ 
          boxShadow: "none!important",
          "&:before": { display: "none" },
          "&.Mui-expanded": { margin: 0 }
        }}
      >
        <AccordionSummary
          expandIcon={<KeyboardArrowDown />}
          aria-controls="cost-budget-content"
          id="cost-budget-header"
          sx={{ 
            px: 3, 
            py: 2,
            "& .MuiAccordionSummary-content": {
              margin: 0,
              alignItems: "center"
            },
            "& .MuiAccordionSummary-expandIcon": {
              color: "text.secondary"
            }
          }}
        >
          <Typography variant="h6" sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" }, fontWeight: 600 }}>
            <AttachMoney sx={{ color: "text.secondary", mr: 1 }} /> Cost & Budget Analysis
          </Typography>
          {gamesWithCosts.length > 0 && (
            <Chip 
              label={`${totalGamesWithCosts} game${totalGamesWithCosts !== 1 ? "s" : ""}`} 
              size="small" 
              sx={{ ml: 2, bgcolor: "primary.light", color: "white" }}
            />
          )}
        </AccordionSummary>
        
        <AccordionDetails sx={{ px: 3, pb: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.875rem", md: "0.875rem" }, mb: 2 }}>
                Track and analyze your game expenses throughout the month.
              </Typography>

              {/* Email preference */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  mb: 2,
                  p: 1.5,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  maxWidth: 480,
                }}
              >
                <Email sx={{ color: "text.secondary", fontSize: 20, flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    Include cost column when sending email
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Off by default — cost data is hidden from email recipients unless enabled.
                  </Typography>
                </Box>
                <Switch
                  size="small"
                  checked={includeCostInEmail}
                  onChange={(e) => saveEmailPref(e.target.checked)}
                  inputProps={{ "aria-label": "Include cost in email" }}
                />
              </Box>

              {/* Workbook Selector */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="workbook-select-label">Worksheet</InputLabel>
                  <Select
                    labelId="workbook-select-label"
                    value={selectedWorkbookId}
                    label="Worksheet"
                    onChange={(e) => setSelectedWorkbookId(e.target.value)}
                    startAdornment={<TableChart sx={{ mr: 1, color: "text.secondary", fontSize: 20 }} />}
                  >
                    <MenuItem value="all">All Worksheets</MenuItem>
                    {workbooks.map((workbook) => (
                      <MenuItem key={workbook.id} value={workbook.id}>
                        {workbook.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedWorkbookId !== "all" && (
                  <Typography variant="caption" color="text.secondary">
                    Showing data for {workbooks.find(w => w.id === selectedWorkbookId)?.name}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<Download />}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedWorkbookId !== "all") params.append("workbookId", selectedWorkbookId);
                  window.open(`/api/export/cost-budget?${params}`, "_blank");
                }}
                sx={{ textTransform: "none" }}
              >
                Download CSV
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<Delete />}
                onClick={handleResetData}
                sx={{ textTransform: "none" }}
              >
                Reset All Data
              </Button>
            </Box>
          </Box>

          <Grid container spacing={{ xs: 2, md: 3 }}>
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
        </AccordionDetails>
      </Accordion>
    </Card>
  );
}