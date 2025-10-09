"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, TextField, MenuItem, Stack, Typography, IconButton, Tooltip } from "@mui/material";
import { CheckCircle, Cancel, Schedule, Edit, Delete, Email, CalendarMonth, Add, FilterList } from "@mui/icons-material";
import { format } from "date-fns";

interface Game {
  id: string;
  date: string;
  time: string | null;
  status: string;
  isHome: boolean;
  travelRequired: boolean;
  estimatedTravelTime: number | null;
  calendarSynced?: boolean;
  homeTeam: {
    name: string;
    level: string;
    sport: {
      name: string;
    };
  };
  opponent?: {
    name: string;
  };
  venue?: {
    name: string;
  };
  notes?: string;
}

export function GamesTable() {
  const [filters, setFilters] = useState({
    sport: "",
    level: "",
    status: "",
    dateRange: "upcoming",
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ["games", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  const games = response?.data?.games || [];

  const getConfirmedStatus = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return { icon: <CheckCircle sx={{ fontSize: 16 }} />, color: "success", label: "Yes" };
      case "SCHEDULED":
        return { icon: <Schedule sx={{ fontSize: 16 }} />, color: "warning", label: "Pending" };
      case "CANCELLED":
      case "POSTPONED":
        return { icon: <Cancel sx={{ fontSize: 16 }} />, color: "error", label: "No" };
      default:
        return { icon: <Schedule sx={{ fontSize: 16 }} />, color: "default", label: status };
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <Typography color="text.secondary">Loading games...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Games Schedule
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your athletic schedules
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{
            textTransform: "none",
            boxShadow: 0,
            "&:hover": { boxShadow: 2 },
          }}
        >
          New Game
        </Button>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          select
          size="small"
          value={filters.sport}
          onChange={(e) => setFilters({ ...filters, sport: e.target.value })}
          sx={{ minWidth: 140 }}
          InputProps={{
            sx: { bgcolor: "white" },
          }}
        >
          <MenuItem value="">
            <Typography variant="body2">Sport</Typography>
          </MenuItem>
          <MenuItem value="Football">Football</MenuItem>
          <MenuItem value="Basketball">Basketball</MenuItem>
          <MenuItem value="Soccer">Soccer</MenuItem>
          <MenuItem value="Volleyball">Volleyball</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          value={filters.level}
          onChange={(e) => setFilters({ ...filters, level: e.target.value })}
          sx={{ minWidth: 140 }}
          InputProps={{
            sx: { bgcolor: "white" },
          }}
        >
          <MenuItem value="">
            <Typography variant="body2">Level</Typography>
          </MenuItem>
          <MenuItem value="VARSITY">Varsity</MenuItem>
          <MenuItem value="JV">JV</MenuItem>
          <MenuItem value="FRESHMAN">Freshman</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          value={filters.dateRange}
          onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
          sx={{ minWidth: 140 }}
          InputProps={{
            sx: { bgcolor: "white" },
          }}
        >
          <MenuItem value="all">All Dates</MenuItem>
          <MenuItem value="upcoming">Upcoming</MenuItem>
          <MenuItem value="past">Past</MenuItem>
        </TextField>
      </Stack>

      {/* Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafc" }}>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>DATE</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>SPORT</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>LEVEL</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>OPPONENT</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>H/A</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>TIME</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>CONFIRMED</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>LOCATION</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>TRAVEL INFO</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>NOTES</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {games.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 8, bgcolor: "white" }}>
                  <Typography color="text.secondary" variant="body2">
                    No games found. Click &quot;New Game&quot; to add one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              games.map((game: Game) => {
                const confirmedStatus = getConfirmedStatus(game.status);
                return (
                  <TableRow
                    key={game.id}
                    sx={{
                      bgcolor: "white",
                      "&:hover": { bgcolor: "#f8fafc" },
                      transition: "background-color 0.2s",
                    }}
                  >
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{format(new Date(game.date), "MMM d, yyyy")}</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{game.homeTeam.sport.name}</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{game.homeTeam.level}</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{game.opponent?.name || "TBD"}</TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Chip
                        label={game.isHome ? "Home" : "Away"}
                        size="small"
                        color={game.isHome ? "primary" : "default"}
                        sx={{
                          fontSize: 11,
                          height: 24,
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{game.time || "TBD"}</TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Chip
                        icon={confirmedStatus.icon}
                        label={confirmedStatus.label}
                        size="small"
                        color={confirmedStatus.color as any}
                        sx={{
                          fontSize: 11,
                          height: 24,
                          fontWeight: 500,
                          "& .MuiChip-icon": {
                            fontSize: 16,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2, maxWidth: 180 }}>{game.isHome ? "Home Field" : game.venue?.name || "TBD"}</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{game.travelRequired ? `Dep ${game.estimatedTravelTime || "?"} min` : "N/A"}</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2, maxWidth: 150 }}>
                      {game.notes ? (
                        <Tooltip title={game.notes}>
                          <Typography
                            variant="body2"
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 13,
                            }}
                          >
                            {game.notes}
                          </Typography>
                        </Tooltip>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Stack direction="row" spacing={0}>
                        <Tooltip title="Edit">
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <Edit sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Email">
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <Email sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Calendar">
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <CalendarMonth sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" sx={{ p: 0.5 }}>
                            <Delete sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Footer Stats */}
      <Box sx={{ mt: 3, display: "flex", justifyContent: "center", gap: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Total Games: <strong>{games.length}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Home: <strong>{games.filter((g: Game) => g.isHome).length}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Away: <strong>{games.filter((g: Game) => !g.isHome).length}</strong>
        </Typography>
      </Box>
    </Box>
  );
}
