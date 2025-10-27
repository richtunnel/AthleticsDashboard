"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingButton } from "../utils/LoadingButton";
import { CustomColumnManager } from "./CustomColumnManager";
import { ColumnFilter, ColumnFilterValue } from "./ColumnFilter";
import dynamic from "next/dynamic";
import { ExportService } from "@/lib/services/exportService";
import { QuickAddOpponent } from "./QuickAddOpponent";
import { QuickAddVenue } from "./QuickAddVenue";
import { QuickAddTeam } from "./QuickAddTeams";
import { Sync, ViewColumn, Download, Upload } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/contexts/NotificationContext";
import { GradientSendIcon } from "@/components/icons/GradientSendIcon";
import { ChipProps } from "@mui/material/Chip";
import { useGamesFiltersStore } from "@/lib/stores/gamesFiltersStore";

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
  Stack,
  Typography,
  IconButton,
  Tooltip,
  TableSortLabel,
  Checkbox,
  Select,
  CircularProgress,
  MenuItem,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import TextareaAutosize from "@mui/material/TextareaAutosize";
import { CheckCircle, Cancel, Schedule, Edit, Delete, CalendarMonth, Add, Send, NavigateBefore, NavigateNext, FirstPage, LastPage, Check, Close, DeleteOutline } from "@mui/icons-material";
import { format } from "date-fns";

const CSVImport = dynamic(() => import("./CSVImport").then((mod) => ({ default: mod.CSVImport })), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
      <CircularProgress />
    </Box>
  ),
});

const extractDatePart = (dateValue: string): string => {
  return dateValue.includes("T") ? dateValue.split("T")[0] : dateValue;
};

const toTimeInputValue = (dateTime: string | null): string => {
  if (!dateTime) return "";
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) return "";
  const hours = parsed.getHours().toString().padStart(2, "0");
  const minutes = parsed.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const combineDateAndTime = (dateValue: string, timeValue: string): string | null => {
  if (!dateValue || !timeValue) return null;
  const baseDate = extractDatePart(dateValue);
  const combined = new Date(`${baseDate}T${timeValue}`);
  if (Number.isNaN(combined.getTime())) {
    return null;
  }
  return combined.toISOString();
};

const formatBusTimeDisplay = (dateTime: string | null): string => {
  if (!dateTime) return "—";
  try {
    return format(new Date(dateTime), "h:mm a");
  } catch (error) {
    return "—";
  }
};

interface Game {
  id: string;
  date: string;
  time: string | null;
  status: string;
  isHome: boolean;
  travelRequired: boolean;
  busTravel: boolean;
  estimatedTravelTime: number | null;
  actualDepartureTime: string | null;
  actualArrivalTime: string | null;
  calendarSynced?: boolean;
  googleCalendarEventId?: string | null;
  customData?: any;
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
  busTravel: boolean;
  actualDepartureTime: string;
  actualArrivalTime: string;
  status: string;
  venueId: string;
  notes: string;
  homeTeamId?: string;
  customData?: { [key: string]: string };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

type SortField = "date" | "time" | "isHome" | "status" | "location" | "sport" | "level" | "opponent" | "busTravel" | "notes";
type SortOrder = "asc" | "desc";

type ColumnFilters = Record<string, ColumnFilterValue>;

type InlineEditField = "opponent" | "location" | "date" | "time" | "status" | "notes" | `custom:${string}`;

interface InlineEditState {
  gameId: string;
  field: InlineEditField;
}

type ConfirmedStatus = {
  icon: React.ReactNode;
  label: string;
  color: ChipProps["color"]; // Use MUI's Chip color type
};

export function GamesTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newGameData, setNewGameData] = useState<NewGameData>({
    date: new Date().toISOString().split("T")[0],
    time: "",
    sport: "",
    level: "",
    opponentId: "",
    isHome: true,
    busTravel: false,
    actualDepartureTime: "",
    actualArrivalTime: "",
    status: "SCHEDULED",
    venueId: "",
    notes: "",
    customData: {},
  });

  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editingGameData, setEditingGameData] = useState<Game | null>(null);
  const [editingCustomData, setEditingCustomData] = useState<{ [key: string]: string }>({});

  const [showImportDialog, setShowImportDialog] = useState(false);

  const columnFilters = useGamesFiltersStore((state) => state.columnFilters);
  const setColumnFilters = useGamesFiltersStore((state) => state.setColumnFilters);
  const updateFilter = useGamesFiltersStore((state) => state.updateFilter);

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [showColumnManager, setShowColumnManager] = useState(false);

  const [showAddOpponent, setShowAddOpponent] = useState(false);
  const [showAddVenue, setShowAddVenue] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);

  // Inline editing state
  const [inlineEditState, setInlineEditState] = useState<InlineEditState | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<string>("");
  const [inlineEditError, setInlineEditError] = useState<string | null>(null);
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Constants
  const MAX_CHAR_LIMIT = 2500;
  const NOTES_PREVIEW_LENGTH = 100;

  const getCharacterCounterColor = (length: number) => {
    if (length >= MAX_CHAR_LIMIT) {
      return theme.palette.error.main;
    }
    if (length >= MAX_CHAR_LIMIT * 0.9) {
      return (theme.palette.warning && theme.palette.warning.main) || theme.palette.error.main;
    }
    return theme.palette.text.secondary;
  };

  const getNotesPreview = (notes?: string | null) => {
    if (!notes) return "—";
    return notes.length > NOTES_PREVIEW_LENGTH ? `${notes.slice(0, NOTES_PREVIEW_LENGTH).trimEnd()}…` : notes;
  };

  const handleInlineValueChange = useCallback(
    (value: string) => {
      if (value.length <= MAX_CHAR_LIMIT) {
        setInlineEditValue(value);
        if (inlineEditError) {
          setInlineEditError(null);
        }
      } else {
        setInlineEditError(`Maximum ${MAX_CHAR_LIMIT} characters allowed`);
      }
    },
    [MAX_CHAR_LIMIT, inlineEditError]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["games", columnFilters, sortField, sortOrder, page + 1, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams();

      Object.entries(columnFilters).forEach(([columnId, filter]) => {
        params.append(`filter_${columnId}_type`, filter.type);
        if (filter.type === "condition") {
          params.append(`filter_${columnId}_condition`, filter.condition || "");
          params.append(`filter_${columnId}_value`, filter.value || "");
          if (filter.secondValue) {
            params.append(`filter_${columnId}_secondValue`, filter.secondValue);
          }
        } else if (filter.type === "values") {
          params.append(`filter_${columnId}_values`, JSON.stringify(filter.values || []));
        }
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

  const { data: teamsResponse } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams");
      const data = await res.json();
      return data;
    },
  });

  const { data: opponentsResponse } = useQuery({
    queryKey: ["opponents"],
    queryFn: async () => {
      const res = await fetch("/api/opponents");
      const data = await res.json();
      return data;
    },
  });

  const { data: venuesResponse } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const res = await fetch("/api/venues");
      const data = await res.json();
      return data;
    },
  });

  const { data: customColumnsResponse } = useQuery({
    queryKey: ["customColumns"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/custom-columns");
      if (!res.ok) throw new Error("Failed to fetch custom columns");
      return res.json();
    },
  });

  const customColumns = useMemo(() => (customColumnsResponse?.data || []) as any[], [customColumnsResponse?.data]);

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

  const uniqueSports = [...new Set(teams.map((team: any) => team.sport?.name))].filter(Boolean);
  const uniqueLevels = [...new Set(teams.map((team: any) => team.level))].filter(Boolean);

  const uniqueValues = useMemo(() => {
    const values: Record<string, Set<string>> = {
      sport: new Set(),
      level: new Set(),
      opponent: new Set(),
      status: new Set(),
      location: new Set(),
      busTravel: new Set(),
    };

    customColumns.forEach((col: any) => {
      values[col.id] = new Set();
    });

    games.forEach((game: Game) => {
      values.sport.add(game.homeTeam.sport.name);
      values.level.add(game.homeTeam.level);
      values.opponent.add(game.opponent?.name || "TBD");
      values.status.add(game.status);
      values.location.add(game.isHome ? "Home" : game.venue?.name || "TBD");
      values.busTravel.add(game.busTravel ? "Yes" : "No");

      const customData = (game.customData as any) || {};
      customColumns.forEach((col: any) => {
        const value = customData[col.id] || "";
        if (value) values[col.id].add(value);
      });
    });

    const result: Record<string, string[]> = {};
    Object.keys(values).forEach((key) => {
      result[key] = Array.from(values[key]).sort();
    });

    return result;
  }, [games, customColumns]);

  const syncGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const res = await fetch(`/api/games/${gameId}/gsync-calendar`, { method: "POST" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sync calendar.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      addNotification("Game successfully synced to Google Calendar!", "success");
    },
    onError: (error: any) => {
      addNotification(`Calendar Sync Error: ${error.message}`, "error");
    },
  });

  const handleSyncCalendar = (gameId: string) => {
    syncGameMutation.mutate(gameId);
  };

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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setIsAddingNew(false);
      setNewGameData({
        date: new Date().toISOString().split("T")[0],
        time: "",
        sport: "",
        level: "",
        opponentId: "",
        isHome: true,
        busTravel: false,
        actualDepartureTime: "",
        actualArrivalTime: "",
        status: "SCHEDULED",
        venueId: "",
        notes: "",
        customData: {},
      });

      const newGameId = data.data.id;
      syncGameMutation.mutate(newGameId);
    },
  });

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
      setEditingCustomData({});

      if (editingGameId) {
        syncGameMutation.mutate(editingGameId);
      }
    },
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/games/${id}`, {
        method: "DELETE",
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (error) {
        data = {};
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete game");
      }

      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      addNotification("Game deleted successfully", "success");

      const calendarAttempted = data?.calendar?.attempted === true;
      const calendarSucceeded = data?.calendar?.succeeded === true;

      if (calendarAttempted && !calendarSucceeded) {
        addNotification("The linked Google Calendar event could not be removed.", "warning");
      }
    },
    onError: (error: any) => {
      addNotification(error?.message || "Failed to delete game", "error");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (gameIds: string[]) => {
      const res = await fetch(`/api/games/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (error) {
        data = {};
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete selected games");
      }

      return data;
    },
    onSuccess: (data: any, gameIds: string[]) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setSelectedGames(new Set());
      const deletedCount = data?.data?.deletedCount ?? gameIds.length;
      addNotification(`Deleted ${deletedCount} game${deletedCount === 1 ? "" : "s"}`, "success");

      const calendarFailures = data?.data?.calendar?.failed ?? 0;
      if (calendarFailures > 0) {
        addNotification(`${calendarFailures} Google Calendar event${calendarFailures === 1 ? "" : "s"} could not be removed.`, "warning");
      }
    },
    onError: (error: any) => {
      addNotification(error?.message || "Failed to delete selected games", "error");
    },
  });

  // Inline editing handlers
  const handleDoubleClick = useCallback(
    (game: Game, field: InlineEditField) => {
      // Prevent editing if row is in full edit mode
      if (editingGameId === game.id) return;

      // Prevent editing location for home games
      if (field === "location" && game.isHome) return;

      let currentValue = "";

      if (field.startsWith("custom:")) {
        const columnId = field.replace("custom:", "");
        const customData = (game.customData as any) || {};
        currentValue = customData[columnId] || "";
      } else {
        switch (field) {
          case "opponent":
            currentValue = game.opponentId || game.opponent?.id || "";
            break;
          case "location":
            currentValue = game.venueId || game.venue?.id || "";
            break;
          case "date":
            currentValue = extractDatePart(game.date);
            break;
          case "time":
            currentValue = game.time || "";
            break;
          case "status":
            currentValue = game.status;
            break;
          case "notes":
            currentValue = game.notes || "";
            break;
        }
      }

      setInlineEditState({ gameId: game.id, field });
      setInlineEditValue(currentValue);
      setInlineEditError(null);
    },
    [editingGameId]
  );

  const saveInlineEdit = useCallback(
    async (game: Game) => {
      if (!inlineEditState || isInlineSaving) return;
      if (inlineEditError) return;

      // Clear any pending timeouts
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      setIsInlineSaving(true);

      try {
        const updateData: any = {
          date: new Date(game.date.split("T")[0]).toISOString(),
          time: game.time || null,
          homeTeamId: game.homeTeamId || game.homeTeam.id,
          isHome: game.isHome,
          status: game.status,
          opponentId: game.opponentId || game.opponent?.id || null,
          venueId: game.venueId || game.venue?.id || null,
          customData: game.customData || {},
          notes: game.notes || null,
        };

        // Apply the inline edit value based on field
        if (inlineEditState.field === "opponent") {
          updateData.opponentId = inlineEditValue || null;
        } else if (inlineEditState.field === "location") {
          updateData.venueId = inlineEditValue || null;
        } else if (inlineEditState.field === "date") {
          if (inlineEditValue) {
            const nextDate = new Date(inlineEditValue);
            if (!Number.isNaN(nextDate.getTime())) {
              updateData.date = nextDate.toISOString();
            }
          }
        } else if (inlineEditState.field === "time") {
          updateData.time = inlineEditValue || null;
        } else if (inlineEditState.field === "status") {
          updateData.status = inlineEditValue;
        } else if (inlineEditState.field === "notes") {
          // Enforce character limit
          updateData.notes = inlineEditValue.slice(0, MAX_CHAR_LIMIT) || null;
        } else if (inlineEditState.field.startsWith("custom:")) {
          // Handle custom column editing
          const columnId = inlineEditState.field.replace("custom:", "");
          const existingCustomData = (game.customData as any) || {};
          updateData.customData = {
            ...existingCustomData,
            [columnId]: inlineEditValue.slice(0, MAX_CHAR_LIMIT), // Also apply limit to custom fields
          };
        }

        const res = await fetch(`/api/games/${game.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to update game");
        }

        await queryClient.invalidateQueries({ queryKey: ["games"] });

        // Sync to calendar after successful update
        syncGameMutation.mutate(game.id);

        setInlineEditState(null);
        setInlineEditValue("");
        setInlineEditError(null);
      } catch (error: any) {
        addNotification(`Error updating game: ${error.message}`, "error");
      } finally {
        setIsInlineSaving(false);
      }
    },
    [inlineEditState, inlineEditValue, inlineEditError, isInlineSaving, queryClient, syncGameMutation, addNotification, MAX_CHAR_LIMIT]
  );

  const handleInlineKeyDown = useCallback(
    (e: React.KeyboardEvent, game: Game) => {
      if (e.key === "Enter" && inlineEditState?.field !== "notes") {
        // Don't save on Enter for notes field (textarea)
        e.preventDefault();
        saveInlineEdit(game);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setInlineEditState(null);
        setInlineEditValue("");
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
      }
    },
    [saveInlineEdit, inlineEditState]
  );

  const handleInlineBlur = useCallback(
    (game: Game) => {
      // Debounce the save to prevent rapid consecutive updates
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveInlineEdit(game);
      }, 300);
    },
    [saveInlineEdit]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleNewGame = () => {
    setIsAddingNew(true);
    setEditingGameId(null);
    setEditingGameData(null);
  };

  const handleExport = useCallback(() => {
    const gamesToExport = games.length > 0 ? games : [];

    if (gamesToExport.length === 0) {
      addNotification("No games to export", "warning");
      return;
    }

    ExportService.exportGames(gamesToExport, customColumns);
  }, [games, customColumns, addNotification]);

  const handleImportComplete = useCallback(
    (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setShowImportDialog(false);

      const message = `Import complete! ${result.success} games imported successfully${result.failed > 0 ? `, ${result.failed} failed` : ""}`;

      addNotification(message, result.failed > 0 ? "warning" : "success");
    },
    [queryClient, addNotification]
  );

  const handleSaveNewGame = () => {
    const matchingTeam = teams.find((team: any) => team.sport?.name === newGameData.sport && team.level === newGameData.level);

    if (!matchingTeam) {
      addNotification("Please select valid sport and level combination", "error");
      return;
    }

    const isoDate = new Date(newGameData.date).toISOString();

    const gameData = {
      date: isoDate,
      time: newGameData.time || null,
      homeTeamId: matchingTeam.id,
      isHome: newGameData.isHome,
      busTravel: newGameData.busTravel,
      actualDepartureTime: combineDateAndTime(newGameData.date, newGameData.actualDepartureTime),
      actualArrivalTime: combineDateAndTime(newGameData.date, newGameData.actualArrivalTime),
      opponentId: newGameData.opponentId || null,
      venueId: !newGameData.isHome && newGameData.venueId ? newGameData.venueId : null,
      status: newGameData.status,
      notes: newGameData.notes || null,
      customData: newGameData.customData || {},
    };

    createGameMutation.mutate(gameData);
  };

  const handleCustomFieldChange = useCallback(
    (columnId: string, value: string) => {
      // Enforce character limit
      const limitedValue = value.slice(0, MAX_CHAR_LIMIT);
      setEditingCustomData((prev) => ({
        ...prev,
        [columnId]: limitedValue,
      }));
    },
    [MAX_CHAR_LIMIT]
  );

  const handleCancelNewGame = () => {
    setIsAddingNew(false);
    setNewGameData({
      date: new Date().toISOString().split("T")[0],
      time: "",
      sport: "",
      level: "",
      opponentId: "",
      isHome: true,
      busTravel: false,
      actualDepartureTime: "",
      actualArrivalTime: "",
      status: "SCHEDULED",
      venueId: "",
      customData: {},
      notes: "",
    });
  };

  const handleEditGame = (game: Game) => {
    setEditingGameId(game.id);
    setEditingGameData({ ...game });
    const customData = (game.customData as any) || {};
    setEditingCustomData({ ...customData });
    setIsAddingNew(false);
    // Clear inline edit state when entering full edit mode
    setInlineEditState(null);
    setInlineEditValue("");
  };

  const handleSaveEdit = () => {
    if (!editingGameData || !editingGameId) return;

    const matchingTeam = teams.find((team: any) => team.sport?.name === editingGameData.homeTeam.sport.name && team.level === editingGameData.homeTeam.level);
    const rawDate = editingGameData.date.split("T")[0];
    const isoDate = new Date(rawDate).toISOString();

    const updateData = {
      date: isoDate,
      time: editingGameData.time || null,
      homeTeamId: matchingTeam?.id || editingGameData.homeTeamId,
      isHome: editingGameData.isHome,
      busTravel: editingGameData.busTravel,
      actualDepartureTime: editingGameData.actualDepartureTime || null,
      actualArrivalTime: editingGameData.actualArrivalTime || null,
      opponentId: editingGameData.opponentId || editingGameData.opponent?.id || null,
      venueId: !editingGameData.isHome && editingGameData.venueId ? editingGameData.venueId : null,
      status: editingGameData.status,
      customData: editingCustomData,
      notes: editingGameData.notes || null,
    };

    updateGameMutation.mutate({ id: editingGameId, data: updateData });
  };

  const handleCancelEdit = () => {
    setEditingGameId(null);
    setEditingGameData(null);
    setEditingCustomData({});
  };

  const handleDeleteGame = (game: Game) => {
    const hasCalendarEvent = Boolean(game.calendarSynced && game.googleCalendarEventId);
    const message = hasCalendarEvent ? "This will delete the game from both the table and your Google Calendar. Are you sure?" : "Are you sure you want to delete this game?";

    if (confirm(message)) {
      deleteGameMutation.mutate(game.id);
    }
  };

  const handleBulkDelete = () => {
    const count = selectedGames.size;

    if (count === 0) {
      return;
    }

    const selectedIds = Array.from(selectedGames);
    const selectedGameDetails = games.filter((game: Game) => selectedGames.has(game.id));
    const syncedCount = selectedGameDetails.filter((game: any) => game.calendarSynced && game.googleCalendarEventId).length;

    const message =
      syncedCount > 0
        ? `This will delete ${count} selected game${count > 1 ? "s" : ""} and remove ${syncedCount} linked Google Calendar event${syncedCount === 1 ? "" : "s"}. Are you sure?`
        : `Are you sure you want to delete ${count} selected game${count > 1 ? "s" : ""}?`;

    if (confirm(message)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleColumnFilterChange = useCallback(
    (columnId: string, filter: ColumnFilterValue | null) => {
      updateFilter(columnId, filter);
      setPage(0);
    },
    [updateFilter]
  );

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
        return { icon: <Schedule sx={{ fontSize: 16 }} />, color: "#BEDBFE", label: "Pending" };
      case "CANCELLED":
      case "POSTPONED":
        return { icon: <Cancel sx={{ fontSize: 16 }} />, color: "error", label: "No" };
      default:
        return { icon: <Schedule sx={{ fontSize: 16 }} />, color: "default", label: status };
    }
  };

  const isAllSelected = games.length > 0 && selectedGames.size === games.length;
  const isIndeterminate = selectedGames.size > 0 && selectedGames.size < games.length;

  const activeFilterCount = Object.keys(columnFilters).length;

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
          <Typography variant="body2" color="text.primary">
            Manage your athletic schedules and create your own customized columns.
            {activeFilterCount > 0 && (
              <Chip label={`${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`} size="small" color="primary" sx={{ ml: 1, color: "#000" }} onDelete={() => setColumnFilters({})} />
            )}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {selectedGames.size > 0 && (
              <>
                <Button variant="contained" color="primary" startIcon={<GradientSendIcon />} onClick={handleSendEmail} sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}>
                  Send Email ({selectedGames.size})
                </Button>
              </>
            )}
            <Button variant="contained" startIcon={<Add />} onClick={handleNewGame} disabled={isAddingNew} sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}>
              Create Game
            </Button>
            <Button variant="outlined" startIcon={<ViewColumn />} onClick={() => setShowColumnManager(true)} sx={{ textTransform: "none" }}>
              Add Columns ({customColumns.length})
            </Button>
          </Stack>
        </Box>
        <Stack direction="row" spacing={2}>
          {selectedGames.size > 0 && (
            <>
              {/* Delete Button */}
              <LoadingButton
                variant="contained"
                startIcon={!bulkDeleteMutation.isPending && <DeleteOutline />}
                onClick={handleBulkDelete}
                loading={bulkDeleteMutation.isPending}
                sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}
              >
                {bulkDeleteMutation.isPending ? "Deleting..." : `Delete (${selectedGames.size})`}
              </LoadingButton>
            </>
          )}
          <Tooltip title="Import games from CSV">
            <Button variant="outlined" startIcon={<Upload />} onClick={() => setShowImportDialog(true)} sx={{ textTransform: "none" }}>
              Import
            </Button>
          </Tooltip>
          <Tooltip title="Export displayed games to CSV">
            <Button variant="outlined" startIcon={<Download />} onClick={handleExport} disabled={games.length === 0} sx={{ textTransform: "none" }}>
              Export ({games.length})
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {/* Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflowX: "auto",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafc" }}>
              <TableCell padding="checkbox" sx={{ py: 2 }}>
                <Checkbox indeterminate={isIndeterminate} checked={isAllSelected} onChange={handleSelectAll} sx={{ p: 0 }} />
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TableSortLabel active={sortField === "date"} direction={sortField === "date" ? sortOrder : "asc"} onClick={() => handleSort("date")}>
                    DATE
                  </TableSortLabel>
                  <ColumnFilter
                    columnId="date"
                    columnName="Date"
                    columnType="date"
                    uniqueValues={uniqueValues.date || []}
                    currentFilter={columnFilters.date}
                    onFilterChange={handleColumnFilterChange}
                  />
                </Box>
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TableSortLabel active={sortField === "sport"} direction={sortField === "sport" ? sortOrder : "asc"} onClick={() => handleSort("sport")}>
                    SPORT
                  </TableSortLabel>
                  <ColumnFilter
                    columnId="sport"
                    columnName="Sport"
                    columnType="text"
                    uniqueValues={uniqueValues.sport || []}
                    currentFilter={columnFilters.sport}
                    onFilterChange={handleColumnFilterChange}
                  />
                </Box>
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TableSortLabel active={sortField === "level"} direction={sortField === "level" ? sortOrder : "asc"} onClick={() => handleSort("level")}>
                    LEVEL
                  </TableSortLabel>
                  <ColumnFilter
                    columnId="level"
                    columnName="Level"
                    columnType="text"
                    uniqueValues={uniqueValues.level || []}
                    currentFilter={columnFilters.level}
                    onFilterChange={handleColumnFilterChange}
                  />
                </Box>
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TableSortLabel active={sortField === "opponent"} direction={sortField === "opponent" ? sortOrder : "asc"} onClick={() => handleSort("opponent")}>
                    OPPONENT
                  </TableSortLabel>
                  <ColumnFilter
                    columnId="opponent"
                    columnName="Opponent"
                    columnType="text"
                    uniqueValues={uniqueValues.opponent || []}
                    currentFilter={columnFilters.opponent}
                    onFilterChange={handleColumnFilterChange}
                  />
                </Box>
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TableSortLabel active={sortField === "isHome"} direction={sortField === "isHome" ? sortOrder : "asc"} onClick={() => handleSort("isHome")}>
                    H/A
                  </TableSortLabel>
                  <ColumnFilter
                    columnId="isHome"
                    columnName="Home/Away"
                    columnType="select"
                    uniqueValues={["Home", "Away"]}
                    currentFilter={columnFilters.isHome}
                    onFilterChange={handleColumnFilterChange}
                  />
                </Box>
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <TableSortLabel active={sortField === "time"} direction={sortField === "time" ? sortOrder : "asc"} onClick={() => handleSort("time")}>
                  TIME
                </TableSortLabel>
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TableSortLabel active={sortField === "status"} direction={sortField === "status" ? sortOrder : "asc"} onClick={() => handleSort("status")}>
                    CONFIRMED
                  </TableSortLabel>
                  <ColumnFilter
                    columnId="status"
                    columnName="Status"
                    columnType="select"
                    uniqueValues={uniqueValues.status || []}
                    currentFilter={columnFilters.status}
                    onFilterChange={handleColumnFilterChange}
                  />
                </Box>
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TableSortLabel active={sortField === "location"} direction={sortField === "location" ? sortOrder : "asc"} onClick={() => handleSort("location")}>
                    LOCATION
                  </TableSortLabel>
                  <ColumnFilter
                    columnId="location"
                    columnName="Location"
                    columnType="text"
                    uniqueValues={uniqueValues.location || []}
                    currentFilter={columnFilters.location}
                    onFilterChange={handleColumnFilterChange}
                  />
                </Box>
              </TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary", minWidth: 220 }}>NOTES</TableCell>

              <TableCell sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary", whiteSpace: "nowrap" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TableSortLabel active={sortField === "busTravel"} direction={sortField === "busTravel" ? sortOrder : "asc"} onClick={() => handleSort("busTravel")}>
                    BUS INFO
                  </TableSortLabel>
                  <ColumnFilter
                    columnId="busTravel"
                    columnName="Bus Travel"
                    columnType="select"
                    uniqueValues={["Yes", "No"]}
                    currentFilter={columnFilters.busTravel}
                    onFilterChange={handleColumnFilterChange}
                  />
                </Box>
              </TableCell>

              {customColumns.map((column: any) => (
                <TableCell
                  key={column.id}
                  sx={{
                    fontWeight: 600,
                    fontSize: 12,
                    py: 2,
                    color: "text.secondary",
                    minWidth: 150,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {column.name.toUpperCase()}
                    <ColumnFilter
                      columnId={column.id}
                      columnName={column.name}
                      columnType="text"
                      uniqueValues={uniqueValues[column.id] || []}
                      currentFilter={columnFilters[column.id]}
                      onFilterChange={handleColumnFilterChange}
                    />
                  </Box>
                </TableCell>
              ))}

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
                {/* MERGED CELL for Sport + Level */}
                <TableCell colSpan={2} sx={{ py: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => setShowAddTeam(true)} fullWidth sx={{ fontSize: 13, textTransform: "none", justifyContent: "flex-start" }}>
                    {newGameData.sport && newGameData.level ? `${newGameData.sport} - ${newGameData.level}` : "+ Select Team"}
                  </Button>
                </TableCell>
                <TableCell sx={{ py: 1 }}>
                  <Select
                    size="small"
                    value={newGameData.opponentId}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        setShowAddOpponent(true);
                      } else {
                        setNewGameData({ ...newGameData, opponentId: e.target.value });
                      }
                    }}
                    sx={{ width: 140, fontSize: 13 }}
                    displayEmpty
                  >
                    <MenuItem value="">TBD</MenuItem>
                    <MenuItem value="__add_new__" sx={{ color: "primary.main", fontWeight: 600 }}>
                      + Add New Opponent
                    </MenuItem>
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
                  <Select
                    size="small"
                    value={newGameData.venueId}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        setShowAddVenue(true);
                      } else {
                        setNewGameData({ ...newGameData, venueId: e.target.value });
                      }
                    }}
                    sx={{ width: 140, fontSize: 13 }}
                    displayEmpty
                  >
                    <MenuItem value="">TBD</MenuItem>
                    <MenuItem value="__add_new__" sx={{ color: "primary.main", fontWeight: 600 }}>
                      + Add New Venue
                    </MenuItem>
                    {venues.map((venue: any) => (
                      <MenuItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell sx={{ py: 1, minWidth: 220 }}>
                  <TextField
                    size="small"
                    multiline
                    rows={2}
                    fullWidth
                    value={newGameData.notes}
                    onChange={(e) => {
                      const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                      setNewGameData({ ...newGameData, notes: value });
                    }}
                    placeholder="Add notes..."
                    helperText={`${newGameData.notes.length}/${MAX_CHAR_LIMIT}`}
                    FormHelperTextProps={{
                      sx: {
                        fontSize: 10,
                        color: newGameData.notes.length >= MAX_CHAR_LIMIT ? "error.main" : newGameData.notes.length >= MAX_CHAR_LIMIT * 0.9 ? "warning.main" : "text.secondary",
                      },
                    }}
                    sx={{
                      "& .MuiInputBase-input": {
                        fontSize: 13,
                      },
                    }}
                  />
                </TableCell>
                <TableCell sx={{ py: 1, minWidth: 180 }}>
                  <Stack direction="column" spacing={0.75}>
                    <TextField
                      type="time"
                      size="small"
                      label="Depart"
                      value={newGameData.actualDepartureTime || ""}
                      onChange={(e) => setNewGameData({ ...newGameData, actualDepartureTime: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: 11,
                          py: 0.25,
                        },
                        "& .MuiInputLabel-root": {
                          fontSize: 11,
                        },
                      }}
                    />
                    <TextField
                      type="time"
                      size="small"
                      label="Arrive"
                      value={newGameData.actualArrivalTime || ""}
                      onChange={(e) => setNewGameData({ ...newGameData, actualArrivalTime: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: 11,
                          py: 0.25,
                        },
                        "& .MuiInputLabel-root": {
                          fontSize: 11,
                        },
                      }}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Checkbox checked={newGameData.busTravel} onChange={(e) => setNewGameData({ ...newGameData, busTravel: e.target.checked })} sx={{ p: 0 }} />
                      <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>
                        Bus
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                {customColumns.map((column: any) => (
                  <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={newGameData.customData?.[column.id] || ""}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                        setNewGameData({
                          ...newGameData,
                          customData: {
                            ...(newGameData.customData || {}),
                            [column.id]: value,
                          },
                        });
                      }}
                      placeholder={`Enter ${column.name.toLowerCase()}`}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: 13,
                          py: 0.5,
                        },
                      }}
                    />
                  </TableCell>
                ))}
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
                <TableCell colSpan={11 + customColumns.length} align="center" sx={{ py: 8, bgcolor: "white" }}>
                  <Typography color="text.secondary" variant="body2">
                    No games found. Click "Create Game" to add one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              games.map((game: Game) => {
                const confirmedStatus = getConfirmedStatus(game.status);
                const isSelected = selectedGames.has(game.id);
                const isEditing = editingGameId === game.id;
                const isInlineEditing = inlineEditState?.gameId === game.id;

                if (isEditing && editingGameData) {
                  return (
                    <TableRow key={game.id} sx={{ bgcolor: "#fff3e0" }}>
                      {/* Checkbox */}
                      <TableCell padding="checkbox">
                        <Checkbox disabled sx={{ p: 0 }} />
                      </TableCell>

                      {/* Date */}
                      <TableCell sx={{ py: 1 }}>
                        <TextField
                          type="date"
                          size="small"
                          value={extractDatePart(editingGameData.date)}
                          onChange={(e) => {
                            const nextDate = e.target.value;
                            setEditingGameData((prev) => {
                              if (!prev) return prev;
                              const departureInput = toTimeInputValue(prev.actualDepartureTime);
                              const arrivalInput = toTimeInputValue(prev.actualArrivalTime);

                              return {
                                ...prev,
                                date: nextDate,
                                actualDepartureTime: departureInput ? combineDateAndTime(nextDate, departureInput) : null,
                                actualArrivalTime: arrivalInput ? combineDateAndTime(nextDate, arrivalInput) : null,
                              };
                            });
                          }}
                          sx={{
                            width: 140,
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "transparent",
                              "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                              "&:hover fieldset": { borderColor: "primary.main" },
                              "&.Mui-focused fieldset": { borderColor: "primary.main" },
                            },
                          }}
                          InputProps={{ sx: { fontSize: 13 } }}
                        />
                      </TableCell>

                      {/* Sport + Level (merged cell) */}
                      <TableCell colSpan={2} sx={{ py: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setShowAddTeam(true)}
                          fullWidth
                          sx={{
                            fontSize: 13,
                            textTransform: "none",
                            justifyContent: "flex-start",
                            bgcolor: "transparent",
                            "&:hover": { bgcolor: "rgba(0, 0, 0, 0.04)" },
                          }}
                        >
                          {editingGameData.homeTeam.sport.name && editingGameData.homeTeam.level ? `${editingGameData.homeTeam.sport.name} - ${editingGameData.homeTeam.level}` : "+ Select Team"}
                        </Button>
                      </TableCell>

                      {/* Opponent */}
                      <TableCell sx={{ py: 1 }}>
                        <Select
                          size="small"
                          value={editingGameData.opponentId || editingGameData.opponent?.id || ""}
                          onChange={(e) => {
                            if (e.target.value === "__add_new__") setShowAddOpponent(true);
                            else setEditingGameData({ ...editingGameData, opponentId: e.target.value });
                          }}
                          sx={{
                            width: 140,
                            fontSize: 13,
                            bgcolor: "transparent",
                            borderBottom: "#e0e0e0!important",
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: "rgba(0, 0, 0, 0.23)",
                            },
                            "&:hover .MuiOutlinedInput-notchedOutline": {
                              borderColor: "primary.main",
                            },
                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                              borderColor: "primary.main",
                            },
                          }}
                          displayEmpty
                        >
                          <MenuItem value="">TBD</MenuItem>
                          <MenuItem value="__add_new__" sx={{ color: "primary.main", fontWeight: 600 }}>
                            + Add New Opponent
                          </MenuItem>
                          {opponents.map((opponent: any) => (
                            <MenuItem key={opponent.id} value={opponent.id}>
                              {opponent.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>

                      {/* Home/Away */}
                      <TableCell sx={{ py: 1 }}>
                        <Select
                          size="small"
                          value={editingGameData.isHome ? "home" : "away"}
                          onChange={(e) => setEditingGameData({ ...editingGameData, isHome: e.target.value === "home" })}
                          sx={{
                            width: 80,
                            fontSize: 13,
                            bgcolor: "transparent",
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: "rgba(0, 0, 0, 0.23)",
                            },
                            "&:hover .MuiOutlinedInput-notchedOutline": {
                              borderColor: "primary.main",
                            },
                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                              borderColor: "primary.main",
                            },
                          }}
                        >
                          <MenuItem value="home">Home</MenuItem>
                          <MenuItem value="away">Away</MenuItem>
                        </Select>
                      </TableCell>

                      {/* Time */}
                      <TableCell sx={{ py: 1 }}>
                        <TextField
                          type="time"
                          size="small"
                          value={editingGameData.time || ""}
                          onChange={(e) => setEditingGameData({ ...editingGameData, time: e.target.value })}
                          sx={{
                            width: 100,
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "transparent",
                              "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                              "&:hover fieldset": { borderColor: "primary.main" },
                              "&.Mui-focused fieldset": { borderColor: "primary.main" },
                            },
                          }}
                          InputProps={{ sx: { fontSize: 13 } }}
                        />
                      </TableCell>

                      {/* Status */}
                      <TableCell sx={{ py: 1 }}>
                        <Select
                          size="small"
                          value={editingGameData.status}
                          onChange={(e) => setEditingGameData({ ...editingGameData, status: e.target.value })}
                          sx={{
                            width: 110,
                            fontSize: 13,
                            bgcolor: "transparent",
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: "rgba(0, 0, 0, 0.23)",
                            },
                            "&:hover .MuiOutlinedInput-notchedOutline": {
                              borderColor: "primary.main",
                            },
                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                              borderColor: "primary.main",
                            },
                          }}
                        >
                          <MenuItem value="SCHEDULED">Pending</MenuItem>
                          <MenuItem value="CONFIRMED">Yes</MenuItem>
                          <MenuItem value="CANCELLED">No</MenuItem>
                        </Select>
                      </TableCell>

                      {/* Venue */}
                      <TableCell sx={{ py: 1 }}>
                        {editingGameData.isHome ? (
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            Home Field
                          </Typography>
                        ) : (
                          <Select
                            size="small"
                            value={editingGameData.venueId || editingGameData.venue?.id || ""}
                            onChange={(e) => {
                              if (e.target.value === "__add_new__") setShowAddVenue(true);
                              else setEditingGameData({ ...editingGameData, venueId: e.target.value });
                            }}
                            sx={{
                              width: 140,
                              fontSize: 13,
                              bgcolor: "transparent",
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "rgba(0, 0, 0, 0.23)",
                              },
                              "&:hover .MuiOutlinedInput-notchedOutline": {
                                borderColor: "primary.main",
                              },
                              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                borderColor: "primary.main",
                              },
                            }}
                            displayEmpty
                          >
                            <MenuItem value="">TBD</MenuItem>
                            <MenuItem value="__add_new__" sx={{ color: "primary.main", fontWeight: 600 }}>
                              + Add New Venue
                            </MenuItem>
                            {venues.map((venue: any) => (
                              <MenuItem key={venue.id} value={venue.id}>
                                {venue.name}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      </TableCell>

                      {/* Bus Travel */}
                      <TableCell sx={{ py: 1, minWidth: 180 }}>
                        <Stack direction="column" spacing={0.75}>
                          <TextField
                            type="time"
                            size="small"
                            label="Depart"
                            value={toTimeInputValue(editingGameData.actualDepartureTime)}
                            onChange={(e) =>
                              setEditingGameData({
                                ...editingGameData,
                                actualDepartureTime: combineDateAndTime(editingGameData.date, e.target.value),
                              })
                            }
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                bgcolor: "transparent",
                                "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                                "&:hover fieldset": { borderColor: "primary.main" },
                                "&.Mui-focused fieldset": { borderColor: "primary.main" },
                              },
                              "& .MuiInputBase-input": {
                                fontSize: 11,
                                py: 0.25,
                              },
                              "& .MuiInputLabel-root": {
                                fontSize: 11,
                              },
                            }}
                          />
                          <TextField
                            type="time"
                            size="small"
                            label="Arrive"
                            value={toTimeInputValue(editingGameData.actualArrivalTime)}
                            onChange={(e) =>
                              setEditingGameData({
                                ...editingGameData,
                                actualArrivalTime: combineDateAndTime(editingGameData.date, e.target.value),
                              })
                            }
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                bgcolor: "transparent",
                                "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                                "&:hover fieldset": { borderColor: "primary.main" },
                                "&.Mui-focused fieldset": { borderColor: "primary.main" },
                              },
                              "& .MuiInputBase-input": {
                                fontSize: 11,
                                py: 0.25,
                              },
                              "& .MuiInputLabel-root": {
                                fontSize: 11,
                              },
                            }}
                          />
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Checkbox checked={editingGameData.busTravel} onChange={(e) => setEditingGameData({ ...editingGameData, busTravel: e.target.checked })} sx={{ p: 0 }} />
                            <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>
                              Bus
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>

                      {/* Custom Fields */}
                      {customColumns.map((column: any) => (
                        <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
                          <TextField
                            size="small"
                            fullWidth
                            value={editingCustomData[column.id] || ""}
                            onChange={(e) => handleCustomFieldChange(column.id, e.target.value)}
                            placeholder={`Enter ${column.name.toLowerCase()}`}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                bgcolor: "transparent",
                                "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                                "&:hover fieldset": { borderColor: "primary.main" },
                                "&.Mui-focused fieldset": { borderColor: "primary.main" },
                              },
                              "& .MuiInputBase-input": { fontSize: 13, py: 0.5 },
                            }}
                          />
                        </TableCell>
                      ))}

                      {/* Notes */}
                      <TableCell sx={{ py: 1, minWidth: 220 }}>
                        <TextField
                          size="small"
                          multiline
                          rows={3}
                          fullWidth
                          value={editingGameData.notes || ""}
                          onChange={(e) => {
                            const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                            setEditingGameData({ ...editingGameData, notes: value });
                          }}
                          placeholder="Add notes..."
                          helperText={`${editingGameData.notes?.length ?? 0}/${MAX_CHAR_LIMIT}`}
                          FormHelperTextProps={{
                            sx: {
                              fontSize: 10,
                              mt: 0.5,
                              color:
                                (editingGameData.notes?.length ?? 0) >= MAX_CHAR_LIMIT
                                  ? "error.main"
                                  : (editingGameData.notes?.length ?? 0) >= MAX_CHAR_LIMIT * 0.9
                                    ? "warning.main"
                                    : "text.secondary",
                            },
                          }}
                          sx={{
                            "& .MuiInputBase-input": {
                              fontSize: 13,
                            },
                          }}
                        />
                      </TableCell>

                      {/* Save / Cancel Buttons */}
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

                const departureDisplay = formatBusTimeDisplay(game.actualDepartureTime);
                const arrivalDisplay = formatBusTimeDisplay(game.actualArrivalTime);

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
                    <TableCell
                      sx={{
                        fontSize: 13,
                        py: 0,
                        cursor: isInlineEditing && inlineEditState?.field === "date" ? "default" : "pointer",
                        bgcolor: isInlineEditing && inlineEditState?.field === "date" ? "#fff9e6" : "transparent",
                        ...(isInlineEditing &&
                          inlineEditState?.field === "date" && {
                            boxShadow: "inset 0 0 0 1px #DBEAFE",
                          }),
                        "&:hover": {
                          bgcolor: isInlineEditing && inlineEditState?.field === "date" ? "#fff9e6" : "#f5f5f5",
                        },
                      }}
                      onDoubleClick={() => handleDoubleClick(game, "date")}
                    >
                      {isInlineEditing && inlineEditState?.field === "date" ? (
                        <Box sx={{ py: 1 }}>
                          <TextField
                            type="date"
                            size="small"
                            value={inlineEditValue}
                            onChange={(e) => handleInlineValueChange(e.target.value)}
                            onKeyDown={(e) => handleInlineKeyDown(e, game)}
                            onBlur={() => handleInlineBlur(game)}
                            autoFocus
                            disabled={isInlineSaving}
                            sx={{ width: "100%" }}
                            InputProps={{ sx: { fontSize: 13 } }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            {formatGameDate(game.date)}
                          </Typography>
                          {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "date" && <CircularProgress size={12} />}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{game.homeTeam.sport.name}</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 2 }}>{game.homeTeam.level}</TableCell>

                    {/* Opponent Cell - Double-click to edit */}
                    <TableCell
                      sx={{
                        fontSize: 13,
                        py: 0,
                        cursor: isInlineEditing && inlineEditState?.field === "opponent" ? "default" : "pointer",
                        bgcolor: isInlineEditing && inlineEditState?.field === "opponent" ? "#fff9e6" : "transparent",
                        ...(isInlineEditing &&
                          inlineEditState?.field === "opponent" && {
                            boxShadow: "inset 0 0 0 1px #DBEAFE",
                          }),
                        "&:hover": {
                          bgcolor: isInlineEditing && inlineEditState?.field === "opponent" ? "#fff9e6" : "#f5f5f5",
                        },
                      }}
                      onDoubleClick={() => handleDoubleClick(game, "opponent")}
                    >
                      {isInlineEditing && inlineEditState?.field === "opponent" ? (
                        <Select
                          size="small"
                          value={inlineEditValue}
                          onChange={(e) => {
                            if (e.target.value === "__add_new__") {
                              if (saveTimeoutRef.current) {
                                clearTimeout(saveTimeoutRef.current);
                                saveTimeoutRef.current = null;
                              }
                              setShowAddOpponent(true);
                            } else {
                              handleInlineValueChange(e.target.value as string);
                            }
                          }}
                          onKeyDown={(e) => handleInlineKeyDown(e, game)}
                          onBlur={() => handleInlineBlur(game)}
                          autoFocus
                          disabled={isInlineSaving}
                          sx={{ width: "100%", fontSize: 13 }}
                          displayEmpty
                        >
                          <MenuItem value="">TBD</MenuItem>
                          <MenuItem value="__add_new__" sx={{ color: "primary.main", fontWeight: 600 }}>
                            + Add New Opponent
                          </MenuItem>
                          {opponents.map((opponent: any) => (
                            <MenuItem key={opponent.id} value={opponent.id}>
                              {opponent.name}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            {game.opponent?.name || "TBD"}
                          </Typography>
                          {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "opponent" && <CircularProgress size={12} />}
                        </Box>
                      )}
                    </TableCell>

                    {/* Home/Away */}
                    <TableCell sx={{ py: 2 }}>
                      <Chip label={game.isHome ? "Home" : "Away"} size="small" color={game.isHome ? "primary" : "default"} sx={{ fontSize: 11, height: 24, fontWeight: 500 }} />
                    </TableCell>

                    {/* Time Cell - Double-click to edit */}
                    <TableCell
                      sx={{
                        fontSize: 13,
                        py: 0,
                        cursor: isInlineEditing && inlineEditState?.field === "time" ? "default" : "pointer",
                        bgcolor: isInlineEditing && inlineEditState?.field === "time" ? "#fff9e6" : "transparent",
                        ...(isInlineEditing &&
                          inlineEditState?.field === "time" && {
                            boxShadow: "inset 0 0 0 1px #DBEAFE",
                          }),
                        "&:hover": {
                          bgcolor: isInlineEditing && inlineEditState?.field === "time" ? "#fff9e6" : "#f5f5f5",
                        },
                      }}
                      onDoubleClick={() => handleDoubleClick(game, "time")}
                    >
                      {isInlineEditing && inlineEditState?.field === "time" ? (
                        <Box sx={{ py: 1 }}>
                          <TextField
                            type="time"
                            size="small"
                            value={inlineEditValue}
                            onChange={(e) => handleInlineValueChange(e.target.value)}
                            onKeyDown={(e) => handleInlineKeyDown(e, game)}
                            onBlur={() => handleInlineBlur(game)}
                            autoFocus
                            disabled={isInlineSaving}
                            sx={{ width: "100%" }}
                            InputProps={{ sx: { fontSize: 13 } }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            {game.time || "TBD"}
                          </Typography>
                          {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "time" && <CircularProgress size={12} />}
                        </Box>
                      )}
                    </TableCell>

                    {/* Confirmed Status Cell - Double-click to edit */}
                    <TableCell
                      sx={{
                        py: 0,
                        cursor: isInlineEditing && inlineEditState?.field === "status" ? "default" : "pointer",
                        bgcolor: isInlineEditing && inlineEditState?.field === "status" ? "#fff9e6" : "transparent",
                        ...(isInlineEditing &&
                          inlineEditState?.field === "status" && {
                            boxShadow: "inset 0 0 0 1px #DBEAFE",
                          }),
                        "&:hover": {
                          bgcolor: isInlineEditing && inlineEditState?.field === "status" ? "#fff9e6" : "#f5f5f5",
                        },
                      }}
                      onDoubleClick={() => handleDoubleClick(game, "status")}
                    >
                      {isInlineEditing && inlineEditState?.field === "status" ? (
                        <Box sx={{ py: 1 }}>
                          <Select
                            size="small"
                            value={inlineEditValue}
                            onChange={(e) => handleInlineValueChange(e.target.value as string)}
                            onKeyDown={(e) => handleInlineKeyDown(e, game)}
                            onBlur={() => handleInlineBlur(game)}
                            autoFocus
                            disabled={isInlineSaving}
                            sx={{ width: "100%", fontSize: 13 }}
                          >
                            <MenuItem value="SCHEDULED">Pending</MenuItem>
                            <MenuItem value="CONFIRMED">Yes</MenuItem>
                            <MenuItem value="CANCELLED">No</MenuItem>
                          </Select>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
                          <Chip
                            icon={confirmedStatus.icon}
                            label={confirmedStatus.label}
                            size="small"
                            color={confirmedStatus.color as ChipProps["color"]}
                            sx={{
                              fontSize: 11,
                              height: 24,
                              fontWeight: 500,
                              "& .MuiChip-icon": { fontSize: 16 },
                            }}
                          />
                          {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "status" && <CircularProgress size={12} />}
                        </Box>
                      )}
                    </TableCell>

                    {/* Location Cell - Double-click to edit (only for away games) */}
                    <TableCell
                      sx={{
                        fontSize: 13,
                        py: 0,
                        maxWidth: 180,
                        cursor: game.isHome ? "default" : isInlineEditing && inlineEditState?.field === "location" ? "default" : "pointer",
                        bgcolor: isInlineEditing && inlineEditState?.field === "location" ? "#fff9e6" : "transparent",
                        ...(isInlineEditing &&
                          inlineEditState?.field === "location" && {
                            boxShadow: "inset 0 0 0 1px #DBEAFE",
                          }),
                        "&:hover": {
                          bgcolor: game.isHome ? "transparent" : isInlineEditing && inlineEditState?.field === "location" ? "#fff9e6" : "#f5f5f5",
                        },
                      }}
                      onDoubleClick={() => handleDoubleClick(game, "location")}
                    >
                      {isInlineEditing && inlineEditState?.field === "location" && !game.isHome ? (
                        <Select
                          size="small"
                          value={inlineEditValue}
                          onChange={(e) => {
                            if (e.target.value === "__add_new__") {
                              if (saveTimeoutRef.current) {
                                clearTimeout(saveTimeoutRef.current);
                                saveTimeoutRef.current = null;
                              }
                              setShowAddVenue(true);
                            } else {
                              handleInlineValueChange(e.target.value as string);
                            }
                          }}
                          onKeyDown={(e) => handleInlineKeyDown(e, game)}
                          onBlur={() => handleInlineBlur(game)}
                          autoFocus
                          disabled={isInlineSaving}
                          sx={{ width: "100%", fontSize: 13 }}
                          displayEmpty
                        >
                          <MenuItem value="">TBD</MenuItem>
                          <MenuItem value="__add_new__" sx={{ color: "primary.main", fontWeight: 600 }}>
                            + Add New Venue
                          </MenuItem>
                          {venues.map((venue: any) => (
                            <MenuItem key={venue.id} value={venue.id}>
                              {venue.name}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            {game.isHome ? "Home Field" : game.venue?.name || "TBD"}
                          </Typography>
                          {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "location" && <CircularProgress size={12} />}
                        </Box>
                      )}
                    </TableCell>

                    {/* Bus Travel */}
                    <TableCell sx={{ py: 2, minWidth: 180 }}>
                      <Stack spacing={0.75}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary" }}>
                            Depart
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>
                            {departureDisplay}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary" }}>
                            Arrive
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>
                            {arrivalDisplay}
                          </Typography>
                        </Stack>
                        {/* <Chip
                          label={game.busTravel ? "Bus Scheduled" : "No Bus"}
                          size="small"
                          color={game.busTravel ? "success" : "default"}
                          sx={{ fontSize: 11, height: 24, fontWeight: 500 }}
                        /> */}
                      </Stack>
                    </TableCell>

                    {/* Custom Columns */}
                    {customColumns.map((column: any) => {
                      const customData = (game.customData as any) || {};
                      const cellValue = customData[column.id] || "";
                      const fieldKey = `custom:${column.id}` as InlineEditField;
                      const isCustomEditing = isInlineEditing && inlineEditState?.field === fieldKey;

                      return (
                        <TableCell
                          key={column.id}
                          sx={{
                            fontSize: 13,
                            py: 0,
                            minWidth: 150,
                            cursor: isCustomEditing ? "default" : "pointer",
                            bgcolor: isCustomEditing ? "#fff9e6" : "transparent",
                            ...(isCustomEditing && {
                              boxShadow: "inset 0 0 0 1px #DBEAFE",
                            }),
                            "&:hover": {
                              bgcolor: isCustomEditing ? "#fff9e6" : "#f5f5f5",
                            },
                          }}
                          onDoubleClick={() => handleDoubleClick(game, fieldKey)}
                        >
                          {isCustomEditing ? (
                            <Box sx={{ py: 1 }}>
                              <TextField
                                size="small"
                                fullWidth
                                value={inlineEditValue}
                                onChange={(e) => handleInlineValueChange(e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, game)}
                                onBlur={() => handleInlineBlur(game)}
                                autoFocus
                                disabled={isInlineSaving}
                                helperText={`${inlineEditValue.length}/${MAX_CHAR_LIMIT}`}
                                FormHelperTextProps={{
                                  sx: {
                                    fontSize: 10,
                                    color: getCharacterCounterColor(inlineEditValue.length),
                                  },
                                }}
                                sx={{
                                  "& .MuiInputBase-input": {
                                    fontSize: 13,
                                  },
                                }}
                              />
                              {inlineEditError && inlineEditState?.field === fieldKey && (
                                <Typography variant="caption" sx={{ fontSize: 10, color: "error.main", display: "block", mt: 0.5 }}>
                                  {inlineEditError}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
                              <Typography variant="body2" sx={{ fontSize: 13 }}>
                                {cellValue || "—"}
                              </Typography>
                              {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === fieldKey && <CircularProgress size={12} />}
                            </Box>
                          )}
                        </TableCell>
                      );
                    })}

                    {/* Notes Cell - Double-click to edit */}
                    <TableCell
                      sx={{
                        fontSize: 13,
                        py: 0,
                        minWidth: 220,
                        cursor: isInlineEditing && inlineEditState?.field === "notes" ? "default" : "pointer",
                        bgcolor: isInlineEditing && inlineEditState?.field === "notes" ? "#fff9e6" : "transparent",
                        ...(isInlineEditing &&
                          inlineEditState?.field === "notes" && {
                            boxShadow: "inset 0 0 0 1px #DBEAFE",
                          }),
                        "&:hover": {
                          bgcolor: isInlineEditing && inlineEditState?.field === "notes" ? "#fff9e6" : "#f5f5f5",
                        },
                      }}
                      onDoubleClick={() => handleDoubleClick(game, "notes")}
                    >
                      {isInlineEditing && inlineEditState?.field === "notes" ? (
                        <Box sx={{ py: 1 }}>
                          <TextareaAutosize
                            value={inlineEditValue}
                            onChange={(e) => {
                              const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                              setInlineEditValue(value);
                            }}
                            onKeyDown={(e) => handleInlineKeyDown(e, game)}
                            onBlur={() => handleInlineBlur(game)}
                            autoFocus
                            minRows={3}
                            maxRows={6}
                            placeholder="Add notes..."
                            disabled={isInlineSaving}
                            style={{
                              width: "100%",
                              fontSize: "13px",
                              fontFamily: theme.typography.fontFamily,
                              padding: "8px",
                              border: `1px solid ${theme.palette.divider}`,
                              borderRadius: "4px",
                              resize: "vertical",
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: 10,
                              color: getCharacterCounterColor(inlineEditValue.length),
                              mt: 0.5,
                              display: "block",
                            }}
                          >
                            {inlineEditValue.length}/{MAX_CHAR_LIMIT}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: 13,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {getNotesPreview(game.notes)}
                          </Typography>
                          {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "notes" && <CircularProgress size={12} />}
                        </Box>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell sx={{ py: 2 }}>
                      <Stack direction="row" spacing={0}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditGame(game)} sx={{ p: 0.5 }}>
                            <Edit sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Sync to Google">
                          <IconButton size="small" sx={{ p: 0.5 }} onClick={() => handleSyncCalendar(game.id)} disabled={syncGameMutation.isPending}>
                            {syncGameMutation.isPending && syncGameMutation.variables === game.id ? <CircularProgress size={16} /> : <Sync sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteGame(game)} sx={{ p: 0.5 }}>
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

      {/* Pagination */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mt: 3,
          px: 2,
        }}
      >
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

      <CustomColumnManager open={showColumnManager} onClose={() => setShowColumnManager(false)} />

      {showImportDialog && <CSVImport onImportComplete={handleImportComplete} onClose={() => setShowImportDialog(false)} />}

      <QuickAddOpponent
        open={showAddOpponent}
        onClose={() => setShowAddOpponent(false)}
        onCreated={(opponentId) => {
          // Handle inline edit state
          if (inlineEditState?.field === "opponent") {
            setInlineEditValue(opponentId);
            // Don't close inline edit, let user see the change
          }
          // Handle new game state
          if (isAddingNew) {
            setNewGameData({ ...newGameData, opponentId });
          }
          // Handle full edit state
          if (editingGameData) {
            setEditingGameData({ ...editingGameData, opponentId });
          }
        }}
      />

      <QuickAddVenue
        open={showAddVenue}
        onClose={() => setShowAddVenue(false)}
        onCreated={(venueId) => {
          // Handle inline edit state
          if (inlineEditState?.field === "location") {
            setInlineEditValue(venueId);
            // Don't close inline edit, let user see the change
          }
          // Handle new game state
          if (isAddingNew) {
            setNewGameData({ ...newGameData, venueId });
          }
          // Handle full edit state
          if (editingGameData) {
            setEditingGameData({ ...editingGameData, venueId });
          }
        }}
      />

      <QuickAddTeam
        open={showAddTeam}
        onClose={() => setShowAddTeam(false)}
        onCreated={(sport, level) => {
          setNewGameData({ ...newGameData, sport, level });
          if (editingGameData && editingGameData.homeTeam) {
            setEditingGameData({
              ...editingGameData,
              homeTeam: {
                ...editingGameData.homeTeam,
                sport: { name: sport },
                level,
              },
            });
          }
        }}
      />
    </Box>
  );
}
