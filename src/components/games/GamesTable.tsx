"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  MenuItem,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  TableSortLabel,
  Checkbox,
} from "@mui/material";
import { CheckCircle, Cancel, Schedule, Edit, Delete, Email, CalendarMonth, Add, Send } from "@mui/icons-material";
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

type SortField = "date" | "time" | "isHome" | "status";
type SortOrder = "asc" | "desc";

export function GamesTable() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState({
    sport: "",
    level: "",
    status: "",
    opponent: "",
    dateRange: "upcoming",
  });
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch games
  const { data: response, isLoading } = useQuery({
    queryKey: ["games", filters, sortField, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append("sortBy", sortField);
      params.append("sortOrder", sortOrder);

      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  // Fetch opponents for the filter dropdown
  const {
    data: opponentsResponse,
    isLoading: opponentsLoading,
    error: opponentsError,
  } = useQuery({
    queryKey: ["opponents"],
    queryFn: async () => {
      console.log("🔍 Fetching opponents...");
      const res = await fetch("/api/opponents");
      console.log("📡 Response status:", res.status);
      const data = await res.json();
      console.log("📦 Opponents data:", data);
      return data;
    },
  });

  const games = response?.data?.games || [];
  const opponents = opponentsResponse?.data || [];

  console.log("🎯 Opponents array:", opponents);
  console.log("📊 Opponents count:", opponents.length);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const allGameIds = new Set(games.map((game: Game) => game.id)) as any;
      setSelectedGames(allGameIds);
    } else {
      setSelectedGames(new Set());
    }
  };

  const handleSelectGame = (gameId: string) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
    } else {
      newSelected.add(gameId);
    }
    setSelectedGames(newSelected);
  };

  const handleSendEmail = () => {
    if (typeof window === "undefined") return;

    const selectedGamesData = games.filter((game: Game) => selectedGames.has(game.id));

    // Store in sessionStorage to pass to email page
    sessionStorage.setItem("selectedGames", JSON.stringify(selectedGamesData));

    // Navigate to email composition page
    router.push("/dashboard/compose-email");
  };

  const formatGameDate = (dateString: string) => {
    if (!mounted) return dateString; // Return raw date on server
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (error) {
      return dateString;
    }
  };

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

  const sortedGames = [...games].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "date":
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case "time":
        const timeA = a.time || "99:99";
        const timeB = b.time || "99:99";
        comparison = timeA.localeCompare(timeB);
        break;
      case "isHome":
        comparison = a.isHome === b.isHome ? 0 : a.isHome ? -1 : 1;
        break;
      case "status":
        const statusOrder = { CONFIRMED: 1, SCHEDULED: 2, POSTPONED: 3, CANCELLED: 4, COMPLETED: 5 };
        comparison = (statusOrder[a.status as keyof typeof statusOrder] || 99) - (statusOrder[b.status as keyof typeof statusOrder] || 99);
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const isAllSelected = games.length > 0 && selectedGames.size === games.length;
  const isIndeterminate = selectedGames.size > 0 && selectedGames.size < games.length;

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
        <Stack direction="row" spacing={2}>
          {selectedGames.size > 0 && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Send />}
              onClick={handleSendEmail}
              sx={{
                textTransform: "none",
                boxShadow: 0,
                "&:hover": { boxShadow: 2 },
              }}
            >
              Send Email ({selectedGames.size})
            </Button>
          )}
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
        </Stack>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          select
          size="small"
          label="Filter by Sport"
          value={filters.sport}
          onChange={(e) => setFilters({ ...filters, sport: e.target.value })}
          sx={{ minWidth: 140 }}
          InputProps={{
            sx: { bgcolor: "white" },
          }}
          InputLabelProps={{
            sx: { fontSize: 10, top: "2.5px" },
          }}
        >
          <MenuItem value="">
            <Typography variant="body2">All Sports</Typography>
          </MenuItem>
          <MenuItem value="Football">Football</MenuItem>
          <MenuItem value="Basketball">Basketball</MenuItem>
          <MenuItem value="Soccer">Soccer</MenuItem>
          <MenuItem value="Volleyball">Volleyball</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Filter by Level"
          value={filters.level}
          onChange={(e) => setFilters({ ...filters, level: e.target.value })}
          sx={{ minWidth: 140 }}
          InputProps={{
            sx: { bgcolor: "white" },
          }}
          InputLabelProps={{
            sx: { fontSize: 10, top: "2.5px" },
          }}
        >
          <MenuItem value="">
            <Typography variant="body2">All Levels</Typography>
          </MenuItem>
          <MenuItem value="VARSITY">Varsity</MenuItem>
          <MenuItem value="JV">JV</MenuItem>
          <MenuItem value="FRESHMAN">Freshman</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Filter by Opponent"
          value={filters.opponent}
          onChange={(e) => setFilters({ ...filters, opponent: e.target.value })}
          sx={{ minWidth: 180 }}
          InputProps={{
            sx: { bgcolor: "white" },
          }}
          InputLabelProps={{
            sx: { fontSize: 10, top: "2.5px" },
          }}
        >
          <MenuItem value="">
            <Typography variant="body2">All Opponents</Typography>
          </MenuItem>
          {opponents.map((opponent: any) => (
            <MenuItem key={opponent.id} value={opponent.id}>
              {opponent.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Filter by Upcoming"
          value={filters.dateRange}
          onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
          sx={{ minWidth: 140, fontSize: "14px" }}
          InputProps={{
            sx: { bgcolor: "white" },
          }}
          InputLabelProps={{
            sx: { fontSize: 10, top: "2.5px" },
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
              <TableCell padding="checkbox" sx={{ py: 2 }}>
                <Checkbox indeterminate={isIndeterminate} checked={isAllSelected} onChange={handleSelectAll} sx={{ p: 0 }} />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <TableSortLabel active={sortField === "date"} direction={sortField === "date" ? sortOrder : "asc"} onClick={() => handleSort("date")}>
                  DATE
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>SPORT</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>LEVEL</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>OPPONENT</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <TableSortLabel active={sortField === "isHome"} direction={sortField === "isHome" ? sortOrder : "asc"} onClick={() => handleSort("isHome")}>
                  H/A
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <TableSortLabel active={sortField === "time"} direction={sortField === "time" ? sortOrder : "asc"} onClick={() => handleSort("time")}>
                  TIME
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <TableSortLabel active={sortField === "status"} direction={sortField === "status" ? sortOrder : "asc"} onClick={() => handleSort("status")}>
                  CONFIRMED
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>LOCATION</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedGames.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 8, bgcolor: "white" }}>
                  <Typography color="text.secondary" variant="body2">
                    No games found. Click "New Game" to add one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedGames.map((game: Game) => {
                const confirmedStatus = getConfirmedStatus(game.status);
                const isSelected = selectedGames.has(game.id);

                return (
                  <TableRow
                    key={game.id}
                    selected={isSelected}
                    sx={{
                      bgcolor: "white",
                      "&:hover": { bgcolor: "#f8fafc" },
                      transition: "background-color 0.2s",
                      "&.Mui-selected": {
                        bgcolor: "#e3f2fd !important",
                        "&:hover": {
                          bgcolor: "#bbdefb !important",
                        },
                      },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={isSelected} onChange={() => handleSelectGame(game.id)} sx={{ p: 0 }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{formatGameDate(game.date)}</TableCell>
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
                    <TableCell sx={{ py: 2 }}>
                      <Stack direction="row" spacing={0}>
                        <Tooltip title="Edit">
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <Edit sx={{ fontSize: 18 }} />
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
          Total Games: <strong>{sortedGames.length}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Selected: <strong>{selectedGames.size}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Home: <strong>{sortedGames.filter((g: Game) => g.isHome).length}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Away: <strong>{sortedGames.filter((g: Game) => !g.isHome).length}</strong>
        </Typography>
      </Box>
    </Box>
  );
}
