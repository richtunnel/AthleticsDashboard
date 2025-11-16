"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingButton } from "../utils/LoadingButton";
import { CustomColumnManager } from "./CustomColumnManager";
import { ColumnPreferencesMenu } from "./ColumnPreferencesMenu";
import { ColumnFilter, ColumnFilterValue } from "./ColumnFilter";
import { CustomTimePicker } from "../ui/CustomTimePicker";
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
import { trackEvent } from "@/lib/analytics/mixpanel.services";

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
  Skeleton,
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
  VisibilityOff,
  Restore,
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

const dateStringToUTCISOString = (dateValue: string): string => {
  // Parse date string in format YYYY-MM-DD and convert to UTC ISO string
  // This avoids timezone issues by explicitly creating date at noon UTC
  const datePart = dateValue.includes("T") ? dateValue.split("T")[0] : dateValue;
  const [year, month, day] = datePart.split("-").map(Number);
  // Create date at noon UTC to avoid any date boundary issues
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return utcDate.toISOString();
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

type CustomColumnType = "TEXT" | "TIME" | "DROPDOWN" | "DATETIME";

interface CustomColumn {
  id: string;
  name: string;
  type: CustomColumnType;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

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
  opponent?: string;
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

type InlineEditField = "opponent" | "location" | "date" | "time" | "status" | "notes" | "sport" | "level" | "isHome" | "busTravel" | `custom:${string}`;

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
  columnTitles?: Record<string, string>;
  [key: string]: unknown;
}

interface ColumnPreferencePayload {
  order: ColumnId[];
  hidden: ColumnId[];
  columnTitles?: Record<string, string>;
}

interface ResolvedColumn {
  id: ColumnId;
  customColumn?: any;
}

const TABLE_PREFERENCES_KEY = "games";
const STATIC_COLUMN_SEQUENCE: StaticColumnId[] = ["date", "sport", "level", "opponent", "isHome", "time", "status", "location", "busTravel", "notes", "actions"];

const PRESET_SPORTS = ["Boys Basketball", "Girls Basketball", "Boys Flag Football", "Girls Flag Football", "Girls Tennis", "Boys Tennis", "Boys Soccer", "Girls Soccer", "Boys Cross Country"];

const PRESET_LEVELS = ["VARSITY", "JV", "FRESHMAN"];

// Save Status Indicator Component
type SaveStatusType = "idle" | "pending" | "saving" | "saved" | "error";

interface SaveStatusIndicatorProps {
  status: SaveStatusType;
}

const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({ status }) => {
  if (status === "idle") return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        fontSize: 11,
        color: status === "saved" ? "success.main" : status === "error" ? "error.main" : "text.secondary",
        mt: 0.5,
      }}
    >
      {status === "pending" && (
        <>
          <Schedule sx={{ fontSize: 14 }} />
          <Typography variant="caption" sx={{ fontSize: 11 }}>
            Pending...
          </Typography>
        </>
      )}
      {status === "saving" && (
        <>
          <CircularProgress size={12} />
          <Typography variant="caption" sx={{ fontSize: 11 }}>
            Saving...
          </Typography>
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCircle sx={{ fontSize: 14 }} />
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 500 }}>
            Saved
          </Typography>
        </>
      )}
      {status === "error" && (
        <>
          <Cancel sx={{ fontSize: 14 }} />
          <Typography variant="caption" sx={{ fontSize: 11 }}>
            Error
          </Typography>
        </>
      )}
    </Box>
  );
};

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

  // Column title editing state
  const [editingColumnId, setEditingColumnId] = useState<ColumnId | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState<string>("");
  const [customColumnTitles, setCustomColumnTitles] = useState<Record<string, string>>({});

  // Inline editing state
  const [inlineEditState, setInlineEditState] = useState<InlineEditState | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<string>("");
  const [inlineEditError, setInlineEditError] = useState<string | null>(null);
  const [isInlineSaving, setIsInlineSaving] = useState(false);

  // Save status tracking for visual indicators
  type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Autosave mechanism - batched and debounced
  const pendingChangesRef = useRef<Map<string, Record<string, any>>>(new Map());
  const saveTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const savingGamesRef = useRef<Set<string>>(new Set());

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

  // Load custom column titles from preferences
  useEffect(() => {
    if (columnPreferencesData?.columnTitles) {
      setCustomColumnTitles(columnPreferencesData.columnTitles);
    }
  }, [columnPreferencesData]);

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

  // Refs to avoid stale closures
  const opponentsRef = useRef(opponents);
  const teamsRef = useRef(teams);
  const gamesRef = useRef(games);

  useEffect(() => {
    opponentsRef.current = opponents;
    teamsRef.current = teams;
  }, [opponents, teams]);

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

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
      const locationValue = game.location || game.venue?.name || "TBD";
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
      // Check for custom title first
      if (customColumnTitles[columnId]) {
        return customColumnTitles[columnId];
      }

      // Return default label
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
    [customColumnsMap, customColumnTitles]
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
    (nextState: ColumnStateConfig[], previousState: ColumnStateConfig[], updatedColumnTitles?: Record<string, string>) => {
      const payload: ColumnPreferencePayload = {
        order: nextState.map((column) => column.id),
        hidden: nextState.filter((column) => !column.visible).map((column) => column.id),
        columnTitles: updatedColumnTitles !== undefined ? updatedColumnTitles : customColumnTitles,
      };
      savePreferencesMutation.mutate(payload, {
        onError: (error: any) => {
          setColumnState(previousState);
          addNotification(error?.message || "Failed to save column preferences", "error");
        },
      });
    },
    [savePreferencesMutation, addNotification, customColumnTitles]
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

  // Column title editing handlers
  const handleEditColumnTitle = useCallback(
    (columnId: ColumnId) => {
      const currentTitle = getColumnLabel(columnId);
      setEditingColumnId(columnId);
      setEditingColumnTitle(currentTitle);
    },
    [getColumnLabel]
  );

  const handleSaveColumnTitle = useCallback(() => {
    if (!editingColumnId) return;

    const trimmedTitle = editingColumnTitle.trim();
    if (!trimmedTitle) {
      addNotification("Column title cannot be empty", "warning");
      return;
    }

    const updatedTitles = { ...customColumnTitles, [editingColumnId]: trimmedTitle };
    setCustomColumnTitles(updatedTitles);
    persistColumnPreferences(columnState, columnState, updatedTitles);
    setEditingColumnId(null);
    setEditingColumnTitle("");
    addNotification("Column title updated", "success");
  }, [editingColumnId, editingColumnTitle, customColumnTitles, columnState, persistColumnPreferences, addNotification]);

  const handleCancelEditColumnTitle = useCallback(() => {
    setEditingColumnId(null);
    setEditingColumnTitle("");
  }, []);

  const handleResetColumnTitle = useCallback(
    (columnId: ColumnId) => {
      const updatedTitles = { ...customColumnTitles };
      delete updatedTitles[columnId];
      setCustomColumnTitles(updatedTitles);
      persistColumnPreferences(columnState, columnState, updatedTitles);
      addNotification("Column title reset to default", "success");
    },
    [customColumnTitles, columnState, persistColumnPreferences, addNotification]
  );

  const handleSyncCalendar = (gameId: string) => {
    syncGameMutation.mutate(gameId);
  };

  const createGameMutation = useMutation({
    mutationFn: async (params: { gameData: any; skipCalendarSync?: boolean }) => {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params.gameData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create game");
      }
      return res.json();
    },
    onSuccess: (data: any, variables: { gameData: any; skipCalendarSync?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      resetNewGameData();

      const newGameId = data.data.id;
      // Only sync to calendar if not explicitly skipped (e.g., during duplicate)
      if (!variables.skipCalendarSync) {
        syncGameMutation.mutate(newGameId);
      }
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Validate data is not empty
      if (!data || Object.keys(data).length === 0) {
        throw new Error("Cannot update game with empty data");
      }

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
            currentValue = game.opponent?.name || "";
            break;
          case "location":
            currentValue = game.location || "";
            break;
          case "date":
            currentValue = extractDatePart(game.date);
            break;
          case "time":
            // Ensure time is properly formatted (HH:MM) or empty string
            currentValue = game.time && typeof game.time === "string" ? game.time.trim() : "";
            break;
          case "status":
            currentValue = game.status;
            break;
          case "notes":
            currentValue = game.notes || "";
            break;
          case "sport":
            currentValue = game.homeTeam.sport.name;
            break;
          case "level":
            currentValue = game.homeTeam.level;
            break;
          case "isHome":
            currentValue = game.isHome ? "home" : "away";
            break;
          case "busTravel":
            // For busTravel, we'll use a special format: "departureTime|arrivalTime|busTravel"
            currentValue = `${toTimeInputValue(game.actualDepartureTime)}|${toTimeInputValue(game.actualArrivalTime)}|${game.busTravel}`;
            break;
        }
      }

      setInlineEditState({ gameId: game.id, field });
      setInlineEditValue(currentValue);
      setInlineEditError(null);
      setSaveStatus("idle");
    },
    [editingGameId]
  );

  // Batched autosave function - handles multiple field changes efficiently
  const executeBatchedSave = useCallback(
    async (gameId: string, game: Game) => {
      const pendingChanges = pendingChangesRef.current.get(gameId);
      if (!pendingChanges || Object.keys(pendingChanges).length === 0) return;

      // Skip if already saving this game
      if (savingGamesRef.current.has(gameId)) return;

      // Cancel any pending request for this game
      const existingController = abortControllersRef.current.get(gameId);
      if (existingController) {
        existingController.abort();
      }

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllersRef.current.set(gameId, abortController);
      savingGamesRef.current.add(gameId);
      setIsInlineSaving(true);
      setSaveStatus("saving");

      try {
        // Build base update data
        const updateData: any = {
          date: dateStringToUTCISOString(game.date),
          time: game.time || null,
          homeTeamId: game.homeTeamId || game.homeTeam.id,
          isHome: game.isHome,
          status: game.status,
          opponentId: game.opponentId || game.opponent?.id || null,
          venueId: game.venueId || game.venue?.id || null,
          customData: game.customData || {},
          notes: game.notes || null,
          location: game.location || null,
        };

        // Apply all pending changes
        for (const [field, value] of Object.entries(pendingChanges)) {
          if (field === "opponent") {
            const opponentName = value.trim();
            if (opponentName) {
              const existingOpponent = opponentsRef.current.find((opp: any) => opp.name.toLowerCase() === opponentName.toLowerCase());
              if (existingOpponent) {
                updateData.opponentId = existingOpponent.id;
              } else {
                const createRes = await fetch("/api/opponents", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: opponentName }),
                  signal: abortController.signal,
                });
                if (!createRes.ok) {
                  const errorData = await createRes.json();
                  throw new Error(errorData.error || "Failed to create opponent");
                }
                const newOpponentData = await createRes.json();
                updateData.opponentId = newOpponentData.data.id;
                await queryClient.invalidateQueries({ queryKey: ["opponents"] });
              }
            } else {
              updateData.opponentId = null;
            }
          } else if (field === "location") {
            updateData.location = value.slice(0, MAX_CHAR_LIMIT) || null;
          } else if (field === "date") {
            if (value) {
              updateData.date = dateStringToUTCISOString(value);
            }
          } else if (field === "time") {
            // Normalize time value - convert empty strings to null and trim whitespace
            const trimmedTime = typeof value === "string" ? value.trim() : value;
            updateData.time = trimmedTime || null;
          } else if (field === "status") {
            updateData.status = value;
          } else if (field === "notes") {
            updateData.notes = value.slice(0, MAX_CHAR_LIMIT) || null;
          } else if (field === "isHome") {
            updateData.isHome = value === "home";
          } else if (field === "busTravel") {
            const parts = value.split("|");
            const departureTime = parts[0] || "";
            const arrivalTime = parts[1] || "";
            const busTravel = parts[2] === "true";
            updateData.actualDepartureTime = combineDateAndTime(game.date, departureTime);
            updateData.actualArrivalTime = combineDateAndTime(game.date, arrivalTime);
            updateData.busTravel = busTravel;
          } else if (field === "sport" || field === "level") {
            const newSport = field === "sport" ? value : game.homeTeam.sport.name;
            const newLevel = field === "level" ? value : game.homeTeam.level;

            if (!newSport || !newLevel) {
              addNotification("Sport and level are required", "error");
              continue;
            }

            let matchingTeam = teamsRef.current.find((team: any) => team.sport?.name === newSport && team.level === newLevel);

            if (!matchingTeam) {
              const sportRes = await fetch("/api/sports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newSport, season: "FALL" }),
                signal: abortController.signal,
              });

              let sportData;
              if (sportRes.ok) {
                sportData = await sportRes.json();
              } else {
                const existingSportRes = await fetch(`/api/sports?name=${encodeURIComponent(newSport)}`);
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
                body: JSON.stringify({ name: `${newSport} ${newLevel}`, sportId, level: newLevel }),
                signal: abortController.signal,
              });

              if (!teamRes.ok) {
                const error = await teamRes.json();
                throw new Error(error.error || "Failed to create team");
              }

              const teamData = await teamRes.json();
              matchingTeam = teamData.data;
              await queryClient.invalidateQueries({ queryKey: ["teams"] });
            }

            updateData.homeTeamId = matchingTeam.id;
          } else if (field.startsWith("custom:")) {
            const columnId = field.replace("custom:", "");
            updateData.customData = {
              ...updateData.customData,
              [columnId]: value.slice(0, MAX_CHAR_LIMIT),
            };
          }
        }

        // Validate that updateData is not empty
        if (!updateData || Object.keys(updateData).length === 0) {
          console.warn(`Skipping empty update for game ${gameId}`);
          pendingChangesRef.current.delete(gameId);
          return;
        }

        const res = await fetch(`/api/games/${gameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to update game");
        }

        await queryClient.invalidateQueries({ queryKey: ["games"] });

        // Clear pending changes for this game
        pendingChangesRef.current.delete(gameId);

        // Sync to calendar after successful update
        syncGameMutation.mutate(gameId);

        // Show saved status briefly
        setSaveStatus("saved");
        if (saveStatusTimeoutRef.current) {
          clearTimeout(saveStatusTimeoutRef.current);
        }
        saveStatusTimeoutRef.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 2000); // Show "Saved" for 2 seconds

        setInlineEditState(null);
        setInlineEditValue("");
        setInlineEditError(null);
      } catch (error: any) {
        if (error.name === "AbortError") {
          // Request was cancelled, ignore
          return;
        }
        setSaveStatus("error");
        addNotification(`Error updating game: ${error.message}`, "error");
      } finally {
        savingGamesRef.current.delete(gameId);
        abortControllersRef.current.delete(gameId);
        setIsInlineSaving(false);
      }
    },
    [queryClient, syncGameMutation, addNotification, MAX_CHAR_LIMIT]
  );

  // Schedule autosave with debouncing and batching
  const scheduleAutosave = useCallback(
    (gameId: string, field: InlineEditField, value: string, gameData: Game, immediate: boolean = false) => {
      // Add change to pending changes
      const existingChanges = pendingChangesRef.current.get(gameId) || {};
      existingChanges[field] = value;
      pendingChangesRef.current.set(gameId, existingChanges);

      // Clear existing timeout for this game
      const existingTimeout = saveTimeoutRef.current.get(gameId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set pending status if not immediate
      if (!immediate) {
        setSaveStatus("pending");
      }

      // Schedule save with debounce (or immediate if specified)
      const delay = immediate ? 0 : 10000; // 10 seconds debounce to prevent premature auto-save during editing
      const timeoutId = setTimeout(() => {
        // Get the latest game data from ref to avoid stale closures
        const latestGame = gamesRef.current.find((g: Game) => g.id === gameId);
        const game = latestGame || gameData; // Fallback to the passed data if not found
        executeBatchedSave(gameId, game);
        saveTimeoutRef.current.delete(gameId);
      }, delay);

      saveTimeoutRef.current.set(gameId, timeoutId);
    },
    [executeBatchedSave]
  );

  const handleInlineKeyDown = useCallback(
    (e: React.KeyboardEvent, game: Game) => {
      if (!inlineEditState) return;

      if (e.key === "Enter" && inlineEditState.field !== "notes") {
        // Save immediately on Enter (except for notes textarea)
        e.preventDefault();
        scheduleAutosave(game.id, inlineEditState.field, inlineEditValue, game, true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Cancel pending saves and clear state
        const timeout = saveTimeoutRef.current.get(game.id);
        if (timeout) {
          clearTimeout(timeout);
          saveTimeoutRef.current.delete(game.id);
        }
        pendingChangesRef.current.delete(game.id);
        setSaveStatus("idle");
        setInlineEditState(null);
        setInlineEditValue("");
      }
    },
    [inlineEditState, inlineEditValue, scheduleAutosave]
  );

  const handleInlineBlur = useCallback(
    (game: Game) => {
      if (!inlineEditState) return;
      // Save immediately on blur
      scheduleAutosave(game.id, inlineEditState.field, inlineEditValue, game, true);
    },
    [inlineEditState, inlineEditValue, scheduleAutosave]
  );

  // Trigger autosave as user types (debounced)
  const handleInlineChange = useCallback(
    (value: string, game: Game) => {
      if (!inlineEditState) return;

      // Update UI immediately (optimistic update)
      handleInlineValueChange(value);

      // Schedule batched save with debounce
      scheduleAutosave(game.id, inlineEditState.field, value, game, false);
    },
    [inlineEditState, handleInlineValueChange, scheduleAutosave]
  );

  // Cleanup timeouts and abort controllers on unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts
      saveTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      saveTimeoutRef.current.clear();

      // Clear save status timeout
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }

      // Abort all pending requests
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();

      // Clear pending changes
      pendingChangesRef.current.clear();
      savingGamesRef.current.clear();
    };
  }, []);

  const handleNewGame = () => {
    trackEvent("Create Game Clicked", {
      source: "games_table",
      action: "create_game_button",
    });
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

    ExportService.exportGames(gamesToExport, customColumns, visibleColumnIds);
  }, [games, customColumns, visibleColumnIds, addNotification]);

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

    // Handle opponent - create if needed
    let opponentId = newGameData.opponentId || null;
    if (newGameData.opponent && newGameData.opponent.trim()) {
      const opponentName = newGameData.opponent.trim();
      const existingOpponent = opponents.find((opp: any) => opp.name.toLowerCase() === opponentName.toLowerCase());

      if (existingOpponent) {
        opponentId = existingOpponent.id;
      } else {
        // Create new opponent
        try {
          const createRes = await fetch("/api/opponents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: opponentName }),
          });

          if (!createRes.ok) {
            const errorData = await createRes.json();
            throw new Error(errorData.error || "Failed to create opponent");
          }

          const newOpponentData = await createRes.json();
          opponentId = newOpponentData.data.id;

          // Invalidate opponents query to refresh the list
          await queryClient.invalidateQueries({ queryKey: ["opponents"] });
        } catch (createError: any) {
          addNotification(`Error creating opponent: ${createError.message}`, "error");
          return;
        }
      }
    }

    const isoDate = dateStringToUTCISOString(newGameData.date);

    const gameData = {
      date: isoDate,
      time: newGameData.time || null,
      homeTeamId: matchingTeam.id,
      isHome: newGameData.isHome,
      busTravel: newGameData.busTravel,
      actualDepartureTime: combineDateAndTime(newGameData.date, newGameData.actualDepartureTime),
      actualArrivalTime: combineDateAndTime(newGameData.date, newGameData.actualArrivalTime),
      opponentId: opponentId,
      venueId: newGameData.venueId || null,
      status: newGameData.status,
      notes: newGameData.notes || null,
      location: newGameData.location || null,
      customData: newGameData.customData || {},
    };

    createGameMutation.mutate({ gameData });
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

    // Handle opponent - create if needed
    let opponentId = editingGameData.opponentId || editingGameData.opponent?.id || null;
    if (editingGameData.opponent?.name && editingGameData.opponent.name.trim()) {
      const opponentName = editingGameData.opponent.name.trim();
      const existingOpponent = opponents.find((opp: any) => opp.name.toLowerCase() === opponentName.toLowerCase());

      if (existingOpponent) {
        opponentId = existingOpponent.id;
      } else {
        // Create new opponent
        try {
          const createRes = await fetch("/api/opponents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: opponentName }),
          });

          if (!createRes.ok) {
            const errorData = await createRes.json();
            throw new Error(errorData.error || "Failed to create opponent");
          }

          const newOpponentData = await createRes.json();
          opponentId = newOpponentData.data.id;

          // Invalidate opponents query to refresh the list
          await queryClient.invalidateQueries({ queryKey: ["opponents"] });
        } catch (createError: any) {
          addNotification(`Error creating opponent: ${createError.message}`, "error");
          return;
        }
      }
    }

    const isoDate = dateStringToUTCISOString(editingGameData.date);

    const updateData = {
      date: isoDate,
      time: editingGameData.time || null,
      homeTeamId: matchingTeam?.id || editingGameData.homeTeamId,
      isHome: editingGameData.isHome,
      busTravel: editingGameData.busTravel,
      actualDepartureTime: editingGameData.actualDepartureTime || null,
      actualArrivalTime: editingGameData.actualArrivalTime || null,
      opponentId: opponentId,
      venueId: editingGameData.venueId || editingGameData.venue?.id || null,
      status: editingGameData.status,
      customData: editingCustomData,
      notes: editingGameData.notes || null,
      location: editingGameData.location || null,
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

  const handleDuplicateGame = async (game: Game) => {
    try {
      const gameData = {
        date: dateStringToUTCISOString(game.date),
        time: game.time || null,
        homeTeamId: game.homeTeamId || game.homeTeam.id,
        isHome: game.isHome,
        busTravel: game.busTravel,
        actualDepartureTime: game.actualDepartureTime || null,
        actualArrivalTime: game.actualArrivalTime || null,
        opponentId: game.opponentId || game.opponent?.id || null,
        venueId: game.venueId || game.venue?.id || null,
        status: game.status,
        notes: game.notes || null,
        location: game.location || null,
        customData: game.customData || {},
      };

      createGameMutation.mutate(
        { gameData, skipCalendarSync: true },
        {
          onSuccess: () => {
            addNotification("Game duplicated successfully", "success");
          },
          onError: (error: any) => {
            addNotification(error?.message || "Failed to duplicate game", "error");
          },
        }
      );
    } catch (error: any) {
      addNotification(error?.message || "Failed to duplicate game", "error");
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
    trackEvent("Send Email Clicked", {
      source: "games_table",
      action: "send_email_button",
      selected_games_count: selectedGames.size,
    });
    const selectedGamesData = games.filter((game: Game) => selectedGames.has(game.id));
    const opponentFilter = columnFilters.opponent;
    sessionStorage.setItem("selectedGames", JSON.stringify(selectedGamesData));
    sessionStorage.setItem("gamesTableVisibleColumns", JSON.stringify(visibleColumnIds));
    sessionStorage.setItem("gamesOpponentFilter", JSON.stringify(opponentFilter || null));
    router.push("/dashboard/compose-email");
  };

  const handleAddColumnsClick = () => {
    trackEvent("Add Columns Clicked", {
      source: "games_table",
      action: "add_columns_button",
      current_custom_columns_count: customColumns.length,
    });
    setShowColumnManager(true);
  };

  const formatGameDate = (dateString: string) => {
    if (!mounted) return dateString;
    try {
      // Parse the date as UTC to avoid timezone shifts
      const date = new Date(dateString);
      // Extract the UTC date parts to ensure consistent display
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      // Format using UTC components directly to avoid timezone conversion issues
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[month]} ${day}, ${year}`;
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

  // Helper to render editable column title
  const renderEditableColumnTitle = (columnId: ColumnId, defaultLabel: string, sortable: boolean = false, sortFieldValue?: SortField) => {
    const isEditing = editingColumnId === columnId;
    const displayLabel = getColumnLabel(columnId);
    const hasCustomTitle = customColumnTitles[columnId] !== undefined;

    if (isEditing) {
      return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          <TextField
            size="small"
            value={editingColumnTitle}
            onChange={(e) => setEditingColumnTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveColumnTitle();
              } else if (e.key === "Escape") {
                handleCancelEditColumnTitle();
              }
            }}
            onBlur={handleSaveColumnTitle}
            autoFocus
            sx={{
              "& .MuiInputBase-input": {
                fontSize: 12,
                fontWeight: 600,
                py: 0.5,
                px: 1,
                textTransform: "uppercase",
              },
              minWidth: 100,
            }}
          />
        </Box>
      );
    }

    return (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, position: "relative", group: 1 }}>
        {sortable && sortFieldValue ? (
          <TableSortLabel active={sortField === sortFieldValue} direction={sortField === sortFieldValue ? sortOrder : "asc"} onClick={() => handleSort(sortFieldValue)}>
            {displayLabel.toUpperCase()}
          </TableSortLabel>
        ) : (
          <Typography sx={{ fontWeight: 600, fontSize: 12, color: "text.secondary" }}>{displayLabel.toUpperCase()}</Typography>
        )}
        <Tooltip title="Edit column title">
          <IconButton
            size="small"
            onClick={() => handleEditColumnTitle(columnId)}
            sx={{
              p: 0.25,
              opacity: 0,
              transition: "opacity 0.2s",
              ".MuiTableCell-root:hover &": {
                opacity: 0.6,
              },
              "&:hover": {
                opacity: 1,
              },
            }}
          >
            <Edit sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        {hasCustomTitle && (
          <Tooltip title="Reset to default">
            <IconButton
              size="small"
              onClick={() => handleResetColumnTitle(columnId)}
              sx={{
                p: 0.25,
                opacity: 0,
                transition: "opacity 0.2s",
                ".MuiTableCell-root:hover &": {
                  opacity: 0.6,
                },
                "&:hover": {
                  opacity: 1,
                },
              }}
            >
              <Restore sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };

  const renderHeaderCell = (column: ResolvedColumn) => {
    switch (column.id) {
      case "date":
        return (
          <TableCell key="date" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("date", "Date", true, "date")}
              <ColumnFilter
                columnId="date"
                columnName={getColumnLabel("date")}
                columnType="date"
                uniqueValues={uniqueValues.date || []}
                currentFilter={columnFilters.date}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("date", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "sport":
        return (
          <TableCell key="sport" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("sport", "Sport", true, "sport")}
              <ColumnFilter
                columnId="sport"
                columnName={getColumnLabel("sport")}
                columnType="text"
                uniqueValues={uniqueValues.sport || []}
                currentFilter={columnFilters.sport}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("sport", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "level":
        return (
          <TableCell key="level" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("level", "Level", true, "level")}
              <ColumnFilter
                columnId="level"
                columnName={getColumnLabel("level")}
                columnType="text"
                uniqueValues={uniqueValues.level || []}
                currentFilter={columnFilters.level}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("level", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "opponent":
        return (
          <TableCell key="opponent" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("opponent", "Opponent", true, "opponent")}
              <ColumnFilter
                columnId="opponent"
                columnName={getColumnLabel("opponent")}
                columnType="text"
                uniqueValues={uniqueValues.opponent || []}
                currentFilter={columnFilters.opponent}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("opponent", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "isHome":
        return (
          <TableCell key="isHome" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("isHome", "Home/Away", true, "isHome")}
              <ColumnFilter
                columnId="isHome"
                columnName={getColumnLabel("isHome")}
                columnType="select"
                uniqueValues={["Home", "Away"]}
                currentFilter={columnFilters.isHome}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("isHome", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "time":
        return (
          <TableCell key="time" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("time", "Time", true, "time")}
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("time", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("status", "Confirmed", true, "status")}
              <ColumnFilter
                columnId="status"
                columnName={getColumnLabel("status")}
                columnType="select"
                uniqueValues={uniqueValues.status || []}
                currentFilter={columnFilters.status}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("status", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "location":
        return (
          <TableCell key="location" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("location", "Location", true, "location")}
              <ColumnFilter
                columnId="location"
                columnName={getColumnLabel("location")}
                columnType="text"
                uniqueValues={uniqueValues.location || []}
                currentFilter={columnFilters.location}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("location", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "busTravel":
        return (
          <TableCell key="busTravel" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary", whiteSpace: "nowrap" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("busTravel", "Bus Info", true, "busTravel")}
              <ColumnFilter
                columnId="busTravel"
                columnName={getColumnLabel("busTravel")}
                columnType="select"
                uniqueValues={["Yes", "No"]}
                currentFilter={columnFilters.busTravel}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("busTravel", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "notes":
        return (
          <TableCell key="notes" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary", minWidth: 180 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("notes", "Notes", true, "notes")}
              <ColumnFilter
                columnId="notes"
                columnName={getColumnLabel("notes")}
                columnType="text"
                uniqueValues={uniqueValues.notes || []}
                currentFilter={columnFilters.notes}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("notes", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      case "actions":
        return (
          <TableCell key="actions" sx={{ fontWeight: 600, fontSize: 12, py: 2, color: "text.secondary" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>{renderEditableColumnTitle("actions", "Actions", false)}</Box>
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
                {renderEditableColumnTitle(column.id, customColumn.name || "Custom", false)}
                <ColumnFilter
                  columnId={customColumn.id}
                  columnName={getColumnLabel(column.id)}
                  columnType="text"
                  uniqueValues={uniqueValues[customColumn.id] || []}
                  currentFilter={columnFilters[customColumn.id]}
                  onFilterChange={handleColumnFilterChange}
                />
                <Tooltip title="Hide column">
                  <IconButton size="small" onClick={() => handleToggleColumnVisibility(column.id, false)} sx={{ ml: 0.5, p: 0.25 }}>
                    <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                  </IconButton>
                </Tooltip>
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
                sx={{
                  minWidth: 140,
                  fontSize: 13,
                  "& .MuiSelect-select": {
                    paddingBottom: "6px",
                  },
                }}
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
            <Select
              size="small"
              value={newGameData.level}
              onChange={(e) => updateNewGameData({ level: e.target.value as string })}
              displayEmpty
              sx={{
                minWidth: 140,
                fontSize: 13,
                "& .MuiSelect-select": {
                  paddingBottom: "6px",
                },
              }}
            >
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
            <TextField
              size="small"
              value={newGameData.opponent || ""}
              onChange={(e) => updateNewGameData({ opponent: e.target.value })}
              placeholder="Enter opponent name..."
              sx={{ width: 180 }}
              InputProps={{ sx: { fontSize: 13 } }}
            />
          </TableCell>
        );
      case "isHome":
        return (
          <TableCell key="isHome" sx={{ py: 1 }}>
            <Select
              size="small"
              value={newGameData.isHome ? "home" : "away"}
              onChange={(e) => updateNewGameData({ isHome: e.target.value === "home" })}
              sx={{
                width: 80,
                fontSize: 13,
                "& .MuiSelect-select": {
                  paddingBottom: "6px",
                },
              }}
            >
              <MenuItem value="home">Home</MenuItem>
              <MenuItem value="away">Away</MenuItem>
            </Select>
          </TableCell>
        );
      case "time":
        return (
          <TableCell key="time" sx={{ py: 1 }}>
            <CustomTimePicker value={newGameData.time} onChange={(value) => updateNewGameData({ time: value })} size="small" />
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" sx={{ py: 1 }}>
            <Select
              size="small"
              value={newGameData.status}
              onChange={(e) => updateNewGameData({ status: e.target.value as string })}
              sx={{
                width: 110,
                fontSize: 13,
                "& .MuiSelect-select": {
                  paddingBottom: "6px",
                },
              }}
            >
              <MenuItem value="SCHEDULED">Pending</MenuItem>
              <MenuItem value="CONFIRMED">Yes</MenuItem>
              <MenuItem value="CANCELLED">No</MenuItem>
            </Select>
          </TableCell>
        );
      case "location":
        return (
          <TableCell key="location" sx={{ py: 1 }}>
            <TextField
              size="small"
              value={newGameData.location || ""}
              onChange={(e) => {
                const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                updateNewGameData({ location: value });
              }}
              placeholder="Enter location..."
              sx={{ width: 180 }}
              InputProps={{ sx: { fontSize: 13 } }}
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
          <TableCell key="notes" sx={{ py: 1 }}>
            <TextField
              size="small"
              multiline
              rows={2}
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
                width: 180,
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
          const customColumn = column.customColumn as CustomColumn;
          if (!customColumn) return null;
          const columnType = customColumn.type || "TEXT";

          return (
            <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
              {columnType === "TIME" ? (
                <TextField
                  type="time"
                  size="small"
                  fullWidth
                  value={newGameData.customData?.[customColumn.id] || ""}
                  onChange={(e) => {
                    updateNewGameData({
                      customData: {
                        ...(newGameData.customData || {}),
                        [customColumn.id]: e.target.value,
                      },
                    });
                  }}
                  sx={{
                    "& .MuiInputBase-input": {
                      fontSize: 13,
                      py: 0.5,
                    },
                  }}
                />
              ) : columnType === "DATETIME" ? (
                <TextField
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={newGameData.customData?.[customColumn.id] || ""}
                  onChange={(e) => {
                    updateNewGameData({
                      customData: {
                        ...(newGameData.customData || {}),
                        [customColumn.id]: e.target.value,
                      },
                    });
                  }}
                  sx={{
                    "& .MuiInputBase-input": {
                      fontSize: 13,
                      py: 0.5,
                    },
                  }}
                />
              ) : columnType === "DROPDOWN" ? (
                <Select
                  size="small"
                  fullWidth
                  value={newGameData.customData?.[customColumn.id] || ""}
                  onChange={(e) => {
                    updateNewGameData({
                      customData: {
                        ...(newGameData.customData || {}),
                        [customColumn.id]: e.target.value,
                      },
                    });
                  }}
                  displayEmpty
                  sx={{
                    fontSize: 13,
                  }}
                >
                  <MenuItem value="">
                    <em>Select option</em>
                  </MenuItem>
                  <MenuItem value="Option 1">Option 1</MenuItem>
                  <MenuItem value="Option 2">Option 2</MenuItem>
                  <MenuItem value="Option 3">Option 3</MenuItem>
                </Select>
              ) : (
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
              )}
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
                sx={{
                  minWidth: 140,
                  fontSize: 13,
                  bgcolor: "transparent",
                  "& .MuiSelect-select": {
                    paddingBottom: "6px",
                  },
                }}
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
              sx={{
                minWidth: 140,
                fontSize: 13,
                bgcolor: "transparent",
                "& .MuiSelect-select": {
                  paddingBottom: "6px",
                },
              }}
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
            <TextField
              size="small"
              value={editingGame.opponent?.name || ""}
              onChange={(e) => {
                setEditingGameData((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    opponent: { ...prev.opponent, name: e.target.value },
                  };
                });
              }}
              placeholder="Enter opponent name..."
              sx={{
                width: 180,
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
      case "isHome":
        return (
          <TableCell key="isHome" sx={{ py: 1 }}>
            <Select
              size="small"
              value={editingGame.isHome ? "home" : "away"}
              onChange={(e) => setEditingGameData((prev) => (prev ? { ...prev, isHome: e.target.value === "home" } : prev))}
              sx={{
                width: 80,
                fontSize: 13,
                bgcolor: "transparent",
                "& .MuiSelect-select": {
                  paddingBottom: "6px",
                },
              }}
            >
              <MenuItem value="home">Home</MenuItem>
              <MenuItem value="away">Away</MenuItem>
            </Select>
          </TableCell>
        );
      case "time":
        return (
          <TableCell key="time" sx={{ py: 1 }}>
            <CustomTimePicker value={editingGame.time || ""} onChange={(value) => setEditingGameData((prev) => (prev ? { ...prev, time: value } : prev))} size="small" />
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" sx={{ py: 1 }}>
            <Select
              size="small"
              value={editingGame.status}
              onChange={(e) => setEditingGameData((prev) => (prev ? { ...prev, status: e.target.value as string } : prev))}
              sx={{
                width: 110,
                fontSize: 13,
                bgcolor: "transparent",
                "& .MuiSelect-select": {
                  paddingBottom: "6px",
                },
              }}
            >
              <MenuItem value="SCHEDULED">Pending</MenuItem>
              <MenuItem value="CONFIRMED">Yes</MenuItem>
              <MenuItem value="CANCELLED">No</MenuItem>
            </Select>
          </TableCell>
        );
      case "location":
        return (
          <TableCell key="location" sx={{ py: 1 }}>
            <TextField
              size="small"
              value={editingGame.location || ""}
              onChange={(e) => {
                const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                setEditingGameData((prev) => (prev ? { ...prev, location: value } : prev));
              }}
              placeholder="Enter location..."
              sx={{
                width: 180,
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
          <TableCell key="notes" sx={{ py: 1 }}>
            <TextField
              size="small"
              multiline
              rows={3}
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
                width: 180,
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
          const customColumn = column.customColumn as CustomColumn;
          if (!customColumn) return null;
          const columnType = customColumn.type || "TEXT";

          return (
            <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
              {columnType === "TIME" ? (
                <TextField
                  type="time"
                  size="small"
                  fullWidth
                  value={editingCustomData[customColumn.id] || ""}
                  onChange={(e) => handleCustomFieldChange(customColumn.id, e.target.value)}
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
              ) : columnType === "DATETIME" ? (
                <TextField
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={editingCustomData[customColumn.id] || ""}
                  onChange={(e) => handleCustomFieldChange(customColumn.id, e.target.value)}
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
              ) : columnType === "DROPDOWN" ? (
                <Select
                  size="small"
                  fullWidth
                  value={editingCustomData[customColumn.id] || ""}
                  onChange={(e) => handleCustomFieldChange(customColumn.id, e.target.value as string)}
                  displayEmpty
                  sx={{
                    fontSize: 13,
                    bgcolor: "transparent",
                    "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                    "&:hover fieldset": { borderColor: "primary.main" },
                    "&.Mui-focused fieldset": { borderColor: "primary.main" },
                  }}
                >
                  <MenuItem value="">
                    <em>Select option</em>
                  </MenuItem>
                  <MenuItem value="Option 1">Option 1</MenuItem>
                  <MenuItem value="Option 2">Option 2</MenuItem>
                  <MenuItem value="Option 3">Option 3</MenuItem>
                </Select>
              ) : (
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
              )}
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
                  onChange={(e) => handleInlineChange(e.target.value, game)}
                  onKeyDown={(e) => handleInlineKeyDown(e, game)}
                  onBlur={() => handleInlineBlur(game)}
                  autoFocus
                  disabled={isInlineSaving}
                  sx={{ width: "100%" }}
                  InputProps={{ sx: { fontSize: 13 } }}
                />
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {formatGameDate(game.date)}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "date" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "sport": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "sport";
        return (
          <TableCell
            key="sport"
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
            onDoubleClick={() => handleDoubleClick(game, "sport")}
          >
            {isEditing ? (
              <Box sx={{ py: 1 }}>
                <Select
                  size="small"
                  value={inlineEditValue}
                  onChange={(e) => handleInlineChange(e.target.value as string, game)}
                  onKeyDown={(e) => handleInlineKeyDown(e, game)}
                  onBlur={() => handleInlineBlur(game)}
                  autoFocus
                  disabled={isInlineSaving}
                  sx={{ width: "100%", fontSize: 13 }}
                >
                  {uniqueSports.map((sport: string) => (
                    <MenuItem key={sport} value={sport}>
                      {sport}
                    </MenuItem>
                  ))}
                </Select>
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {game.homeTeam.sport.name}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "sport" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "level": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "level";
        const currentSport = inlineEditState?.gameId === game.id && inlineEditState.field === "sport" ? inlineEditValue : game.homeTeam.sport.name;
        const levelsForCurrentSport = getLevelsForSport(currentSport);
        return (
          <TableCell
            key="level"
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
            onDoubleClick={() => handleDoubleClick(game, "level")}
          >
            {isEditing ? (
              <Box sx={{ py: 1 }}>
                <Select
                  size="small"
                  value={inlineEditValue}
                  onChange={(e) => handleInlineChange(e.target.value as string, game)}
                  onKeyDown={(e) => handleInlineKeyDown(e, game)}
                  onBlur={() => handleInlineBlur(game)}
                  autoFocus
                  disabled={isInlineSaving}
                  sx={{ width: "100%", fontSize: 13 }}
                >
                  {levelsForCurrentSport.map((level: string) => (
                    <MenuItem key={level} value={level}>
                      {level}
                    </MenuItem>
                  ))}
                </Select>
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {game.homeTeam.level}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "level" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "opponent": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "opponent";
        return (
          <TableCell
            key="opponent"
            sx={{
              fontSize: 13,
              py: 0,
              minWidth: 180,
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
              <Box sx={{ py: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={inlineEditValue}
                  onChange={(e) => handleInlineChange(e.target.value, game)}
                  onKeyDown={(e) => handleInlineKeyDown(e, game)}
                  onBlur={() => handleInlineBlur(game)}
                  autoFocus
                  disabled={isInlineSaving}
                  placeholder="Enter opponent name..."
                  sx={{
                    "& .MuiInputBase-input": {
                      fontSize: 13,
                    },
                  }}
                />
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {game.opponent?.name || "TBD"}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "opponent" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "isHome": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "isHome";
        return (
          <TableCell
            key="isHome"
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
            onDoubleClick={() => handleDoubleClick(game, "isHome")}
          >
            {isEditing ? (
              <Box sx={{ py: 1 }}>
                <Select
                  size="small"
                  value={inlineEditValue}
                  onChange={(e) => handleInlineChange(e.target.value as string, game)}
                  onKeyDown={(e) => handleInlineKeyDown(e, game)}
                  onBlur={() => handleInlineBlur(game)}
                  autoFocus
                  disabled={isInlineSaving}
                  sx={{ width: "100%", fontSize: 13 }}
                >
                  <MenuItem value="home">Home</MenuItem>
                  <MenuItem value="away">Away</MenuItem>
                </Select>
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Chip
                  label={game.isHome ? "Home" : "Away"}
                  size="small"
                  sx={{ fontSize: 11, fontWeight: 500, backgroundColor: game.isHome ? "#0f172a" : "#e3e3e7", color: game.isHome ? "#e3e3e7" : "#0f172a" }}
                />
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "isHome" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
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
                <CustomTimePicker
                  value={inlineEditValue}
                  onChange={(value) => handleInlineChange(value, game)}
                  onBlur={() => handleInlineBlur(game)}
                  autoFocus
                  disabled={isInlineSaving}
                  size="small"
                />
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
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
                  onChange={(e) => handleInlineChange(e.target.value as string, game)}
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
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Chip
                  icon={confirmedStatus.icon}
                  label={confirmedStatus.label}
                  size="small"
                  color={confirmedStatus.color as ChipProps["color"]}
                  sx={{
                    fontSize: 11,
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
              minWidth: 180,
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
                  onChange={(e) => handleInlineChange(e.target.value, game)}
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
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {game.location || game.venue?.name || "—"}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "location" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "busTravel": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "busTravel";
        const departureDisplay = formatBusTimeDisplay(game.actualDepartureTime);
        const arrivalDisplay = formatBusTimeDisplay(game.actualArrivalTime);

        // Parse the inline edit value for busTravel (only if editing this field)
        const parts = isEditing ? inlineEditValue.split("|") : [];
        const editDepartureTime = parts[0] || "";
        const editArrivalTime = parts[1] || "";
        const editBusTravel = parts[2] === "true";

        return (
          <TableCell
            key="busTravel"
            sx={{
              py: 0,
              minWidth: 180,
              cursor: isEditing ? "default" : "pointer",
              bgcolor: isEditing ? "#fff9e6" : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? "#fff9e6" : "#f5f5f5",
              },
            }}
            onDoubleClick={() => handleDoubleClick(game, "busTravel")}
          >
            {isEditing ? (
              <Box sx={{ py: 1 }}>
                <Stack direction="column" spacing={0.75}>
                  <TextField
                    type="time"
                    size="small"
                    label="Depart"
                    value={editDepartureTime}
                    onChange={(e) => {
                      const newValue = `${e.target.value}|${editArrivalTime}|${editBusTravel}`;
                      handleInlineChange(newValue, game);
                    }}
                    onBlur={() => handleInlineBlur(game)}
                    disabled={isInlineSaving}
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
                    value={editArrivalTime}
                    onChange={(e) => {
                      const newValue = `${editDepartureTime}|${e.target.value}|${editBusTravel}`;
                      handleInlineChange(newValue, game);
                    }}
                    onBlur={() => handleInlineBlur(game)}
                    disabled={isInlineSaving}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      "& .MuiInputBase-input": { fontSize: 11, py: 0.25 },
                      "& .MuiInputLabel-root": { fontSize: 11 },
                    }}
                  />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Checkbox
                      checked={editBusTravel}
                      onChange={(e) => {
                        const newValue = `${editDepartureTime}|${editArrivalTime}|${e.target.checked}`;
                        handleInlineChange(newValue, game);
                      }}
                      sx={{ p: 0 }}
                      disabled={isInlineSaving}
                    />
                    <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>
                      Bus
                    </Typography>
                  </Box>
                  <SaveStatusIndicator status={saveStatus} />
                </Stack>
              </Box>
            ) : (
              <Box sx={{ py: 0 }}>
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
                  {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "busTravel" && (
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                      <CircularProgress size={12} />
                    </Box>
                  )}
                </Stack>
              </Box>
            )}
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
              minWidth: 180,
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
                    handleInlineChange(value, game);
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
                <SaveStatusIndicator status={saveStatus} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
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
          <TableCell key="actions" sx={{ py: 0 }}>
            <Stack direction="row" spacing={0}>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleEditGame(game)} sx={{ p: 0.5 }}>
                  <Edit sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Duplicate">
                <IconButton size="small" onClick={() => handleDuplicateGame(game)} disabled={createGameMutation.isPending} sx={{ p: 0.5 }}>
                  <ContentCopy sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Sync to Calendar">
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
          const customColumn = column.customColumn as CustomColumn;
          if (!customColumn) return null;
          const fieldKey = `custom:${customColumn.id}` as InlineEditField;
          const customData = (game.customData as any) || {};
          const cellValue = customData[customColumn.id] || "";
          const isCustomEditing = inlineEditState?.gameId === game.id && inlineEditState.field === fieldKey;
          const columnType = customColumn.type || "TEXT";

          // Format display value based on column type
          const displayValue = (() => {
            if (!cellValue) return "—";
            if (columnType === "TIME") {
              return formatTimeDisplay(cellValue);
            }
            if (columnType === "DATETIME") {
              try {
                return format(new Date(cellValue), "MMM d, h:mm a");
              } catch {
                return cellValue;
              }
            }
            return cellValue;
          })();

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
                  {columnType === "TIME" ? (
                    <TextField
                      type="time"
                      size="small"
                      fullWidth
                      value={inlineEditValue}
                      onChange={(e) => handleInlineChange(e.target.value, game)}
                      onKeyDown={(e) => handleInlineKeyDown(e, game)}
                      onBlur={() => handleInlineBlur(game)}
                      autoFocus
                      disabled={isInlineSaving}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: 13,
                        },
                      }}
                    />
                  ) : columnType === "DATETIME" ? (
                    <TextField
                      type="datetime-local"
                      size="small"
                      fullWidth
                      value={inlineEditValue}
                      onChange={(e) => handleInlineChange(e.target.value, game)}
                      onKeyDown={(e) => handleInlineKeyDown(e, game)}
                      onBlur={() => handleInlineBlur(game)}
                      autoFocus
                      disabled={isInlineSaving}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: 13,
                        },
                      }}
                    />
                  ) : columnType === "DROPDOWN" ? (
                    <Select
                      size="small"
                      fullWidth
                      value={inlineEditValue}
                      onChange={(e) => handleInlineChange(e.target.value as string, game)}
                      onBlur={() => handleInlineBlur(game)}
                      autoFocus
                      disabled={isInlineSaving}
                      displayEmpty
                      sx={{
                        fontSize: 13,
                      }}
                    >
                      <MenuItem value="">
                        <em>Select option</em>
                      </MenuItem>
                      <MenuItem value="Option 1">Option 1</MenuItem>
                      <MenuItem value="Option 2">Option 2</MenuItem>
                      <MenuItem value="Option 3">Option 3</MenuItem>
                    </Select>
                  ) : (
                    <TextField
                      size="small"
                      fullWidth
                      value={inlineEditValue}
                      onChange={(e) => handleInlineChange(e.target.value, game)}
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
                  )}
                  {inlineEditError && inlineEditState?.field === fieldKey && (
                    <Typography variant="caption" sx={{ fontSize: 10, color: "error.main", display: "block", mt: 0.5 }}>
                      {inlineEditError}
                    </Typography>
                  )}
                  <SaveStatusIndicator status={saveStatus} />
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: 13 }}>
                    {displayValue}
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

  const activeFilterCount = Object.values(columnFilters).filter((filter) => {
    if (filter.type === "condition") {
      // For condition filters, check if we have a condition set
      // is_empty and is_not_empty don't need a value
      if (filter.condition === "is_empty" || filter.condition === "is_not_empty") {
        return true;
      }
      // between needs both value and secondValue
      if (filter.condition === "between") {
        return !!(filter.value && filter.secondValue);
      }
      // Other conditions need at least a value
      return !!(filter.condition && filter.value);
    } else if (filter.type === "values") {
      // For values filters, check if we have at least one selected value
      return !!(filter.values && filter.values.length > 0);
    }
    return false;
  }).length;

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
      <Box
        sx={{ mb: { xs: 2, md: 4 }, display: "flex", flexDirection: { xs: "column", md: "row" }, gap: { xs: 2, md: 0 }, justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" } }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: "1.25rem", md: "1.5rem" } }}>
            Games Schedule
          </Typography>
          <Typography variant="body2" component="div" color="text.primary" sx={{ fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Manage your athletic schedules and create your own customized columns.
            {activeFilterCount > 0 && (
              <Chip
                label={`${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`}
                size="small"
                onDelete={() => setColumnFilters({})}
                sx={{
                  ml: 1,
                  bgcolor: "black",
                  color: "white",
                  "& .MuiChip-deleteIcon": {
                    color: "white",
                    "&:hover": {
                      color: "rgba(255, 255, 255, 0.7)",
                    },
                  },
                  "&:hover": {
                    bgcolor: "rgba(0, 0, 0, 0.8)",
                  },
                }}
              />
            )}
          </Typography>
          <Stack direction="row" spacing={{ xs: 1, sm: 2 }} sx={{ mt: 2, flexWrap: "wrap", gap: 0 }}>
            {selectedGames.size > 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<GradientSendIcon />}
                onClick={handleSendEmail}
                size="small"
                sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}
              >
                Send Email ({selectedGames.size})
              </Button>
            )}
            <Button variant="contained" startIcon={<Add />} onClick={handleNewGame} disabled={isAddingNew} size="small" sx={{ textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}>
              Create Game
            </Button>

            <Button variant="outlined" startIcon={<ViewColumn />} onClick={handleAddColumnsClick} size="small" sx={{ textTransform: "none", display: { xs: "none", sm: "inline-flex" } }}>
              Add Columns ({customColumns.length})
            </Button>
            <Button variant="outlined" startIcon={<Tune />} onClick={() => setIsColumnPreferencesOpen(true)} size="small" sx={{ textTransform: "none" }}>
              Columns ({visibleColumnIds.length})
            </Button>
            {selectedGames.size > 0 && (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<ContentCopy />}
                  onClick={handleCopySelectedRows}
                  size="small"
                  sx={{ textTransform: "none", display: { xs: "none", sm: "inline-flex" } }}
                >
                  Copy ({selectedGames.size})
                </Button>
              </>
            )}
            {hiddenColumnCount > 0 && (
              <Button size="small" variant="text" onClick={handleShowAllColumns} sx={{ textTransform: "none", display: { xs: "none", sm: "inline-flex" } }}>
                Show all columns ({hiddenColumnCount} hidden)
              </Button>
            )}
          </Stack>
        </Box>
        <Stack direction="row" spacing={{ xs: 1, sm: 2 }} sx={{ flexShrink: 0 }}>
          {selectedGames.size > 0 && (
            <>
              {/* Delete Button */}
              <LoadingButton
                variant="text"
                startIcon={!bulkDeleteMutation.isPending && <DeleteOutline sx={{ color: "red" }} />}
                onClick={handleBulkDelete}
                loading={bulkDeleteMutation.isPending}
                size="small"
                sx={{ paddingLeft: "5px", paddingRight: "5px", textTransform: "none", background: "transparent", boxShadow: 0, "&:hover": { boxShadow: 0 } }}
              >
                {bulkDeleteMutation.isPending ? "Deleting..." : `Delete(${selectedGames.size})`}
              </LoadingButton>
            </>
          )}
          <Tooltip title="Import games from CSV">
            <Button variant="outlined" startIcon={<Upload />} onClick={() => setShowImportDialog(true)} size="small" sx={{ textTransform: "none" }}>
              Import
            </Button>
          </Tooltip>
          <Tooltip title="Export displayed games to CSV">
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExport}
              disabled={games.length === 0}
              size="small"
              sx={{ textTransform: "none", display: { xs: "none", sm: "inline-flex" } }}
            >
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
              <TableCell padding="checkbox" sx={{ py: 0 }}>
                <Checkbox indeterminate={isIndeterminate} checked={isAllSelected} onChange={handleSelectAll} sx={{ p: 0 }} />
              </TableCell>
              {resolvedColumns.map((column) => renderHeaderCell(column))}
            </TableRow>
          </TableHead>
          <TableBody>
            {renderNewRow()}
            {isLoading ? (
              // Show loading skeleton while data is being fetched
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell padding="checkbox">
                    <Skeleton variant="rectangular" width={18} height={18} />
                  </TableCell>
                  {resolvedColumns.map((column) => (
                    <TableCell key={`skeleton-${index}-${column.id}`}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : games.length === 0 && !isAddingNew ? (
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

  return order.map((value) => String(value) as ColumnId).filter((id) => defaultOrder.includes(id));
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
