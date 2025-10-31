"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingButton } from "../utils/LoadingButton";
import { CustomColumnManager } from "./CustomColumnManager";
import { ColumnPreferencesMenu } from "./ColumnPreferencesMenu";
import { ColumnFilter, ColumnFilterValue } from "./ColumnFilter";
import dynamic from "next/dynamic";
import { ExportService } from "@/lib/services/exportService";
import { QuickAddOpponent } from "./QuickAddOpponent";
import { QuickAddVenue } from "./QuickAddVenue";
import { QuickAddTeam } from "./QuickAddTeams";
import { Sync, ViewColumn, Download, Upload, Tune } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/contexts/NotificationContext";
import { GradientSendIcon } from "@/components/icons/GradientSendIcon";
import { ChipProps } from "@mui/material/Chip";
import { useGamesFiltersStore } from "@/lib/stores/gamesFiltersStore";
import { useGamesTableStore } from "@/lib/stores/gamesTableStore";

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
import {
  CheckCircle,
  Cancel,
  Schedule,
  Edit,
  Delete,
  CalendarMonth,
  Add,
  Send,
  NavigateBefore,
  NavigateNext,
  FirstPage,
  LastPage,
  Check,
  Close,
  DeleteOutline,
  ContentCopy,
} from "@mui/icons-material";
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

const formatTimeDisplay = (timeString: string | null): string => {
  if (!timeString) return "TBD";
  try {
    // Parse HH:MM format and convert to 12-hour display
    const [hours, minutes] = timeString.split(":");
    if (!hours || !minutes) return timeString;
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    return format(date, "h:mm a");
  } catch (error) {
    return timeString;
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
  location?: string | null;
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
  location: string;
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

type StaticColumnId = "date" | "sport" | "level" | "opponent" | "isHome" | "time" | "status" | "location" | "busTravel" | "notes" | "actions";
type ColumnId = StaticColumnId | `custom:${string}`;

interface ColumnStateConfig {
  id: ColumnId;
  visible: boolean;
}

interface TablePreferencesData {
  order?: ColumnId[];
  hidden?: ColumnId[];
  [key: string]: unknown;
}

interface ColumnPreferencePayload {
  order: ColumnId[];
  hidden: ColumnId[];
}

interface ResolvedColumn {
  id: ColumnId;
  customColumn?: any;
}

const TABLE_PREFERENCES_KEY = "games";
const STATIC_COLUMN_SEQUENCE: StaticColumnId[] = ["date", "sport", "level", "opponent", "isHome", "time", "status", "location", "busTravel", "notes", "actions"];

const PRESET_SPORTS = ["Boys Basketball", "Girls Basketball", "Boys Flag Football", "Girls Flag Football", "Girls Tennis", "Boys Tennis", "Boys Soccer", "Girls Soccer", "Boys Cross Country"];

const PRESET_LEVELS = ["VARSITY", "JV", "FRESHMAN"];

export function GamesTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);

  const {
    page,
    rowsPerPage,
    setPage,
    setRowsPerPage,
    sortField,
    sortOrder,
    setSortField,
    setSortOrder,
    isAddingNew,
    setIsAddingNew,
    newGameData,
    updateNewGameData,
    resetNewGameData,
    setNewGameData,
    editingGameId,
    setEditingGameId,
    editingCustomData,
    setEditingCustomData,
    updateEditingCustomData,
    resetEditingState,
    selectedGameIds,
    setSelectedGameIds,
    clearSelectedGameIds,
  } = useGamesTableStore();

  const selectedGames = useMemo(() => new Set(selectedGameIds), [selectedGameIds]);

  const [editingGameData, setEditingGameData] = useState<Game | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const columnFilters = useGamesFiltersStore((state) => state.columnFilters);
  const setColumnFilters = useGamesFiltersStore((state) => state.setColumnFilters);
  const updateFilter = useGamesFiltersStore((state) => state.updateFilter);

  const [showColumnManager, setShowColumnManager] = useState(false);

  const [showAddOpponent, setShowAddOpponent] = useState(false);
  const [showAddVenue, setShowAddVenue] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [isColumnPreferencesOpen, setIsColumnPreferencesOpen] = useState(false);
  const [columnState, setColumnState] = useState<ColumnStateConfig[]>([]);
  const [initialPreferencesApplied, setInitialPreferencesApplied] = useState(false);

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

  const { data: columnPreferencesResponse } = useQuery({
    queryKey: ["tablePreferences", TABLE_PREFERENCES_KEY],
    queryFn: async () => {
      const res = await fetch(`/api/user/table-preferences?table=${TABLE_PREFERENCES_KEY}`);
      if (!res.ok) throw new Error("Failed to fetch column preferences");
      return res.json();
    },
  });

  const customColumns = useMemo(() => (customColumnsResponse?.data || []) as any[], [customColumnsResponse?.data]);
  const customColumnsMap = useMemo(() => {
    const map = new Map<string, any>();
    customColumns.forEach((column: any) => {
      if (column?.id) {
        map.set(column.id, column);
      }
    });
    return map;
  }, [customColumns]);

  const columnPreferencesData = useMemo<TablePreferencesData | null>(() => (columnPreferencesResponse?.data as TablePreferencesData | null) ?? null, [columnPreferencesResponse?.data]);
  const defaultColumnOrder = useMemo(() => getDefaultColumnOrder(customColumns), [customColumns]);

  useEffect(() => {
    setColumnState((prev) => deriveColumnState(prev, columnPreferencesData, defaultColumnOrder, initialPreferencesApplied));
  }, [columnPreferencesData, defaultColumnOrder, initialPreferencesApplied]);

  useEffect(() => {
    if (!initialPreferencesApplied && columnPreferencesResponse !== undefined) {
      setInitialPreferencesApplied(true);
    }
  }, [columnPreferencesResponse, initialPreferencesApplied]);

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

  const uniqueSports = useMemo<string[]>(() => {
    const sports = teams.map((team: any) => team.sport?.name).filter((sport: any): sport is string => typeof sport === "string" && sport.length > 0);
    const allSports = [...new Set([...PRESET_SPORTS, ...sports])];
    return allSports.sort();
  }, [teams]);

  const uniqueLevels = useMemo<string[]>(() => {
    const levels = teams.map((team: any) => team.level).filter((level: any): level is string => typeof level === "string" && level.length > 0);
    const allLevels = [...new Set([...PRESET_LEVELS, ...levels])];
    return allLevels;
  }, [teams]);

  const levelsBySport = useMemo(() => {
    const map = new Map<string, string[]>();
    teams.forEach((team: any) => {
      const sportName = team.sport?.name;
      const level = team.level;
      if (!sportName || !level) return;
      const existing = map.get(sportName) || [];
      if (!existing.includes(level)) {
        existing.push(level);
        map.set(sportName, existing);
      }
    });
    return map;
  }, [teams]);

  const getLevelsForSport = useCallback(
    (sportName?: string | null) => {
      if (!sportName) {
        return uniqueLevels;
      }
      const levels = levelsBySport.get(sportName);
      if (levels && levels.length > 0) {
        const allLevels = [...new Set([...PRESET_LEVELS, ...levels])];
        return allLevels;
      }
      return PRESET_LEVELS;
    },
    [levelsBySport, uniqueLevels]
  );

  const uniqueValues = useMemo(() => {
    const values: Record<string, Set<string>> = {
      sport: new Set(),
      level: new Set(),
      opponent: new Set(),
      status: new Set(),
      location: new Set(),
      busTravel: new Set(),
      notes: new Set(["Has notes", "No notes"]),
    };

    customColumns.forEach((col: any) => {
      values[col.id] = new Set();
    });

    games.forEach((game: Game) => {
      values.sport.add(game.homeTeam.sport.name);
      values.level.add(game.homeTeam.level);
      values.opponent.add(game.opponent?.name || "TBD");
      values.status.add(game.status);
      const locationValue = game.location || (game.venue?.name || "TBD");
      values.location.add(locationValue);
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

  const getColumnLabel = useCallback(
    (columnId: ColumnId) => {
      switch (columnId) {
        case "date":
          return "Date";
        case "sport":
          return "Sport";
        case "level":
          return "Level";
        case "opponent":
          return "Opponent";
        case "isHome":
          return "Home/Away";
        case "time":
          return "Time";
        case "status":
          return "Confirmed";
        case "location":
          return "Location";
        case "busTravel":
          return "Bus Info";
        case "notes":
          return "Notes";
        case "actions":
          return "Actions";
        default: {
          if (columnId.startsWith("custom:")) {
            const customId = columnId.split(":")[1];
            return customColumnsMap.get(customId)?.name || "Custom Field";
          }
          return "Column";
        }
      }
    },
    [customColumnsMap]
  );

  const hiddenColumnCount = useMemo(() => columnState.filter((column) => !column.visible).length, [columnState]);

  const visibleColumns = useMemo(() => columnState.filter((column) => column.visible), [columnState]);

  const resolvedColumns = useMemo(() => {
    const list: ResolvedColumn[] = [];
    visibleColumns.forEach((column) => {
      if (column.id.startsWith("custom:")) {
        const customId = column.id.split(":")[1];
        const customColumn = customColumnsMap.get(customId);
        if (customColumn) {
          list.push({ id: column.id, customColumn });
        }
      } else {
        list.push({ id: column.id });
      }
    });
    return list;
  }, [visibleColumns, customColumnsMap]);

  const columnMenuColumns = useMemo(
    () =>
      columnState.map((column) => ({
        id: column.id,
        label: getColumnLabel(column.id),
        visible: column.visible,
      })),
    [columnState, getColumnLabel]
  );

  const visibleCustomColumns = useMemo(() => {
    const visibleIds = new Set(columnState.filter((column) => column.visible && column.id.startsWith("custom:")).map((column) => column.id.split(":")[1]));
    return customColumns.filter((column: any) => visibleIds.has(column.id));
  }, [columnState, customColumns]);

  const visibleColumnIds = useMemo(() => columnState.filter((column) => column.visible).map((column) => column.id), [columnState]);

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

  const savePreferencesMutation = useMutation({
    mutationFn: async (payload: ColumnPreferencePayload) => {
      const res = await fetch("/api/user/table-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: TABLE_PREFERENCES_KEY, preferences: payload }),
      });
      if (!res.ok) {
        let message = "Failed to save column preferences";
        try {
          const error = await res.json();
          message = error?.error || message;
        } catch (err) {
          // ignore
        }
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tablePreferences", TABLE_PREFERENCES_KEY] });
    },
  });

  const persistColumnPreferences = useCallback(
    (nextState: ColumnStateConfig[], previousState: ColumnStateConfig[]) => {
      const payload: ColumnPreferencePayload = {
        order: nextState.map((column) => column.id),
        hidden: nextState.filter((column) => !column.visible).map((column) => column.id),
      };
      savePreferencesMutation.mutate(payload, {
        onError: (error: any) => {
          setColumnState(previousState);
          addNotification(error?.message || "Failed to save column preferences", "error");
        },
      });
    },
    [savePreferencesMutation, addNotification]
  );

  const handleToggleColumnVisibility = useCallback(
    (columnId: string, visible: boolean) => {
      if (!isColumnId(columnId)) {
        return;
      }
      setColumnState((prev) => {
        const previousState = prev.map((column) => ({ ...column }));
        const nextState = prev.map((column) => (column.id === columnId ? { ...column, visible } : column));
        const visibleCount = nextState.filter((column) => column.visible).length;
        if (visibleCount === 0) {
          addNotification("At least one column must remain visible", "warning");
          return prev;
        }
        persistColumnPreferences(nextState, previousState);
        return nextState;
      });
    },
    [persistColumnPreferences, addNotification]
  );

  const handleReorderColumns = useCallback(
    (order: string[]) => {
      const validOrder = order.filter((value): value is ColumnId => isColumnId(value));
      setColumnState((prev) => {
        const previousState = prev.map((column) => ({ ...column }));
        const cleanedOrder = validOrder.filter((id) => defaultColumnOrder.includes(id));
        const nextOrder = [...cleanedOrder];
        defaultColumnOrder.forEach((id) => {
          if (!nextOrder.includes(id)) {
            nextOrder.push(id);
          }
        });
        const visibilityMap = new Map(prev.map((column) => [column.id, column.visible]));
        const nextState = nextOrder.map((id) => ({
          id,
          visible: visibilityMap.get(id) ?? true,
        }));
        persistColumnPreferences(nextState, previousState);
        return nextState;
      });
    },
    [defaultColumnOrder, persistColumnPreferences]
  );

  const handleShowAllColumns = useCallback(() => {
    setColumnState((prev) => {
      const previousState = prev.map((column) => ({ ...column }));
      const nextState = prev.map((column) => ({ ...column, visible: true }));
      persistColumnPreferences(nextState, previousState);
      return nextState;
    });
  }, [persistColumnPreferences]);

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
      resetNewGameData();

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
      resetEditingState();
      setEditingGameData(null);

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
      clearSelectedGameIds();
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
            currentValue = game.location || "";
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
          updateData.location = inlineEditValue.slice(0, MAX_CHAR_LIMIT) || null;
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

    ExportService.exportGames(gamesToExport, visibleCustomColumns);
  }, [games, visibleCustomColumns, addNotification]);

  const handleImportComplete = useCallback(
    (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setShowImportDialog(false);

      const message = `Import complete! ${result.success} games imported successfully${result.failed > 0 ? `, ${result.failed} failed` : ""}`;

      addNotification(message, result.failed > 0 ? "warning" : "success");
    },
    [queryClient, addNotification]
  );

  const handleSaveNewGame = async () => {
    if (!newGameData.sport || !newGameData.level) {
      addNotification("Please select sport and level", "error");
      return;
    }

    let matchingTeam = teams.find((team: any) => team.sport?.name === newGameData.sport && team.level === newGameData.level);

    if (!matchingTeam) {
      try {
        const sportRes = await fetch("/api/sports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newGameData.sport,
            season: "FALL",
          }),
        });

        let sportData;
        if (sportRes.ok) {
          sportData = await sportRes.json();
        } else {
          const existingSportRes = await fetch(`/api/sports?name=${encodeURIComponent(newGameData.sport)}`);
          if (existingSportRes.ok) {
            sportData = await existingSportRes.json();
          } else {
            throw new Error("Failed to create or find sport");
          }
        }

        const sportId = sportData.data?.id || sportData.id;

        const teamRes = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${newGameData.sport} ${newGameData.level}`,
            sportId,
            level: newGameData.level,
          }),
        });

        if (!teamRes.ok) {
          const error = await teamRes.json();
          throw new Error(error.error || "Failed to create team");
        }

        const teamData = await teamRes.json();
        matchingTeam = teamData.data;

        queryClient.invalidateQueries({ queryKey: ["teams"] });
      } catch (error: any) {
        addNotification(error.message || "Failed to create team", "error");
        return;
      }
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
      venueId: newGameData.venueId || null,
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
      updateEditingCustomData(columnId, limitedValue);
    },
    [MAX_CHAR_LIMIT, updateEditingCustomData]
  );

  const handleCancelNewGame = () => {
    resetNewGameData();
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

  const handleSaveEdit = async () => {
    if (!editingGameData || !editingGameId) return;

    const sportName = editingGameData.homeTeam.sport.name;
    const level = editingGameData.homeTeam.level;

    if (!sportName || !level) {
      addNotification("Please select sport and level", "error");
      return;
    }

    let matchingTeam = teams.find((team: any) => team.sport?.name === sportName && team.level === level);

    if (!matchingTeam) {
      try {
        const sportRes = await fetch("/api/sports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sportName,
            season: "FALL",
          }),
        });

        let sportData;
        if (sportRes.ok) {
          sportData = await sportRes.json();
        } else {
          const existingSportRes = await fetch(`/api/sports?name=${encodeURIComponent(sportName)}`);
          if (existingSportRes.ok) {
            sportData = await existingSportRes.json();
          } else {
            throw new Error("Failed to create or find sport");
          }
        }

        const sportId = sportData.data?.id || sportData.id;

        const teamRes = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${sportName} ${level}`,
            sportId,
            level: level,
          }),
        });

        if (!teamRes.ok) {
          const error = await teamRes.json();
          throw new Error(error.error || "Failed to create team");
        }

        const teamData = await teamRes.json();
        matchingTeam = teamData.data;

        queryClient.invalidateQueries({ queryKey: ["teams"] });
      } catch (error: any) {
        addNotification(error.message || "Failed to create team", "error");
        return;
      }
    }

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
      venueId: editingGameData.venueId || editingGameData.venue?.id || null,
      status: editingGameData.status,
      customData: editingCustomData,
      notes: editingGameData.notes || null,
    };

    updateGameMutation.mutate({ id: editingGameId, data: updateData });
  };

  const handleCancelEdit = () => {
    resetEditingState();
    setEditingGameData(null);
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
    clearSelectedGameIds();
  };

  const handleChangeRowsPerPage = (value: number) => {
    setRowsPerPage(value);
    setPage(0);
    clearSelectedGameIds();
  };

  const handleFirstPage = () => {
    setPage(0);
    clearSelectedGameIds();
  };

  const handleLastPage = () => {
    setPage(pagination.totalPages - 1);
    clearSelectedGameIds();
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
      const allGameIds = games.map((game: Game) => game.id);
      setSelectedGameIds(allGameIds);
    } else {
      setSelectedGameIds([]);
    }
  };

  const handleSelectGame = (gameId: string) => {
    const newSelected = new Set(selectedGameIds);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
    } else {
      newSelected.add(gameId);
    }
    setSelectedGameIds(Array.from(newSelected));
  };

  const handleSendEmail = () => {
    if (typeof window === "undefined") return;
    const selectedGamesData = games.filter((game: Game) => selectedGames.has(game.id));
    const opponentFilter = columnFilters.opponent;
    sessionStorage.setItem("selectedGames", JSON.stringify(selectedGamesData));
    sessionStorage.setItem("gamesTableVisibleColumns", JSON.stringify(visibleColumnIds));
    sessionStorage.setItem("gamesOpponentFilter", JSON.stringify(opponentFilter || null));
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

  const handleCopySelectedRows = useCallback(() => {
    if (selectedGames.size === 0) {
      addNotification("No rows selected to copy", "warning");
      return;
    }

    const selectedGamesData = games.filter((game: Game) => selectedGames.has(game.id));

    const columnsToInclude = resolvedColumns.filter((col) => col.id !== "actions");

    const rows = selectedGamesData.map((game: any) => {
      const row: string[] = [];
      columnsToInclude.forEach((col) => {
        let cellValue = "";
        switch (col.id) {
          case "date":
            cellValue = formatGameDate(game.date);
            break;
          case "sport":
            cellValue = game.homeTeam.sport.name;
            break;
          case "level":
            cellValue = game.homeTeam.level;
            break;
          case "opponent":
            cellValue = game.opponent?.name || "TBD";
            break;
          case "isHome":
            cellValue = game.isHome ? "Home" : "Away";
            break;
          case "time":
            cellValue = formatTimeDisplay(game.time);
            break;
          case "status":
            cellValue = game.status;
            break;
          case "location":
            cellValue = game.venue?.name || "TBD";
            break;
          case "busTravel":
            cellValue = formatBusTimeDisplay(game.actualDepartureTime) + " / " + formatBusTimeDisplay(game.actualArrivalTime);
            break;
          case "notes":
            cellValue = game.notes || "";
            break;
          default:
            if (col.id.startsWith("custom:")) {
              const customId = col.id.split(":")[1];
              const customData = (game.customData as any) || {};
              cellValue = customData[customId] || "";
            }
        }
        row.push(cellValue);
      });
      return row.join("\t");
    });

    const tsvContent = rows.join("\n");

    navigator.clipboard.writeText(tsvContent).then(
      () => {
        addNotification(`Copied ${selectedGames.size} row${selectedGames.size > 1 ? "s" : ""} to clipboard`, "success");
      },
      () => {
        addNotification("Failed to copy to clipboard", "error");
      }
    );
  }, [selectedGames, games, resolvedColumns, getColumnLabel, formatGameDate, addNotification]);

  const renderHeaderCell = (column: ResolvedColumn) => {
    switch (column.id) {
      case "date":
        return (
          <TableCell key="date" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <TableSortLabel active={sortField === "date"} direction={sortField === "date" ? sortOrder : "asc"} onClick={() => handleSort("date")}>
                DATE
              </TableSortLabel>
              <ColumnFilter columnId="date" columnName="Date" columnType="date" uniqueValues={uniqueValues.date || []} currentFilter={columnFilters.date} onFilterChange={handleColumnFilterChange} />
            </Box>
          </TableCell>
        );
      case "sport":
        return (
          <TableCell key="sport" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
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
        );
      case "level":
        return (
          <TableCell key="level" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
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
        );
      case "opponent":
        return (
          <TableCell key="opponent" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
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
        );
      case "isHome":
        return (
          <TableCell key="isHome" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
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
        );
      case "time":
        return (
          <TableCell key="time" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <TableSortLabel active={sortField === "time"} direction={sortField === "time" ? sortOrder : "asc"} onClick={() => handleSort("time")}>
              TIME
            </TableSortLabel>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
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
        );
      case "location":
        return (
          <TableCell key="location" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
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
        );
      case "busTravel":
        return (
          <TableCell key="busTravel" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary", whiteSpace: "nowrap" }}>
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
        );
      case "notes":
        return (
          <TableCell key="notes" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary", minWidth: 220 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <TableSortLabel active={sortField === "notes"} direction={sortField === "notes" ? sortOrder : "asc"} onClick={() => handleSort("notes")}>
                NOTES
              </TableSortLabel>
              <ColumnFilter
                columnId="notes"
                columnName="Notes"
                columnType="text"
                uniqueValues={uniqueValues.notes || []}
                currentFilter={columnFilters.notes}
                onFilterChange={handleColumnFilterChange}
              />
            </Box>
          </TableCell>
        );
      case "actions":
        return (
          <TableCell key="actions" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            ACTIONS
          </TableCell>
        );
      default:
        if (column.id.startsWith("custom:")) {
          const customColumn = column.customColumn;
          if (!customColumn) {
            return null;
          }
          return (
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
                {customColumn.name?.toUpperCase?.() || "CUSTOM"}
                <ColumnFilter
                  columnId={customColumn.id}
                  columnName={customColumn.name}
                  columnType="text"
                  uniqueValues={uniqueValues[customColumn.id] || []}
                  currentFilter={columnFilters[customColumn.id]}
                  onFilterChange={handleColumnFilterChange}
                />
              </Box>
            </TableCell>
          );
        }
        return null;
    }
  };

  const renderNewRowCell = (column: ResolvedColumn) => {
    switch (column.id) {
      case "date":
        return (
          <TableCell key="date" sx={{ py: 1 }}>
            <TextField type="date" size="small" value={newGameData.date} onChange={(e) => updateNewGameData({ date: e.target.value })} sx={{ width: 140 }} InputProps={{ sx: { fontSize: 13 } }} />
          </TableCell>
        );
      case "sport":
        return (
          <TableCell key="sport" sx={{ py: 1, minWidth: 180 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Select
                size="small"
                value={newGameData.sport}
                onChange={(e) => {
                  const sport = e.target.value as string;
                  const levels = getLevelsForSport(sport);
                  const levelIsValid = sport && newGameData.level ? levels.includes(newGameData.level) : true;
                  updateNewGameData({
                    sport,
                    level: levelIsValid ? newGameData.level : "",
                  });
                }}
                displayEmpty
                sx={{ minWidth: 140, fontSize: 13 }}
              >
                <MenuItem value="">Select sport</MenuItem>
                {uniqueSports.map((sport: string) => (
                  <MenuItem key={sport} value={sport}>
                    {sport}
                  </MenuItem>
                ))}
              </Select>
              <Tooltip title="Add new team">
                <IconButton size="small" onClick={() => setShowAddTeam(true)} sx={{ p: 0.5 }}>
                  <Add fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </TableCell>
        );
      case "level":
        return (
          <TableCell key="level" sx={{ py: 1, minWidth: 150 }}>
            <Select size="small" value={newGameData.level} onChange={(e) => updateNewGameData({ level: e.target.value as string })} displayEmpty sx={{ minWidth: 140, fontSize: 13 }}>
              <MenuItem value="">Select level</MenuItem>
              {getLevelsForSport(newGameData.sport).map((level) => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        );
      case "opponent":
        return (
          <TableCell key="opponent" sx={{ py: 1 }}>
            <Select
              size="small"
              value={newGameData.opponentId}
              onChange={(e) => {
                if (e.target.value === "__add_new__") {
                  setShowAddOpponent(true);
                } else {
                  updateNewGameData({ opponentId: e.target.value as string });
                }
              }}
              sx={{ width: 160, fontSize: 13 }}
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
        );
      case "isHome":
        return (
          <TableCell key="isHome" sx={{ py: 1 }}>
            <Select size="small" value={newGameData.isHome ? "home" : "away"} onChange={(e) => updateNewGameData({ isHome: e.target.value === "home" })} sx={{ width: 80, fontSize: 13 }}>
              <MenuItem value="home">Home</MenuItem>
              <MenuItem value="away">Away</MenuItem>
            </Select>
          </TableCell>
        );
      case "time":
        return (
          <TableCell key="time" sx={{ py: 1 }}>
            <TextField type="time" size="small" value={newGameData.time} onChange={(e) => updateNewGameData({ time: e.target.value })} sx={{ width: 100 }} InputProps={{ sx: { fontSize: 13 } }} />
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" sx={{ py: 1 }}>
            <Select size="small" value={newGameData.status} onChange={(e) => updateNewGameData({ status: e.target.value as string })} sx={{ width: 110, fontSize: 13 }}>
              <MenuItem value="SCHEDULED">Pending</MenuItem>
              <MenuItem value="CONFIRMED">Yes</MenuItem>
              <MenuItem value="CANCELLED">No</MenuItem>
            </Select>
          </TableCell>
        );
      case "location":
        return (
          <TableCell key="location" sx={{ py: 1, minWidth: 180 }}>
            <TextField
              size="small"
              fullWidth
              value={newGameData.location || ""}
              onChange={(e) => {
                const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                updateNewGameData({ location: value });
              }}
              placeholder="Enter location..."
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: 13,
                  py: 0.5,
                },
              }}
            />
          </TableCell>
        );
      case "busTravel":
        return (
          <TableCell key="busTravel" sx={{ py: 1, minWidth: 180 }}>
            <Stack direction="column" spacing={0.75}>
              <TextField
                type="time"
                size="small"
                label="Depart"
                value={newGameData.actualDepartureTime || ""}
                onChange={(e) => updateNewGameData({ actualDepartureTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{
                  "& .MuiInputBase-input": { fontSize: 11, py: 0.25 },
                  "& .MuiInputLabel-root": { fontSize: 11 },
                }}
              />
              <TextField
                type="time"
                size="small"
                label="Arrive"
                value={newGameData.actualArrivalTime || ""}
                onChange={(e) => updateNewGameData({ actualArrivalTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{
                  "& .MuiInputBase-input": { fontSize: 11, py: 0.25 },
                  "& .MuiInputLabel-root": { fontSize: 11 },
                }}
              />
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Checkbox checked={newGameData.busTravel} onChange={(e) => updateNewGameData({ busTravel: e.target.checked })} sx={{ p: 0 }} />
                <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>
                  Bus
                </Typography>
              </Box>
            </Stack>
          </TableCell>
        );
      case "notes":
        return (
          <TableCell key="notes" sx={{ py: 1, minWidth: 220 }}>
            <TextField
              size="small"
              multiline
              rows={2}
              fullWidth
              value={newGameData.notes}
              onChange={(e) => {
                const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                updateNewGameData({ notes: value });
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
        );
      case "actions":
        return (
          <TableCell key="actions" sx={{ py: 1 }}>
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
        );
      default:
        if (column.id.startsWith("custom:")) {
          const customColumn = column.customColumn;
          if (!customColumn) return null;
          return (
            <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
              <TextField
                size="small"
                fullWidth
                value={newGameData.customData?.[customColumn.id] || ""}
                onChange={(e) => {
                  const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                  updateNewGameData({
                    customData: {
                      ...(newGameData.customData || {}),
                      [customColumn.id]: value,
                    },
                  });
                }}
                placeholder={`Enter ${customColumn.name?.toLowerCase?.() || "value"}`}
                sx={{
                  "& .MuiInputBase-input": {
                    fontSize: 13,
                    py: 0.5,
                  },
                }}
              />
            </TableCell>
          );
        }
        return null;
    }
  };

  const renderEditingRowCell = (column: ResolvedColumn, editingGame: Game) => {
    switch (column.id) {
      case "date":
        return (
          <TableCell key="date" sx={{ py: 1 }}>
            <TextField
              type="date"
              size="small"
              value={extractDatePart(editingGame.date)}
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
        );
      case "sport":
        return (
          <TableCell key="sport" sx={{ py: 1, minWidth: 180 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Select
                size="small"
                value={editingGame.homeTeam.sport.name}
                onChange={(e) => {
                  const sport = e.target.value as string;
                  setEditingGameData((prev) => {
                    if (!prev) return prev;
                    const levels = getLevelsForSport(sport);
                    const levelIsValid = prev.homeTeam.level ? levels.includes(prev.homeTeam.level) : true;
                    return {
                      ...prev,
                      homeTeam: {
                        ...prev.homeTeam,
                        sport: {
                          ...prev.homeTeam.sport,
                          name: sport,
                        },
                        level: levelIsValid ? prev.homeTeam.level : "",
                      },
                    };
                  });
                }}
                displayEmpty
                sx={{ minWidth: 140, fontSize: 13, bgcolor: "transparent" }}
              >
                {uniqueSports.map((sport: string) => (
                  <MenuItem key={sport} value={sport}>
                    {sport}
                  </MenuItem>
                ))}
              </Select>
              <Tooltip title="Add new team">
                <IconButton size="small" onClick={() => setShowAddTeam(true)} sx={{ p: 0.5 }}>
                  <Add fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </TableCell>
        );
      case "level":
        return (
          <TableCell key="level" sx={{ py: 1, minWidth: 150 }}>
            <Select
              size="small"
              value={editingGame.homeTeam.level}
              onChange={(e) => {
                const level = e.target.value as string;
                setEditingGameData((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    homeTeam: {
                      ...prev.homeTeam,
                      level,
                    },
                  };
                });
              }}
              displayEmpty
              sx={{ minWidth: 140, fontSize: 13, bgcolor: "transparent" }}
            >
              <MenuItem value="">Select level</MenuItem>
              {getLevelsForSport(editingGame.homeTeam.sport.name).map((level) => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        );
      case "opponent":
        return (
          <TableCell key="opponent" sx={{ py: 1 }}>
            <Select
              size="small"
              value={editingGame.opponentId || editingGame.opponent?.id || ""}
              onChange={(e) => {
                if (e.target.value === "__add_new__") {
                  setShowAddOpponent(true);
                } else {
                  setEditingGameData((prev) => (prev ? { ...prev, opponentId: e.target.value as string } : prev));
                }
              }}
              sx={{ width: 160, fontSize: 13, bgcolor: "transparent" }}
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
        );
      case "isHome":
        return (
          <TableCell key="isHome" sx={{ py: 1 }}>
            <Select
              size="small"
              value={editingGame.isHome ? "home" : "away"}
              onChange={(e) => setEditingGameData((prev) => (prev ? { ...prev, isHome: e.target.value === "home" } : prev))}
              sx={{ width: 80, fontSize: 13, bgcolor: "transparent" }}
            >
              <MenuItem value="home">Home</MenuItem>
              <MenuItem value="away">Away</MenuItem>
            </Select>
          </TableCell>
        );
      case "time":
        return (
          <TableCell key="time" sx={{ py: 1 }}>
            <TextField
              type="time"
              size="small"
              value={editingGame.time || ""}
              onChange={(e) => setEditingGameData((prev) => (prev ? { ...prev, time: e.target.value } : prev))}
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
        );
      case "status":
        return (
          <TableCell key="status" sx={{ py: 1 }}>
            <Select
              size="small"
              value={editingGame.status}
              onChange={(e) => setEditingGameData((prev) => (prev ? { ...prev, status: e.target.value as string } : prev))}
              sx={{ width: 110, fontSize: 13, bgcolor: "transparent" }}
            >
              <MenuItem value="SCHEDULED">Pending</MenuItem>
              <MenuItem value="CONFIRMED">Yes</MenuItem>
              <MenuItem value="CANCELLED">No</MenuItem>
            </Select>
          </TableCell>
        );
      case "location":
        return (
          <TableCell key="location" sx={{ py: 1, minWidth: 180 }}>
            <TextField
              size="small"
              fullWidth
              value={editingGame.location || ""}
              onChange={(e) => {
                const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                setEditingGameData((prev) => (prev ? { ...prev, location: value } : prev));
              }}
              placeholder="Enter location..."
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: 13,
                  py: 0.5,
                },
              }}
            />
          </TableCell>
        );
      case "busTravel":
        return (
          <TableCell key="busTravel" sx={{ py: 1, minWidth: 180 }}>
            <Stack direction="column" spacing={0.75}>
              <TextField
                type="time"
                size="small"
                label="Depart"
                value={toTimeInputValue(editingGame.actualDepartureTime)}
                onChange={(e) =>
                  setEditingGameData((prev) =>
                    prev
                      ? {
                          ...prev,
                          actualDepartureTime: combineDateAndTime(prev.date, e.target.value),
                        }
                      : prev
                  )
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
                value={toTimeInputValue(editingGame.actualArrivalTime)}
                onChange={(e) =>
                  setEditingGameData((prev) =>
                    prev
                      ? {
                          ...prev,
                          actualArrivalTime: combineDateAndTime(prev.date, e.target.value),
                        }
                      : prev
                  )
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
                <Checkbox checked={editingGame.busTravel} onChange={(e) => setEditingGameData((prev) => (prev ? { ...prev, busTravel: e.target.checked } : prev))} sx={{ p: 0 }} />
                <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>
                  Bus
                </Typography>
              </Box>
            </Stack>
          </TableCell>
        );
      case "notes":
        return (
          <TableCell key="notes" sx={{ py: 1, minWidth: 220 }}>
            <TextField
              size="small"
              multiline
              rows={3}
              fullWidth
              value={editingGame.notes || ""}
              onChange={(e) => {
                const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                setEditingGameData((prev) => (prev ? { ...prev, notes: value } : prev));
              }}
              placeholder="Add notes..."
              helperText={`${editingGame.notes?.length ?? 0}/${MAX_CHAR_LIMIT}`}
              FormHelperTextProps={{
                sx: {
                  fontSize: 10,
                  mt: 0.5,
                  color: (editingGame.notes?.length ?? 0) >= MAX_CHAR_LIMIT ? "error.main" : (editingGame.notes?.length ?? 0) >= MAX_CHAR_LIMIT * 0.9 ? "warning.main" : "text.secondary",
                },
              }}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: 13,
                },
              }}
            />
          </TableCell>
        );
      case "actions":
        return (
          <TableCell key="actions" sx={{ py: 1 }}>
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
        );
      default:
        if (column.id.startsWith("custom:")) {
          const customColumn = column.customColumn;
          if (!customColumn) return null;
          return (
            <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
              <TextField
                size="small"
                fullWidth
                value={editingCustomData[customColumn.id] || ""}
                onChange={(e) => handleCustomFieldChange(customColumn.id, e.target.value)}
                placeholder={`Enter ${customColumn.name?.toLowerCase?.() || "value"}`}
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
          );
        }
        return null;
    }
  };

  const renderViewRowCell = (column: ResolvedColumn, game: Game) => {
    switch (column.id) {
      case "date": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "date";
        return (
          <TableCell
            key="date"
            sx={{
              fontSize: 13,
              py: 0,
              cursor: isEditing ? "default" : "pointer",
              bgcolor: isEditing ? "#fff9e6" : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? "#fff9e6" : "#f5f5f5",
              },
            }}
            onDoubleClick={() => handleDoubleClick(game, "date")}
          >
            {isEditing ? (
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
        );
      }
      case "sport":
        return (
          <TableCell key="sport" sx={{ fontSize: 13, py: 2 }}>
            {game.homeTeam.sport.name}
          </TableCell>
        );
      case "level":
        return (
          <TableCell key="level" sx={{ fontSize: 13, py: 2 }}>
            {game.homeTeam.level}
          </TableCell>
        );
      case "opponent": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "opponent";
        return (
          <TableCell
            key="opponent"
            sx={{
              fontSize: 13,
              py: 0,
              cursor: isEditing ? "default" : "pointer",
              bgcolor: isEditing ? "#fff9e6" : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? "#fff9e6" : "#f5f5f5",
              },
            }}
            onDoubleClick={() => handleDoubleClick(game, "opponent")}
          >
            {isEditing ? (
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
        );
      }
      case "isHome":
        return (
          <TableCell key="isHome" sx={{ py: 2 }}>
            <Chip
              label={game.isHome ? "Home" : "Away"}
              size="small"
              sx={{ fontSize: 11, height: 24, fontWeight: 500, backgroundColor: game.isHome ? "#0f172a" : "#e3e3e7", color: game.isHome ? "#e3e3e7" : "#0f172a" }}
            />
          </TableCell>
        );
      case "time": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "time";
        return (
          <TableCell
            key="time"
            sx={{
              fontSize: 13,
              py: 0,
              cursor: isEditing ? "default" : "pointer",
              bgcolor: isEditing ? "#fff9e6" : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? "#fff9e6" : "#f5f5f5",
              },
            }}
            onDoubleClick={() => handleDoubleClick(game, "time")}
          >
            {isEditing ? (
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
                  {formatTimeDisplay(game.time)}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "time" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "status": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "status";
        const confirmedStatus = getConfirmedStatus(game.status);
        return (
          <TableCell
            key="status"
            sx={{
              py: 0,
              cursor: isEditing ? "default" : "pointer",
              bgcolor: isEditing ? "#fff9e6" : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? "#fff9e6" : "#f5f5f5",
              },
            }}
            onDoubleClick={() => handleDoubleClick(game, "status")}
          >
            {isEditing ? (
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
        );
      }
      case "location": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "location";
        return (
          <TableCell
            key="location"
            sx={{
              fontSize: 13,
              py: 0,
              minWidth: 220,
              maxWidth: 300,
              cursor: isEditing ? "default" : "pointer",
              bgcolor: isEditing ? "#fff9e6" : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? "#fff9e6" : "#f5f5f5",
              },
            }}
            onDoubleClick={() => handleDoubleClick(game, "location")}
          >
            {isEditing ? (
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
                  placeholder="Enter location..."
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
                {inlineEditError && inlineEditState?.field === "location" && (
                  <Typography variant="caption" sx={{ fontSize: 10, color: "error.main", display: "block", mt: 0.5 }}>
                    {inlineEditError}
                  </Typography>
                )}
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {game.location || (game.venue?.name || "—")}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "location" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "busTravel": {
        const departureDisplay = formatBusTimeDisplay(game.actualDepartureTime);
        const arrivalDisplay = formatBusTimeDisplay(game.actualArrivalTime);
        return (
          <TableCell key="busTravel" sx={{ py: 2, minWidth: 180 }}>
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
            </Stack>
          </TableCell>
        );
      }
      case "notes": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "notes";
        return (
          <TableCell
            key="notes"
            sx={{
              fontSize: 13,
              py: 0,
              minWidth: 220,
              maxWidth: 300,
              cursor: isEditing ? "default" : "pointer",
              bgcolor: isEditing ? "#fff9e6" : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? "#fff9e6" : "#f5f5f5",
              },
            }}
            onDoubleClick={() => handleDoubleClick(game, "notes")}
          >
            {isEditing ? (
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
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {getNotesPreview(game.notes)}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "notes" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "actions": {
        const isSyncingCurrentGame = syncGameMutation.isPending && (syncGameMutation.variables as string | undefined) === game.id;
        return (
          <TableCell key="actions" sx={{ py: 2 }}>
            <Stack direction="row" spacing={0}>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleEditGame(game)} sx={{ p: 0.5 }}>
                  <Edit sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Sync to Google">
                <IconButton size="small" sx={{ p: 0.5 }} onClick={() => handleSyncCalendar(game.id)} disabled={syncGameMutation.isPending}>
                  {isSyncingCurrentGame ? <CircularProgress size={16} /> : <Sync sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => handleDeleteGame(game)} sx={{ p: 0.5 }}>
                  <Delete sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </TableCell>
        );
      }
      default:
        if (column.id.startsWith("custom:")) {
          const customColumn = column.customColumn;
          if (!customColumn) return null;
          const fieldKey = `custom:${customColumn.id}` as InlineEditField;
          const customData = (game.customData as any) || {};
          const cellValue = customData[customColumn.id] || "";
          const isCustomEditing = inlineEditState?.gameId === game.id && inlineEditState.field === fieldKey;

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
        }
        return null;
    }
  };

  const renderNewRow = () => {
    if (!isAddingNew) return null;

    return (
      <TableRow sx={{ bgcolor: "#e3f2fd" }}>
        <TableCell padding="checkbox">
          <Checkbox disabled sx={{ p: 0 }} />
        </TableCell>
        {resolvedColumns.map((column) => renderNewRowCell(column))}
      </TableRow>
    );
  };

  const renderGameRow = (game: Game) => {
    const isSelected = selectedGames.has(game.id);
    const isEditing = editingGameId === game.id && editingGameData;

    if (isEditing && editingGameData) {
      return (
        <TableRow key={game.id} sx={{ bgcolor: "#fff3e0" }}>
          <TableCell padding="checkbox">
            <Checkbox disabled sx={{ p: 0 }} />
          </TableCell>
          {resolvedColumns.map((column) => renderEditingRowCell(column, editingGameData))}
        </TableRow>
      );
    }

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
        {resolvedColumns.map((column) => renderViewRowCell(column, game))}
      </TableRow>
    );
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
          <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: "wrap" }}>
            <Button variant="contained" startIcon={<Add />} onClick={handleNewGame} disabled={isAddingNew} sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}>
              Create Game
            </Button>
            <Button variant="outlined" startIcon={<Tune />} onClick={() => setIsColumnPreferencesOpen(true)} sx={{ textTransform: "none" }}>
              Columns
            </Button>
            <Button variant="outlined" startIcon={<ViewColumn />} onClick={() => setShowColumnManager(true)} sx={{ textTransform: "none" }}>
              Custom Columns ({customColumns.length})
            </Button>
            {hiddenColumnCount > 0 && (
              <Button size="small" variant="text" onClick={handleShowAllColumns} sx={{ textTransform: "none" }}>
                Show all columns ({hiddenColumnCount} hidden)
              </Button>
            )}
            {selectedGames.size > 0 && (
              <>
                <Button variant="contained" color="primary" startIcon={<GradientSendIcon />} onClick={handleSendEmail} sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}>
                  Send Email ({selectedGames.size})
                </Button>
                <Button variant="outlined" color="primary" startIcon={<ContentCopy />} onClick={handleCopySelectedRows} sx={{ textTransform: "none" }}>
                  Copy ({selectedGames.size})
                </Button>
              </>
            )}
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
              {resolvedColumns.map((column) => renderHeaderCell(column))}
            </TableRow>
          </TableHead>
          <TableBody>
            {renderNewRow()}
            {games.length === 0 && !isAddingNew ? (
              <TableRow>
                <TableCell colSpan={resolvedColumns.length + 1} align="center" sx={{ py: 8, bgcolor: "white" }}>
                  <Typography color="text.secondary" variant="body2">
                    No games found. Click "Create Game" to add one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              games.map((game: any) => renderGameRow(game))
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

      <ColumnPreferencesMenu
        open={isColumnPreferencesOpen}
        onClose={() => setIsColumnPreferencesOpen(false)}
        columns={columnMenuColumns}
        onToggleVisibility={handleToggleColumnVisibility}
        onReorder={handleReorderColumns}
        onShowAll={handleShowAllColumns}
      />

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

function getDefaultColumnOrder(customColumns: any[]): ColumnId[] {
  const customIds = customColumns
    .map((column: any) => column?.id)
    .filter((id: string | undefined): id is string => Boolean(id))
    .map((id: string) => `custom:${id}` as ColumnId);

  return ["date", "sport", "level", "opponent", "isHome", "time", "status", "location", "busTravel", ...customIds, "notes", "actions"];
}

function isColumnId(value: string): value is ColumnId {
  return STATIC_COLUMN_SEQUENCE.includes(value as StaticColumnId) || value.startsWith("custom:");
}

function deriveColumnState(previous: ColumnStateConfig[], preferences: TablePreferencesData | null, defaultOrder: ColumnId[], initialPreferencesApplied: boolean): ColumnStateConfig[] {
  const hiddenSet = new Set<ColumnId>(Array.isArray(preferences?.hidden) ? (preferences!.hidden as ColumnId[]) : []);

  const preferenceOrder = normalizePreferenceOrder(preferences?.order, defaultOrder);
  const previousOrder = previous.map((column) => column.id).filter((id) => defaultOrder.includes(id));

  let baseOrder: ColumnId[] = [];

  if (!initialPreferencesApplied || previous.length === 0) {
    baseOrder = preferenceOrder.length > 0 ? preferenceOrder : previousOrder;
  } else if (preferenceOrder.length > 0 && !arraysEqual(preferenceOrder, previousOrder)) {
    baseOrder = preferenceOrder;
  } else {
    baseOrder = previousOrder;
  }

  if (baseOrder.length === 0) {
    baseOrder = defaultOrder;
  }

  const finalOrder = mergeWithDefaultOrder(baseOrder, defaultOrder);

  const visibilityMap = new Map<ColumnId, boolean>(previous.map((column) => [column.id, column.visible]));

  return finalOrder.map((id) => ({
    id,
    visible: hiddenSet.has(id) ? false : visibilityMap.has(id) ? visibilityMap.get(id)! : !hiddenSet.has(id),
  }));
}

function normalizePreferenceOrder(order: unknown, defaultOrder: ColumnId[]): ColumnId[] {
  if (!Array.isArray(order)) {
    return [];
  }

  return order
    .map((value) => String(value) as ColumnId)
    .filter((id) => defaultOrder.includes(id));
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function mergeWithDefaultOrder(order: ColumnId[], defaultOrder: ColumnId[]): ColumnId[] {
  const merged = [...order];

  defaultOrder.forEach((id) => {
    if (!merged.includes(id)) {
      merged.push(id);
    }
  });

  return merged;
}
