"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Select,
  FormControl,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import { CheckCircle, Cancel, Schedule, Edit, Delete, Email, CalendarMonth, Add, Send, NavigateBefore, NavigateNext, FirstPage, LastPage, Save, Close, Check } from "@mui/icons-material";
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
    id?: string;
    name: string;
    level: string;
    location: string;
    sport: {
      name: string;
    };
  };
  homeTeamId?: string;
  opponent?: {
    id?: string;
    name: string;
  };
  opponentId?: string;
  venue?: {
    id?: string;
    name: string;
  };
  venueId?: string;
  notes?: string;
}

interface NewGameData {
  date: string;
  time: string;
  sport: string;
  level: string;
  opponentId: string;
  isHome: boolean;
  status: string;
  venueId: string;
  notes: string;
  homeTeamId?: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

type SortField = "date" | "time" | "isHome" | "status" | "location";
type SortOrder = "asc" | "desc";

export function GamesTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // New game state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newGameData, setNewGameData] = useState<NewGameData>({
    date: new Date().toISOString().split("T")[0],
    time: "",
    sport: "",
    level: "",
    opponentId: "",
    isHome: true,
    status: "SCHEDULED",
    venueId: "",
    notes: "",
  });

  // Edit mode state
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editingGameData, setEditingGameData] = useState<Game | null>(null);

  // Filter and sort state
  const [filters, setFilters] = useState({
    sport: "",
    level: "",
    status: "",
    opponent: "",
    location: "",
    dateRange: "upcoming",
  });
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch games with pagination
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["games", filters, sortField, sortOrder, page + 1, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append("sortBy", sortField);
      params.append("sortOrder", sortOrder);
      params.append("page", String(page + 1));
      params.append("limit", String(rowsPerPage));

      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  // Fetch teams for sport/level combinations
  const { data: teamsResponse } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams");
      const data = await res.json();
      return data;
    },
  });

  // Fetch opponents
  const { data: opponentsResponse } = useQuery({
    queryKey: ["opponents"],
    queryFn: async () => {
      const res = await fetch("/api/opponents");
      const data = await res.json();
      return data;
    },
  });

  // Fetch venues
  const { data: venuesResponse } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const res = await fetch("/api/venues");
      const data = await res.json();
      return data;
    },
  });

  // Fetch locations
  const { data: locationResponse } = useQuery({
    queryKey: ["location"],
    queryFn: async () => {
      const res = await fetch("/api/locations");
      const data = await res.json();
      return data;
    },
  });

  const games = response?.data?.games || [];
  const pagination: PaginationData = response?.data?.pagination || {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };
  const teams = teamsResponse?.data || [];
  const opponents = opponentsResponse?.data || [];
  const venues = venuesResponse?.data || [];
  const locationRes = locationResponse?.data || [];

  // Get unique sports and levels from teams
  const uniqueSports = [...new Set(teams.map((team: any) => team.sport?.name))].filter(Boolean);
  const uniqueLevels = [...new Set(teams.map((team: any) => team.level))].filter(Boolean);

  // Create new game mutation
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
      setIsAddingNew(false);
      setNewGameData({
        date: new Date().toISOString().split("T")[0],
        time: "",
        sport: "",
        level: "",
        opponentId: "",
        isHome: true,
        status: "SCHEDULED",
        venueId: "",
        notes: "",
      });
    },
  });

  // Update game mutation
  const updateGameMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update game");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setEditingGameId(null);
      setEditingGameData(null);
    },
  });

  // Delete game mutation
  const deleteGameMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/games/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete game");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });

  // Handlers
  const handleNewGame = () => {
    setIsAddingNew(true);
    setEditingGameId(null);
    setEditingGameData(null);
  };

  const handleSaveNewGame = () => {
    // Find the matching team based on sport and level
    const matchingTeam = teams.find((team: any) => team.sport?.name === newGameData.sport && team.level === newGameData.level);

    if (!matchingTeam) {
      alert("Please select valid sport and level combination");
      return;
    }

    const gameData = {
      date: newGameData.date,
      time: newGameData.time || null,
      homeTeamId: matchingTeam.id,
      isHome: newGameData.isHome,
      opponentId: newGameData.opponentId || null,
      venueId: !newGameData.isHome && newGameData.venueId ? newGameData.venueId : null,
      status: newGameData.status,
      notes: newGameData.notes || null,
    };

    createGameMutation.mutate(gameData);
  };

  const handleCancelNewGame = () => {
    setIsAddingNew(false);
    setNewGameData({
      date: new Date().toISOString().split("T")[0],
      time: "",
      sport: "",
      level: "",
      opponentId: "",
      isHome: true,
      status: "SCHEDULED",
      venueId: "",
      notes: "",
    });
  };

  const handleEditGame = (game: Game) => {
    setEditingGameId(game.id);
    setEditingGameData({ ...game });
    setIsAddingNew(false);
  };

  const handleSaveEdit = () => {
    if (!editingGameData || !editingGameId) return;

    const matchingTeam = teams.find((team: any) => team.sport?.name === editingGameData.homeTeam.sport.name && team.level === editingGameData.homeTeam.level);

    const updateData = {
      date: editingGameData.date,
      time: editingGameData.time || null,
      homeTeamId: matchingTeam?.id || editingGameData.homeTeamId,
      isHome: editingGameData.isHome,
      opponentId: editingGameData.opponentId || editingGameData.opponent?.id || null,
      venueId: !editingGameData.isHome && editingGameData.venueId ? editingGameData.venueId : null,
      status: editingGameData.status,
      notes: editingGameData.notes || null,
    };

    updateGameMutation.mutate({ id: editingGameId, data: updateData });
  };

  const handleCancelEdit = () => {
    setEditingGameId(null);
    setEditingGameData(null);
  };

  const handleDeleteGame = (gameId: string) => {
    if (confirm("Are you sure you want to delete this game?")) {
      deleteGameMutation.mutate(gameId);
    }
  };

  // Pagination handlers
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    setSelectedGames(new Set());
  };

  const handleChangeRowsPerPage = (value: number) => {
    setRowsPerPage(value);
    setPage(0);
    setSelectedGames(new Set());
  };

  const handleFirstPage = () => {
    setPage(0);
    setSelectedGames(new Set());
  };

  const handleLastPage = () => {
    setPage(pagination.totalPages - 1);
    setSelectedGames(new Set());
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(0);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setFilters({ ...filters, [filterKey]: value });
    setPage(0);
    setSelectedGames(new Set());
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
    sessionStorage.setItem("selectedGames", JSON.stringify(selectedGamesData));
    router.push("/dashboard/compose-email");
  };

  const formatGameDate = (dateString: string) => {
    if (!mounted) return dateString;
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

  const isAllSelected = games.length > 0 && selectedGames.size === games.length;
  const isIndeterminate = selectedGames.size > 0 && selectedGames.size < games.length;

  if (isLoading && !mounted) {
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
            <Button variant="contained" color="primary" startIcon={<Send />} onClick={handleSendEmail} sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}>
              Send Email ({selectedGames.size})
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={handleNewGame} disabled={isAddingNew} sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}>
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
          onChange={(e) => handleFilterChange("sport", e.target.value)}
          sx={{ minWidth: 140 }}
          InputProps={{ sx: { bgcolor: "white" } }}
          InputLabelProps={{ sx: { fontSize: 10, top: "2.5px" } }}
        >
          <MenuItem value="">
            <Typography variant="body2">All Sports</Typography>
          </MenuItem>
          {(uniqueSports as string[]).map((sport: string) => (
            <MenuItem key={sport} value={sport}>
              {sport}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Filter by Level"
          value={filters.level}
          onChange={(e) => handleFilterChange("level", e.target.value)}
          sx={{ minWidth: 140 }}
          InputProps={{ sx: { bgcolor: "white" } }}
          InputLabelProps={{ sx: { fontSize: 10, top: "2.5px" } }}
        >
          <MenuItem value="">
            <Typography variant="body2">All Levels</Typography>
          </MenuItem>
          {(uniqueLevels as string[]).map((level: string) => (
            <MenuItem key={level} value={level}>
              {level}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Filter by Opponent"
          value={filters.opponent}
          onChange={(e) => handleFilterChange("opponent", e.target.value)}
          sx={{ minWidth: 180 }}
          InputProps={{ sx: { bgcolor: "white" } }}
          InputLabelProps={{ sx: { fontSize: 10, top: "2.5px" } }}
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
          label="Filter by Date"
          value={filters.dateRange}
          onChange={(e) => handleFilterChange("dateRange", e.target.value)}
          sx={{ minWidth: 140 }}
          InputProps={{ sx: { bgcolor: "white" } }}
          InputLabelProps={{ sx: { fontSize: 10, top: "2.5px" } }}
        >
          <MenuItem value="all">All Dates</MenuItem>
          <MenuItem value="upcoming">Upcoming</MenuItem>
          <MenuItem value="past">Past</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Filter by Location"
          value={filters.location}
          onChange={(e) => handleFilterChange("location", e.target.value)}
          sx={{ minWidth: 140 }}
          InputProps={{ sx: { bgcolor: "white" } }}
          InputLabelProps={{ sx: { fontSize: 10, top: "2.5px" } }}
        >
          <MenuItem value="">
            <Typography variant="body2">All Locations</Typography>
          </MenuItem>
          {locationRes.map((loc: string) => (
            <MenuItem key={loc} value={loc}>
              {loc}
            </MenuItem>
          ))}
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
            {/* New Game Row */}
            {isAddingNew && (
              <TableRow sx={{ bgcolor: "#e3f2fd" }}>
                <TableCell padding="checkbox">
                  <Checkbox disabled sx={{ p: 0 }} />
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <TextField
                    type="date"
                    size="small"
                    value={newGameData.date}
                    onChange={(e) => setNewGameData({ ...newGameData, date: e.target.value })}
                    sx={{ width: 140 }}
                    InputProps={{ sx: { fontSize: 13 } }}
                  />
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <Select size="small" value={newGameData.sport} onChange={(e) => setNewGameData({ ...newGameData, sport: e.target.value })} sx={{ width: 120, fontSize: 13 }}>
                    {(uniqueSports as string[]).map((sport: string) => (
                      <MenuItem key={sport} value={sport}>
                        {sport}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <Select size="small" value={newGameData.level} onChange={(e) => setNewGameData({ ...newGameData, level: e.target.value })} sx={{ width: 100, fontSize: 13 }}>
                    {(uniqueLevels as string[]).map((level: string) => (
                      <MenuItem key={level} value={level}>
                        {level}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <Select size="small" value={newGameData.opponentId} onChange={(e) => setNewGameData({ ...newGameData, opponentId: e.target.value })} sx={{ width: 140, fontSize: 13 }} displayEmpty>
                    <MenuItem value="">TBD</MenuItem>
                    {opponents.map((opponent: any) => (
                      <MenuItem key={opponent.id} value={opponent.id}>
                        {opponent.name}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <Select
                    size="small"
                    value={newGameData.isHome ? "home" : "away"}
                    onChange={(e) => setNewGameData({ ...newGameData, isHome: e.target.value === "home" })}
                    sx={{ width: 80, fontSize: 13 }}
                  >
                    <MenuItem value="home">Home</MenuItem>
                    <MenuItem value="away">Away</MenuItem>
                  </Select>
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <TextField
                    type="time"
                    size="small"
                    value={newGameData.time}
                    onChange={(e) => setNewGameData({ ...newGameData, time: e.target.value })}
                    sx={{ width: 100 }}
                    InputProps={{ sx: { fontSize: 13 } }}
                  />
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <Select size="small" value={newGameData.status} onChange={(e) => setNewGameData({ ...newGameData, status: e.target.value })} sx={{ width: 110, fontSize: 13 }}>
                    <MenuItem value="SCHEDULED">Pending</MenuItem>
                    <MenuItem value="CONFIRMED">Yes</MenuItem>
                    <MenuItem value="CANCELLED">No</MenuItem>
                  </Select>
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  {newGameData.isHome ? (
                    <Typography variant="body2" sx={{ fontSize: 13 }}>
                      Home Field
                    </Typography>
                  ) : (
                    <Select size="small" value={newGameData.venueId} onChange={(e) => setNewGameData({ ...newGameData, venueId: e.target.value })} sx={{ width: 140, fontSize: 13 }} displayEmpty>
                      <MenuItem value="">TBD</MenuItem>
                      {venues.map((venue: any) => (
                        <MenuItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <Stack direction="row" spacing={0}>
                    <Tooltip title="Save">
                      <IconButton size="small" color="success" onClick={handleSaveNewGame} disabled={createGameMutation.isPending} sx={{ p: 0.5 }}>
                        {createGameMutation.isPending ? <CircularProgress size={16} /> : <Check sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cancel">
                      <IconButton size="small" color="error" onClick={handleCancelNewGame} disabled={createGameMutation.isPending} sx={{ p: 0.5 }}>
                        <Close sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            )}

            {/* Existing Games */}
            {games.length === 0 && !isAddingNew ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 8, bgcolor: "white" }}>
                  <Typography color="text.secondary" variant="body2">
                    No games found. Click "New Game" to add one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              games.map((game: Game) => {
                const confirmedStatus = getConfirmedStatus(game.status);
                const isSelected = selectedGames.has(game.id);
                const isEditing = editingGameId === game.id;

                if (isEditing && editingGameData) {
                  // Edit mode row
                  return (
                    <TableRow key={game.id} sx={{ bgcolor: "#fff3e0" }}>
                      <TableCell padding="checkbox">
                        <Checkbox disabled sx={{ p: 0 }} />
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <TextField
                          type="date"
                          size="small"
                          value={editingGameData.date.split("T")[0]}
                          onChange={(e) => setEditingGameData({ ...editingGameData, date: e.target.value })}
                          sx={{ width: 140 }}
                          InputProps={{ sx: { fontSize: 13 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Select
                          size="small"
                          value={editingGameData.homeTeam.sport.name}
                          onChange={(e) =>
                            setEditingGameData({
                              ...editingGameData,
                              homeTeam: {
                                ...editingGameData.homeTeam,
                                sport: { name: e.target.value },
                              },
                            })
                          }
                          sx={{ width: 120, fontSize: 13 }}
                        >
                          {(uniqueSports as string[]).map((sport: string) => (
                            <MenuItem key={sport} value={sport}>
                              {sport}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Select
                          size="small"
                          value={editingGameData.homeTeam.level}
                          onChange={(e) =>
                            setEditingGameData({
                              ...editingGameData,
                              homeTeam: {
                                ...editingGameData.homeTeam,
                                level: e.target.value,
                              },
                            })
                          }
                          sx={{ width: 100, fontSize: 13 }}
                        >
                          {(uniqueLevels as string[]).map((level: string) => (
                            <MenuItem key={level} value={level}>
                              {level}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Select
                          size="small"
                          value={editingGameData.opponentId || editingGameData.opponent?.id || ""}
                          onChange={(e) => setEditingGameData({ ...editingGameData, opponentId: e.target.value })}
                          sx={{ width: 140, fontSize: 13 }}
                          displayEmpty
                        >
                          <MenuItem value="">TBD</MenuItem>
                          {opponents.map((opponent: any) => (
                            <MenuItem key={opponent.id} value={opponent.id}>
                              {opponent.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Select
                          size="small"
                          value={editingGameData.isHome ? "home" : "away"}
                          onChange={(e) => setEditingGameData({ ...editingGameData, isHome: e.target.value === "home" })}
                          sx={{ width: 80, fontSize: 13 }}
                        >
                          <MenuItem value="home">Home</MenuItem>
                          <MenuItem value="away">Away</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <TextField
                          type="time"
                          size="small"
                          value={editingGameData.time || ""}
                          onChange={(e) => setEditingGameData({ ...editingGameData, time: e.target.value })}
                          sx={{ width: 100 }}
                          InputProps={{ sx: { fontSize: 13 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Select size="small" value={editingGameData.status} onChange={(e) => setEditingGameData({ ...editingGameData, status: e.target.value })} sx={{ width: 110, fontSize: 13 }}>
                          <MenuItem value="SCHEDULED">Pending</MenuItem>
                          <MenuItem value="CONFIRMED">Yes</MenuItem>
                          <MenuItem value="CANCELLED">No</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {editingGameData.isHome ? (
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            Home Field
                          </Typography>
                        ) : (
                          <Select
                            size="small"
                            value={editingGameData.venueId || editingGameData.venue?.id || ""}
                            onChange={(e) => setEditingGameData({ ...editingGameData, venueId: e.target.value })}
                            sx={{ width: 140, fontSize: 13 }}
                            displayEmpty
                          >
                            <MenuItem value="">TBD</MenuItem>
                            {venues.map((venue: any) => (
                              <MenuItem key={venue.id} value={venue.id}>
                                {venue.name}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Stack direction="row" spacing={0}>
                          <Tooltip title="Save">
                            <IconButton size="small" color="success" onClick={handleSaveEdit} disabled={updateGameMutation.isPending} sx={{ p: 0.5 }}>
                              {updateGameMutation.isPending ? <CircularProgress size={16} /> : <Check sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton size="small" color="error" onClick={handleCancelEdit} disabled={updateGameMutation.isPending} sx={{ p: 0.5 }}>
                              <Close sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                }

                // Normal display row
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
                      <Chip label={game.isHome ? "Home" : "Away"} size="small" color={game.isHome ? "primary" : "default"} sx={{ fontSize: 11, height: 24, fontWeight: 500 }} />
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
                          "& .MuiChip-icon": { fontSize: 16 },
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2, maxWidth: 180 }}>{game.isHome ? "Home Field" : game.venue?.name || "TBD"}</TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Stack direction="row" spacing={0}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditGame(game)} sx={{ p: 0.5 }}>
                            <Edit sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Calendar">
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <CalendarMonth sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteGame(game.id)} sx={{ p: 0.5 }}>
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

      {/* Pagination Controls */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mt: 3,
          px: 2,
        }}
      >
        {/* Left side - Page info and rows per page */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Rows per page:
            </Typography>
            <Select
              value={rowsPerPage}
              onChange={(e) => handleChangeRowsPerPage(Number(e.target.value))}
              size="small"
              sx={{
                minWidth: 70,
                "& .MuiSelect-select": { py: 0.5 },
              }}
            >
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </Box>

          <Typography variant="body2" color="text.secondary">
            {pagination.total > 0 ? `${page * rowsPerPage + 1}–${Math.min((page + 1) * rowsPerPage, pagination.total)} of ${pagination.total}` : "0 results"}
          </Typography>
        </Box>

        {/* Center - Quick stats */}
        <Box sx={{ display: "flex", gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Page {page + 1} of {pagination.totalPages || 1}
          </Typography>
          {selectedGames.size > 0 && (
            <Typography variant="body2" color="primary">
              {selectedGames.size} selected
            </Typography>
          )}
        </Box>

        {/* Right side - Navigation buttons */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="First page">
            <span>
              <IconButton onClick={handleFirstPage} disabled={page === 0} size="small">
                <FirstPage />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Previous page">
            <span>
              <IconButton onClick={() => handleChangePage(null, page - 1)} disabled={page === 0} size="small">
                <NavigateBefore />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Next page">
            <span>
              <IconButton onClick={() => handleChangePage(null, page + 1)} disabled={page >= pagination.totalPages - 1} size="small">
                <NavigateNext />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Last page">
            <span>
              <IconButton onClick={handleLastPage} disabled={page >= pagination.totalPages - 1} size="small">
                <LastPage />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Additional Stats Footer */}
      <Box
        sx={{
          mt: 2,
          pt: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Total Games: <strong>{pagination.total}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Home: <strong>{games.filter((g: Game) => g.isHome).length}</strong> on this page
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Away: <strong>{games.filter((g: Game) => !g.isHome).length}</strong> on this page
        </Typography>
      </Box>
    </Box>
  );
}
