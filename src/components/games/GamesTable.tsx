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
  TablePagination,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { CheckCircle, Cancel, Schedule, Edit, Delete, Email, CalendarMonth, Add, Send, NavigateBefore, NavigateNext, FirstPage, LastPage } from "@mui/icons-material";
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
    location: string;
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
  const [mounted, setMounted] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0); // MUI uses 0-based indexing
  const [rowsPerPage, setRowsPerPage] = useState(25);

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
    queryKey: ["games", filters, sortField, sortOrder, page + 1, rowsPerPage], // Convert to 1-based for API
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append("sortBy", sortField);
      params.append("sortOrder", sortOrder);
      params.append("page", String(page + 1)); // API expects 1-based pagination
      params.append("limit", String(rowsPerPage));

      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  // Fetch opponents for the filter dropdown
  const { data: opponentsResponse } = useQuery({
    queryKey: ["opponents"],
    queryFn: async () => {
      const res = await fetch("/api/opponents");
      const data = await res.json();
      return data;
    },
  });

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
  const opponents = opponentsResponse?.data || [];
  const locationRes = locationResponse?.data || [];

  // Handle pagination changes
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    setSelectedGames(new Set()); // Clear selection when changing pages
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to first page
    setSelectedGames(new Set()); // Clear selection
  };

  // Quick page navigation
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
    setPage(0); // Reset to first page on sort change
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setFilters({ ...filters, [filterKey]: value });
    setPage(0); // Reset to first page on filter change
    setSelectedGames(new Set()); // Clear selection
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
          onChange={(e) => handleFilterChange("sport", e.target.value)}
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
          onChange={(e) => handleFilterChange("level", e.target.value)}
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
          onChange={(e) => handleFilterChange("opponent", e.target.value)}
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
          onChange={(e) => handleFilterChange("dateRange", e.target.value)}
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

        {/* Filter by Location */}
        <TextField
          select
          size="small"
          label="Filter by Location"
          value={filters.location}
          onChange={(e) => handleFilterChange("location", e.target.value)}
          sx={{ minWidth: 140, fontSize: "14px" }}
          InputProps={{
            sx: { bgcolor: "white" },
          }}
          InputLabelProps={{
            sx: { fontSize: 10, top: "2.5px" },
          }}
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
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <TableSortLabel active={sortField === "location"} direction={sortField === "location" ? sortOrder : "asc"} onClick={() => handleSort("location")}>
                  LOCATION
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {games.length === 0 ? (
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
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(0);
              }}
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
