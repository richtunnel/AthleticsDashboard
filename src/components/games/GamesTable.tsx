"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingButton } from "../utils/LoadingButton";
import { CustomColumnManager } from "./CustomColumnManager";
import { ColumnPreferencesMenu } from "./ColumnPreferencesMenu";
import { ColumnFilterDragDrop, ColumnFilterValue } from "./ColumnFilterDragDrop";
import { CustomTimePicker } from "../ui/CustomTimePicker";
import { CellContentDialog } from "./CellContentDialog";
import { TimeEditModal } from "./TimeEditModal";
import { ErrorBoundary } from "../utils/ErrorBoundary";
import dynamic from "next/dynamic";
import { ExportService } from "@/lib/services/exportService";
import { QuickAddOpponent } from "./QuickAddOpponent";
import { QuickAddVenue } from "./QuickAddVenue";
import { QuickAddTeam } from "./QuickAddTeams";
import { ConflictDetectionModal } from "./ConflictDetectionModal";
import { AvailableDatesModal } from "./AvailableDatesModal";
import { DismissDepartModal } from "./DismissDepartModal";
import { TravelTimeModal } from "./TravelTimeModal";
import { CostModal } from "./CostModal";
import {
  Sync,
  ViewColumn,
  Download,
  Upload,
  Tune,
  AutoAwesome,
  SyncLock,
  AttachMoney,
  TableChart,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DoNotDisturbOn,
  ChevronLeft,
  ChevronRight,
  Settings as SettingsMenuIcon,
  ViewModule as ViewModuleIcon,
  TableRows as TableRowsIcon,
  PostAdd as PostAddIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/contexts/NotificationContext";
import { GradientSendIcon } from "@/components/icons/GradientSendIcon";
import { ChipProps } from "@mui/material/Chip";
import { useGamesFiltersStore } from "@/lib/stores/gamesFiltersStore";
import { useGamesTableStore, type SortItem } from "@/lib/stores/gamesTableStore";
import { useImportUndoStore } from "@/lib/stores/importUndoStore";
import { useDeleteUndoStore } from "@/lib/stores/deleteUndoStore";
import { useGamesWorkbookStore } from "@/lib/stores/gamesWorkbookStore";
import { useDashboardPreferencesStore } from "@/lib/stores/dashboardPreferencesStore";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import { formatLevelDisplay, extractDatePart, formatTimeDisplay } from "@/lib/utils/formatters";
import { ImportUndoButton } from "./ImportUndoButton";
import { WorksheetToggle } from "./WorksheetToggle";
import { WorksheetView } from "./WorksheetView";
import { ScheduleCalendarView } from "./ScheduleCalendarView";
import { SchedulePostForm } from "@/components/schedule-board/SchedulePostForm";
import { useOpponentColumnStore } from "@/lib/stores/opponentColumnStore";
import { useNavigationStore } from "@/lib/stores/navigationStore";
import { UndoDeleteButton } from "./UndoDeleteButton";
import { SampleGameBanner } from "./SampleGameBanner";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";
import InboxIcon from "@mui/icons-material/Inbox";
import { GameStatus } from "@prisma/client";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import NextLink from "next/link";
import styles from "@/styles/gamestable.module.css";

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
  Card,
  CardContent,
  CardActions,
  Collapse,
  Divider,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
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
  ExpandMore,
  ExpandLess,
  DragIndicator,
} from "@mui/icons-material";
import { format, parse } from "date-fns";
import { parseAndConvertDate } from "@/lib/utils/dateTimeParser";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import SendIcon from "@mui/icons-material/Send";

const CSVImport = dynamic(() => import("./CSVImport").then((mod) => ({ default: mod.CSVImport })), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
      <CircularProgress />
    </Box>
  ),
});

const dateStringToUTCISOString = (dateValue: string): string => {
  if (!dateValue) return "";

  // If it's a full ISO timestamp from the DB (e.g. "2025-07-03T00:00:00.000Z"),
  // extract the date portion directly from the UTC string WITHOUT going through
  // new Date() + getDate(), which would return the LOCAL calendar day and shift
  // the date back by 1 day for any timezone behind UTC.
  const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Date.UTC(+y, +m - 1, +d)).toISOString();
  }

  // If it's already in YYYY-MM-DD format (date-only), create a UTC date directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const parts = dateValue.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day)).toISOString();
  }

  // For other human-readable formats (user input, CSV etc.)
  return parseAndConvertDate(dateValue);
};

// ── Inline date-picker sub-component ─────────────────────────────────────────
//
// Extracted into its own component so `useMemo` can stabilise the `value` prop.
// Without this, `parse(inlineEditValue, ...)` creates a NEW Date object on every
// parent render → MUI DatePicker sees `value` as changed → resets the calendar
// view to the selected month, making month navigation snap back immediately.

interface InlineDatePickerProps {
  inlineEditValue: string;
  isInlineSaving: boolean;
  onClose: () => void;
  onDateChange: (formatted: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function InlineDatePicker({ inlineEditValue, isInlineSaving, onClose, onDateChange, onKeyDown }: InlineDatePickerProps) {
  // Stable Date reference: only recreated when the date string actually changes
  const dateValue = useMemo(() => (inlineEditValue ? parse(inlineEditValue, "yyyy-MM-dd", new Date()) : null), [inlineEditValue]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DatePicker
        open
        onClose={onClose}
        value={dateValue}
        onChange={(newValue) => {
          if (newValue) {
            onDateChange(format(newValue, "yyyy-MM-dd"));
          }
        }}
        disabled={isInlineSaving}
        slotProps={{
          textField: {
            size: "small",
            onKeyDown,
            sx: { width: "100%" },
            InputProps: { sx: { fontSize: 13 } },
          },
          popper: { placement: "bottom-start" },
        }}
      />
    </LocalizationProvider>
  );
}

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
  workbookId?: string | null;
  customData?: { [key: string]: any };
  date: string;
  time: string | null;
  status: string;
  isHome: boolean;
  sortOrder?: number;
  isSampleGame?: boolean;
  travelRequired: boolean;
  busTravel: boolean;
  estimatedTravelTime: number | null;
  actualDepartureTime: string | null;
  actualArrivalTime: string | null;
  calendarSynced?: boolean;
  googleCalendarEventId?: string | null;
  cost?: number | null; // Cost for cost & budget tracking
  customFields?: Record<string, any>; // For imported CSV columns
  homeTeam: {
    id?: string;
    name: string;
    level: string;
    location: string;
    gender?: string | null;
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
  customFields?: { [key: string]: string };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

type SortField = "date" | "time" | "isHome" | "status" | "location" | "sport" | "level" | "opponent" | "busTravel" | "notes" | "sortOrder" | string;
type SortOrder = "asc" | "desc" | null;

type ColumnFilters = Record<string, ColumnFilterValue>;

type InlineEditField = "opponent" | "location" | "date" | "time" | "status" | "notes" | "sport" | "level" | "isHome" | "busTravel" | "field" | `custom:${string}` | `imported:${string}` | ColumnId;
interface InlineEditState {
  gameId: string;
  field: InlineEditField;
}

type ConfirmedStatus = {
  icon: React.ReactNode;
  label: string;
  color: ChipProps["color"]; // Use MUI's Chip color type
};

type StaticColumnId = "date" | "sport" | "level" | "opponent" | "isHome" | "time" | "status" | "location" | "busTravel" | "notes" | "actions" | "select";
type ColumnId = StaticColumnId | `custom:${string}` | `imported:${string}`;

interface ColumnStateConfig {
  id: ColumnId;
  visible: boolean;
}

interface TablePreferencesData {
  order?: ColumnId[];
  hidden?: ColumnId[];
  columnTitles?: Record<string, string>;
  columnWidths?: Record<string, number>;
  [key: string]: unknown;
}

interface ColumnPreferencePayload {
  order: ColumnId[];
  hidden: ColumnId[];
  columnTitles?: Record<string, string>;
  columnWidths?: Record<string, number>;
  customColumns?: string[];
  columnMapping?: Record<string, string>;
  importedAt?: string;
}

interface ResolvedColumn {
  id: ColumnId;
  customColumn?: any;
}

const TABLE_PREFERENCES_KEY = "games";
const STATIC_COLUMN_SEQUENCE: StaticColumnId[] = ["date", "sport", "level", "opponent", "isHome", "time", "status", "location", "busTravel", "notes", "actions"];
const SUPERSEDED_STATIC_COLUMNS: StaticColumnId[] = STATIC_COLUMN_SEQUENCE.filter((id) => id !== "date" && id !== "actions");

const PRESET_SPORTS = ["Boys Basketball", "Girls Basketball", "Boys Flag Football", "Girls Flag Football", "Girls Tennis", "Boys Tennis", "Boys Soccer", "Girls Soccer", "Boys Cross Country"];

const PRESET_LEVELS = ["VARSITY", "JV", "FRESHMAN"];

// Save Status Banner Component - displays at top of table
type SaveStatusType = "idle" | "pending" | "saving" | "saved" | "error";

interface SaveStatusBannerProps {
  status: SaveStatusType;
}

const SaveStatusBanner: React.FC<SaveStatusBannerProps> = ({ status }) => {
  // Hide idle and pending statuses for quiet save experience
  if (status === "idle" || status === "pending") return null;

  const getStatusConfig = () => {
    switch (status) {
      case "saving":
        return {
          icon: <CircularProgress size={12} sx={{ color: "text.secondary" }} />,
          text: "Saving...",
          bgcolor: "transparent",
          color: "text.secondary",
        };
      case "saved":
        return {
          icon: <CheckCircle sx={{ fontSize: 14, color: "#4caf50" }} />,
          text: "Saved",
          bgcolor: "transparent",
          color: "text.secondary",
        };
      case "error":
        return {
          icon: <Cancel sx={{ fontSize: 14 }} />,
          text: "Error saving changes",
          bgcolor: alpha("#f44336", 0.95),
          color: "#fff",
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 80,
        right: 24,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 1,
        py: 0.75,
        px: 2,
        bgcolor: config.bgcolor,
        color: config.color,
        borderRadius: 2,
        boxShadow: status === "error" ? "0 4px 12px rgba(0, 0, 0, 0.15)" : "none",
        transition: "all 0.3s ease",
        animation: "slideInRight 0.3s ease",
        "@keyframes slideInRight": {
          from: {
            transform: "translateX(100%)",
            opacity: 0,
          },
          to: {
            transform: "translateX(0)",
            opacity: 1,
          },
        },
      }}
    >
      {config.icon}
      <Typography
        variant="body2"
        sx={{
          fontSize: 12,
          fontWeight: 500,
          color: config.color,
        }}
      >
        {config.text}
      </Typography>
    </Box>
  );
};

// ── Game Request Pill — closable chip linking to the Game Requests tab ────────
function GameRequestPill() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("gcGameRequestPillDismissed") === "true";
    } catch {
      return false;
    }
  });

  const { data: unread } = useQuery({
    queryKey: ["game-requests-unread"],
    queryFn: () => fetch("/api/game-requests/unread-count").then((r) => r.json()) as Promise<{ count: number }>,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Auto-reappear when there are new unread requests
  useEffect(() => {
    if ((unread?.count ?? 0) > 0 && dismissed) {
      setDismissed(false);
      try {
        localStorage.removeItem("gcGameRequestPillDismissed");
      } catch {
        /* ignore */
      }
    }
  }, [unread?.count, dismissed]);

  if (dismissed) return null;

  const count = unread?.count ?? 0;

  return (
    <Chip
      icon={<InboxIcon sx={{ fontSize: "1rem !important" }} />}
      label={`Game Requests${count > 0 ? ` (${count})` : ""}`}
      size="small"
      variant="outlined"
      color={count > 0 ? "primary" : "default"}
      onClick={() => router.push("/dashboard/posts?tab=3")}
      onDelete={() => {
        setDismissed(true);
        try {
          localStorage.setItem("gcGameRequestPillDismissed", "true");
        } catch {
          /* ignore */
        }
      }}
      deleteIcon={<Close sx={{ fontSize: "0.85rem !important" }} />}
      sx={{ mt: 1.5, fontWeight: count > 0 ? 700 : 400, cursor: "pointer", transition: "all 0.2s ease" }}
    />
  );
}

export function GamesTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mounted, setMounted] = useState(false);

  const {
    page,
    rowsPerPage,
    setPage,
    setRowsPerPage,
    sortFields,
    setSortFields,
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
    isCustomStructureActive,
    setIsCustomStructureActive,
  } = useGamesTableStore();

  const selectedGames = useMemo(() => new Set(selectedGameIds), [selectedGameIds]);

  const [editingGameData, setEditingGameData] = useState<Game | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showImportChoiceDialog, setShowImportChoiceDialog] = useState(false);
  const [worksheetTab, setWorksheetTab] = useState<"worksheet" | "view">("worksheet");
  const { gamesViewMode, setGamesViewMode, showPostScheduleButton } = useDashboardPreferencesStore();
  const scheduleView = gamesViewMode === "schedule";
  const [postScheduleModalOpen, setPostScheduleModalOpen] = useState(false);
  const [postSchedulePosted, setPostSchedulePosted] = useState(false);
  const { setLeftNavOpen } = useNavigationStore();

  // Auto-hide toolbar menu + sidebar when viewport is narrower than 1440px
  useEffect(() => {
    const BREAKPOINT = 1440;

    const applyHide = (width: number) => {
      if (width < BREAKPOINT) {
        toggleToolbarMenu(false);
        setLeftNavOpen(false);
      }
    };

    // Apply on mount
    applyHide(window.innerWidth);

    const onResize = () => applyHide(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opponent column override (shared with ScheduleCalendarView via persisted store)
  const { overrides: opponentOverrides, setOverride: setOpponentOverride } = useOpponentColumnStore();
  const { workbooks, selectedWorkbookId, showWorkbookSelector, setWorkbooks, addWorkbook, updateWorkbook, deleteWorkbook, setSelectedWorkbookId, setShowWorkbookSelector } = useGamesWorkbookStore();
  const opponentColumnOverride = selectedWorkbookId ? (opponentOverrides[selectedWorkbookId] ?? null) : null;

  /**
   * Resolves the opponent display name for a game row.
   * Priority: user-selected column override → relational opponent → expanded
   * keyword scan across customFields → "TBD".
   * Mirrors the logic in ScheduleCalendarView so both views are identical.
   */
  const resolveOpponent = useCallback(
    (game: any): string => {
      if (opponentColumnOverride) {
        const raw = (game.customFields ?? game.customData ?? {}) as Record<string, any>;
        const val = raw[opponentColumnOverride];
        if (val != null && String(val).trim()) return String(val).trim();
        return "TBD";
      }
      return game.opponent?.name || "TBD";
    },
    [opponentColumnOverride],
  );
  const [viewImportWorkbookId, setViewImportWorkbookId] = useState<string | null>(null);
  const [deletingWorkbookId, setDeletingWorkbookId] = useState<string | null>(null);

  // Anchor element for the first-login Import TipBubble. Using state (not a
  // ref) so the bubble repositions when the toolbar mounts/re-mounts.
  const [importBtnEl, setImportBtnEl] = useState<HTMLButtonElement | null>(null);

  const columnFilters = useGamesFiltersStore((state) => state.columnFilters);
  const setColumnFilters = useGamesFiltersStore((state) => state.setColumnFilters);
  const updateFilter = useGamesFiltersStore((state) => state.updateFilter);
  const clearColumnFilters = useGamesFiltersStore((state) => state.clearFilters);

  const [showColumnManager, setShowColumnManager] = useState(false);

  const [showAddOpponent, setShowAddOpponent] = useState(false);
  const [showAddVenue, setShowAddVenue] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [isColumnPreferencesOpen, setIsColumnPreferencesOpen] = useState(false);
  const [columnState, setColumnState] = useState<ColumnStateConfig[]>([]);
  const [initialPreferencesApplied, setInitialPreferencesApplied] = useState(false);
  const [isUserReordering, setIsUserReordering] = useState(false);

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

  // Track latest date picker selection to avoid race condition with state updates
  const latestDatePickerValueRef = useRef<string | null>(null);

  // Autosave mechanism - batched and debounced
  const pendingChangesRef = useRef<Map<string, Record<string, any>>>(new Map());
  const saveTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const savingGamesRef = useRef<Set<string>>(new Set());

  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<ColumnId | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Cell content expansion dialog state
  const [expandedCell, setExpandedCell] = useState<{ gameId: string; columnId: ColumnId; content: string; title: string } | null>(null);

  // Time edit modal state
  const [timeEditModal, setTimeEditModal] = useState<{ open: boolean; gameId: string; time: string; gameInfo?: { date: string; opponent?: string } } | null>(null);

  // Date field hover state (for showing calendar icon)
  const [hoveredDateGameId, setHoveredDateGameId] = useState<string | null>(null);

  // Track newly created game IDs to preserve them from sort/filter
  const [preservedGameIds, setPreservedGameIds] = useState<Set<string>>(new Set());

  // Conflict detection modal state
  const [conflictModal, setConflictModal] = useState<{
    open: boolean;
    conflicts: Array<{
      gameId: string;
      date: string;
      time: string;
      sport: string;
      level: string;
      opponent: string;
    }>;
    suggestedTimes: string[];
  } | null>(null);

  // AI Scheduler state
  const [aiSchedulerEnabled, setAiSchedulerEnabled] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Available Dates Modal state
  const [availableDatesModalOpen, setAvailableDatesModalOpen] = useState(false);
  // Toolbar menu visibility — persists in localStorage
  const [toolbarMenuVisible, setToolbarMenuVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("gamesTableToolbarVisible");
    return stored === null ? true : stored !== "false";
  });
  // Plan limits state
  const [planLimits, setPlanLimits] = useState<{ worksheetLimit: number } | null>(null);

  // Fetch plan limits
  useEffect(() => {
    fetch("/api/user/plan-limits")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.worksheetLimit === "number") {
          setPlanLimits({ worksheetLimit: data.worksheetLimit });
        }
      })
      .catch((err) => console.error("Error fetching plan limits:", err));
  }, []);

  // Dismiss/Depart Modal state (for Bus Info/Travel custom columns)
  const [dismissDepartModal, setDismissDepartModal] = useState<{
    open: boolean;
    gameId: string;
    gameName: string;
    columnName: string;
    currentDismissTime?: string;
    currentDepartTime?: string;
  } | null>(null);

  // Travel Time Modal state (for Travel Time custom column)
  const [travelTimeModal, setTravelTimeModal] = useState<{
    open: boolean;
    gameId: string;
    gameName: string;
    columnName?: string;
    currentDepartTime?: string;
    currentAddress?: string;
  } | null>(null);

  // Cost Modal state (for Cost custom column)
  const [costModal, setCostModal] = useState<{
    open: boolean;
    gameId: string;
    gameName: string;
    currentCost?: number | null;
  } | null>(null);

  // Unsync confirmation dialog state
  const [unsyncDialogOpen, setUnsyncDialogOpen] = useState(false);
  const [gameToUnsync, setGameToUnsync] = useState<string | null>(null);

  // Workbook management state

  // Workbook edit dialog state
  const [editingWorkbookDialog, setEditingWorkbookDialog] = useState<{
    open: boolean;
    workbookId: string;
    currentName: string;
  } | null>(null);

  // Workbook delete confirmation dialog state
  const [deleteWorkbookDialog, setDeleteWorkbookDialog] = useState<{
    open: boolean;
    workbookId: string;
    workbookName: string;
    gameCount: number;
  } | null>(null);

  // Constants
  const MAX_CHAR_LIMIT = 2500;
  const NOTES_PREVIEW_LENGTH = 100;
  const MIN_COLUMN_WIDTH = 100;
  const MAX_COLUMN_WIDTH = 600;
  const DEFAULT_COLUMN_WIDTH = 150;

  // Deep clone columnFilters for stable query key comparison
  // This prevents unnecessary refetches when the object reference changes but content is the same
  const stableColumnFilters = useMemo(() => {
    return JSON.parse(JSON.stringify(columnFilters));
  }, [columnFilters]);

  // Use stable filter representation in query key to ensure proper cache invalidation
  const GAMES_QUERY_KEY = useMemo(() => {
    // Create a stable string representation of filters for the query key
    const filterKey = Object.keys(stableColumnFilters)
      .sort()
      .map((key) => {
        const filter = stableColumnFilters[key];
        if (filter.type === "condition") {
          return `${key}:condition:${filter.condition || ""}:${filter.value || ""}:${filter.secondValue || ""}`;
        }
        return `${key}:values:${filter.values ? JSON.stringify([...(filter.values as string[])].sort()) : ""}`;
      })
      .join("|");

    return ["games", filterKey, JSON.stringify(sortFields), page + 1, rowsPerPage, selectedWorkbookId] as const;
  }, [stableColumnFilters, sortFields, page, rowsPerPage, selectedWorkbookId]);

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

  // Helper function to check if a required field is empty
  const isRequiredFieldEmpty = (fieldId: string): boolean => {
    if (!isAddingNew) return false;

    switch (fieldId) {
      case "date":
        return !newGameData.date || newGameData.date.trim() === "";
      case "sport":
        return !newGameData.sport || newGameData.sport.trim() === "";
      case "level":
        return !newGameData.level || newGameData.level.trim() === "";
      case "status":
        return !newGameData.status || newGameData.status.trim() === "";
      default:
        return false;
    }
  };

  // Helper function to get error styling for required empty cells
  const getRequiredCellSx = (fieldId: string) => {
    if (isRequiredFieldEmpty(fieldId)) {
      return {
        py: 1,
        "& .MuiOutlinedInput-root, & .MuiSelect-root": {
          "& fieldset": {
            borderColor: "error.main",
            borderWidth: 2,
          },
          "&:hover fieldset": {
            borderColor: "error.dark",
          },
          "&.Mui-focused fieldset": {
            borderColor: "error.main",
          },
        },
      };
    }
    return { py: 1 };
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
    [MAX_CHAR_LIMIT, inlineEditError],
  );

  // useEffect(() => {
  //   console.log(
  //     "Current columns:",
  //     columnState.map((col) => col.id)
  //   );
  //   console.log(
  //     "Has date column:",
  //     columnState.some((col) => col.id === "date")
  //   );
  //   console.log(
  //     "Imported columns:",
  //     columnState.filter((col) => col.id.startsWith("imported:"))
  //   );
  // }, [columnState]);

  useEffect(() => {
    setMounted(true);
    // Clear preserved games on mount (page refresh)
    setPreservedGameIds(new Set());
  }, []);

  // ── Calendar view: fetch all matching games (no pagination) ─────────────────
  const calendarQueryKey = useMemo(() => {
    const filterKey = Object.keys(stableColumnFilters)
      .sort()
      .map((key) => {
        const f = stableColumnFilters[key];
        if (f.type === "condition") return `${key}:c:${f.condition ?? ""}:${f.value ?? ""}:${f.secondValue ?? ""}`;
        return `${key}:v:${f.values ? JSON.stringify([...(f.values as string[])].sort()) : ""}`;
      })
      .join("|");
    return ["games-calendar-view", filterKey, selectedWorkbookId] as const;
  }, [stableColumnFilters, selectedWorkbookId]);

  const { data: calendarResponse, isLoading: calendarLoading } = useQuery({
    queryKey: calendarQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(columnFilters).forEach(([colId, filter]) => {
        params.append(`filter_${colId}_type`, filter.type);
        if (filter.type === "condition") {
          params.append(`filter_${colId}_condition`, filter.condition || "");
          params.append(`filter_${colId}_value`, filter.value || "");
          if (filter.secondValue) params.append(`filter_${colId}_secondValue`, filter.secondValue);
        } else if (filter.type === "values") {
          params.append(`filter_${colId}_values`, JSON.stringify(filter.values || []));
        }
      });
      params.append("sortBy", "date");
      params.append("sortOrder", "asc");
      params.append("page", "1");
      params.append("limit", "1000");
      if (selectedWorkbookId) params.append("workbookId", selectedWorkbookId);
      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error("Failed to fetch calendar games");
      return res.json();
    },
    enabled: scheduleView,
    staleTime: 30_000,
  });

  const calendarGames = calendarResponse?.data?.games ?? [];

  const {
    data: response,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: GAMES_QUERY_KEY,
    queryFn: async () => {
      const params = new URLSearchParams();

      // Debug logging for filter changes
      const filterCount = Object.keys(columnFilters).length;
      if (filterCount > 0) {
        console.log("[GamesTable] Applying filters:", JSON.stringify(columnFilters));
      }

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

      // Encode the full sort spec; API falls back to date asc when absent
      if (sortFields.length > 0) {
        params.append("sort", JSON.stringify(sortFields));
      }
      params.append("page", String(page + 1));
      params.append("limit", String(rowsPerPage));

      // Add workbook filter if a workbook is selected
      if (selectedWorkbookId) {
        params.append("workbookId", selectedWorkbookId);
      }

      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error("Failed to fetch games");
      const data = await res.json();

      // Debug logging for response
      console.log("[GamesTable] Fetched games:", data.data?.games?.length || 0, "games");

      return data;
    },
    placeholderData: (previousData) => previousData,
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
    queryKey: ["customColumns", selectedWorkbookId],
    queryFn: async () => {
      const url = selectedWorkbookId ? `/api/organizations/custom-columns?workbookId=${selectedWorkbookId}` : "/api/organizations/custom-columns";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch custom columns");
      return res.json();
    },
  });

  // When a specific worksheet is active, load/save its own isolated column preferences
  // so that columns from one worksheet never bleed into another.
  const activePreferencesKey = selectedWorkbookId ? `games-${selectedWorkbookId}` : TABLE_PREFERENCES_KEY;

  const { data: columnPreferencesResponse, isLoading: isLoadingPreferences } = useQuery({
    queryKey: ["tablePreferences", activePreferencesKey],
    queryFn: async () => {
      const res = await fetch(`/api/user/table-preferences?table=${activePreferencesKey}`);
      if (!res.ok) throw new Error("Failed to fetch column preferences");
      return res.json();
    },
  });

  // Fetch AI Scheduler setting
  const { data: aiSchedulerResponse } = useQuery({
    queryKey: ["aiScheduler"],
    queryFn: async () => {
      const res = await fetch("/api/user/ai-scheduler");
      if (!res.ok) throw new Error("Failed to fetch AI Scheduler setting");
      return res.json();
    },
  });

  // Update aiSchedulerEnabled state when query data changes
  useEffect(() => {
    if (aiSchedulerResponse?.aiSchedulerEnabled !== undefined) {
      setAiSchedulerEnabled(aiSchedulerResponse.aiSchedulerEnabled);
    }
  }, [aiSchedulerResponse]);

  // Fetch AI Travel Times setting (for enhanced Bus Info/Travel columns)
  const { data: aiTravelTimesResponse } = useQuery({
    queryKey: ["aiTravelTimesEnabled"],
    queryFn: async () => {
      const res = await fetch("/api/user/ai-travel-times");
      if (!res.ok) throw new Error("Failed to fetch AI Travel Times setting");
      return res.json();
    },
  });

  const aiTravelTimesEnabled = aiTravelTimesResponse?.aiTravelTimesEnabled ?? false;

  // Fetch Cost & Budget setting
  const { data: costBudgetResponse } = useQuery({
    queryKey: ["costBudgetEnabled"],
    queryFn: async () => {
      const res = await fetch("/api/user/cost-budget");
      if (!res.ok) throw new Error("Failed to fetch Cost & Budget setting");
      return res.json();
    },
  });

  const costBudgetEnabled = costBudgetResponse?.costBudgetEnabled ?? false;
  const monthlyBudget = costBudgetResponse?.monthlyBudget ?? null;

  // Fetch email send preferences (e.g. whether to include cost column)
  const { data: emailSettingsData } = useQuery({
    queryKey: ["emailSettings"],
    queryFn: async () => {
      const res = await fetch("/api/user/table-preferences?table=email-settings");
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as { includeCostInEmail?: boolean } | null;
    },
  });
  const includeCostInEmail = emailSettingsData?.includeCostInEmail ?? false;

  // Fetch calendar connection status
  const { data: calendarStatusResponse } = useQuery({
    queryKey: ["calendarConnectionStatus"],
    queryFn: async () => {
      const res = await fetch("/api/user/calendar-status");
      if (!res.ok) throw new Error("Failed to fetch calendar status");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isCalendarConnected = calendarStatusResponse?.isConnected ?? false;

  // Fetch workbooks
  const { data: workbooksResponse, isLoading: isLoadingWorkbooks } = useQuery({
    queryKey: ["gamesWorkbooks"],
    queryFn: async () => {
      const res = await fetch("/api/games-workbooks");
      if (!res.ok) throw new Error("Failed to fetch workbooks");
      return res.json();
    },
  });

  // ── Parent-synced sports (for cancel button visibility) ──────────────────
  // Fetches APPROVED CalendarSyncRequests so we know which sport+level combos
  // have parents watching them. The cancel button only appears on matching rows.
  const { data: approvedSyncRequests = [] } = useQuery({
    queryKey: ["adminCalendarSyncRequests", "approved"],
    queryFn: async () => {
      const res = await fetch("/api/admin/calendar-sync-requests");
      if (!res.ok) return [];
      const json = await res.json();
      return ((json.requests as Array<{ sportName: string; sportLevel: string }>) || [])
        .filter((r: any) => r.status === "APPROVED")
        .map((r) => ({
          sportName: r.sportName.toLowerCase(),
          sportLevel: r.sportLevel.toLowerCase(),
        }));
    },
    staleTime: 60_000,
  });

  const syncedSportSet = new Set(approvedSyncRequests.map((r) => `${r.sportName}|${r.sportLevel}`));

  const gameHasSyncedParents = (game: Game): boolean => syncedSportSet.has(`${game.homeTeam?.sport?.name?.toLowerCase() ?? ""}|${game.homeTeam?.level?.toLowerCase() ?? ""}`);

  // ── Cancel game mutation ──────────────────────────────────────────────────
  const [cancellingGameId, setCancellingGameId] = useState<string | null>(null);

  const cancelGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const res = await fetch(`/api/games/${gameId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to cancel game");
      }
      return res.json();
    },
    onMutate: async (gameId) => {
      setCancellingGameId(gameId);
      // Optimistic update: flip the row to CANCELLED immediately
      await queryClient.cancelQueries({ queryKey: GAMES_QUERY_KEY });
      const previous = queryClient.getQueryData(GAMES_QUERY_KEY);
      queryClient.setQueryData(GAMES_QUERY_KEY, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          games: old.games?.map((g: Game) => (g.id === gameId ? { ...g, status: "CANCELLED" as GameStatus } : g)),
        };
      });
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAMES_QUERY_KEY });
    },
    onError: (_err, _gameId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(GAMES_QUERY_KEY, ctx.previous);
      addNotification("Failed to cancel game. Please try again.", "error");
    },
    onSettled: () => setCancellingGameId(null),
  });

  // Track whether we've already auto-created a default workbook
  const hasAutoCreatedWorkbook = useRef(false);

  // Stable reference to track previous workbooks data to avoid unnecessary store updates
  const prevWorkbooksDataRef = useRef<string>("");

  // Update workbooks store when data changes.
  // CRITICAL: This is the SINGLE path for syncing server data → Zustand store.
  // Mutation handlers must NOT also update the store — they only invalidate this query.
  // Dual-updates cause cascading re-renders that crash the browser.
  useEffect(() => {
    if (!workbooksResponse?.data) return;

    const serverData = workbooksResponse.data;
    const dataKey = JSON.stringify(serverData);

    // Skip if data hasn't changed (prevents re-render storms)
    if (dataKey === prevWorkbooksDataRef.current) return;
    prevWorkbooksDataRef.current = dataKey;

    // Compute the correct selectedWorkbookId in one pass
    const currentState = useGamesWorkbookStore.getState();
    let nextSelectedId = currentState.selectedWorkbookId;
    const serverIds = new Set(serverData.map((wb: any) => wb.id));

    if (nextSelectedId && !serverIds.has(nextSelectedId)) {
      // Selected workbook was deleted — fall back to first
      nextSelectedId = serverData.length > 0 ? serverData[0].id : null;
    } else if (!nextSelectedId && serverData.length > 0) {
      // No selection but workbooks exist — select first
      nextSelectedId = serverData[0].id;
    } else if (serverData.length === 0) {
      nextSelectedId = null;
    }

    // Single atomic store update — ONE re-render instead of multiple
    useGamesWorkbookStore.setState({
      workbooks: serverData,
      selectedWorkbookId: nextSelectedId,
    });

    // Auto-create a default workbook if none exist
    if (serverData.length === 0 && !hasAutoCreatedWorkbook.current) {
      hasAutoCreatedWorkbook.current = true;
      fetch("/api/games-workbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Games", assignOrphans: true }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            queryClient.invalidateQueries({ queryKey: ["gamesWorkbooks"] });
            queryClient.invalidateQueries({ queryKey: ["games"] });
          }
        })
        .catch(() => {
          hasAutoCreatedWorkbook.current = false;
        });
    }
  }, [workbooksResponse, queryClient]);

  // Create workbook mutation
  const createWorkbookMutation = useMutation({
    mutationFn: async ({ name, assignOrphans }: { name: string; assignOrphans?: boolean }) => {
      const res = await fetch("/api/games-workbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, assignOrphans }),
      });
      if (!res.ok) throw new Error("Failed to create workbook");
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Pre-select the new workbook so the useEffect picks it up after refetch
      useGamesWorkbookStore.setState({ selectedWorkbookId: data.data.id, showWorkbookSelector: false });
      // Invalidate query — the useEffect will sync server data to the store (single update path)
      queryClient.invalidateQueries({ queryKey: ["gamesWorkbooks"] });
      addNotification("Workbook created successfully", "success");
      trackEvent("Games Table Create Table Clicked", {
        source: "games_table",
        action: "create_workbook",
        workbookId: data.data.id,
        workbookName: data.data.name,
      });
      if (variables.assignOrphans) {
        queryClient.invalidateQueries({ queryKey: ["games"] });
      }
    },
    onError: (error: any) => {
      addNotification(error.message || "Failed to create workbook", "error");
    },
  });

  // Update workbook mutation
  const updateWorkbookMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/games-workbooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update workbook");
      return res.json();
    },
    onSuccess: () => {
      // Only invalidate the query — the useEffect will update the store (single update path)
      // Do NOT also call updateWorkbook() here — that causes a double store update → crash
      queryClient.invalidateQueries({ queryKey: ["gamesWorkbooks"] });
      addNotification("Workbook renamed successfully", "success");
      setEditingWorkbookDialog(null);
    },
    onError: (error: any) => {
      addNotification(error.message || "Failed to update workbook", "error");
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

  const PERMANENTLY_KEPT_STATIC_IDS = useMemo(() => new Set<ColumnId>(["date", "actions", "select"]), []); // CRITICAL FIX: Memoize defaultColumnOrder separately to prevent recalculation issues
  // When user has imported columns, we must ALWAYS use those columns, never default columns
  const defaultColumnOrder = useMemo(() => {
    let order = getDefaultColumnOrder(customColumns, columnPreferencesData);

    if (isCustomStructureActive) {
      // CRITICAL STEP: Find the specific custom column ID that was mapped to the static 'date' field.
      const customDateColumnId = customColumns.find((col) => col.staticField === "date")?.id;

      order = order.filter((columnId) => {
        // A) Keep the required static IDs ("date", "actions", "select").
        if (PERMANENTLY_KEPT_STATIC_IDS.has(columnId)) {
          return true;
        }

        // B) Explicitly remove the custom column ID that was mapped to 'date'.
        if (customDateColumnId && columnId === customDateColumnId) {
          return false; // <-- This is the key fix for the date picker
        }

        // C) Keep ALL other custom/imported columns.
        if (columnId.startsWith("custom:") || columnId.startsWith("imported:")) {
          return true;
        }

        // D) Remove all other default static columns.
        return false;
      });

      // Post-filtering: Ensure 'date' is present in the final order and near the front.
      if (!order.includes("date")) {
        // Add 'date' back if it was somehow removed.
        const selectIndex = order.findIndex((id) => id === "select");
        if (selectIndex !== -1) {
          order.splice(selectIndex + 1, 0, "date");
        } else {
          order.unshift("date");
        }
      } else {
        // Re-order 'date' to ensure it's not misplaced by other custom columns
        // that might have been loaded before it.
        order = [
          ...order.filter((id) => id === "select"), // Keep 'select' first
          ...order.filter((id) => id === "date"), // Keep 'date' second
          ...order.filter((id) => id !== "select" && id !== "date" && id !== "actions"), // All data columns
          ...order.filter((id) => id === "actions"), // Keep 'actions' last
        ];
      }
    }

    return order;
  }, [customColumns, columnPreferencesData, isCustomStructureActive, PERMANENTLY_KEPT_STATIC_IDS]);

  // useEffect(() => {
  //   if (columnPreferencesData) {
  //     console.log("Column preferences:", columnPreferencesData);
  //     console.log("Custom columns:", columnPreferencesData.customColumns);
  //     console.log("Column mapping:", columnPreferencesData.columnMapping);
  //   }
  // }, [columnPreferencesData]);

  // CRITICAL FIX: Only update column state when preferences actually change
  // We derive the column state from the saved preferences, not from defaultColumnOrder recalculations
  useEffect(() => {
    // Skip recalculation if user is actively reordering - prevents imported columns from being lost
    if (isUserReordering) return;

    setColumnState((prev) => {
      // CRITICAL: Always pass defaultColumnOrder to deriveColumnState
      // The function uses this to find NEW columns (like newly created custom columns)
      // It already handles saved preferences internally via the preferences parameter
      return deriveColumnState(prev, columnPreferencesData, defaultColumnOrder, initialPreferencesApplied);
    });
  }, [columnPreferencesData, defaultColumnOrder, initialPreferencesApplied, isUserReordering]);

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

  // Load column widths from preferences
  useEffect(() => {
    if (columnPreferencesData?.columnWidths) {
      setColumnWidths(columnPreferencesData.columnWidths);
    }
  }, [columnPreferencesData]);

  // Show all games immediately after import (no filtering)
  // Preserve newly created games at the end regardless of sort/filter
  const allGames = response?.data?.games || [];
  const games = useMemo(() => {
    if (preservedGameIds.size === 0) {
      return allGames;
    }

    // Split games into preserved (newly created) and regular games
    const preserved: Game[] = [];
    const regular: Game[] = [];

    allGames.forEach((game: Game) => {
      if (preservedGameIds.has(game.id)) {
        preserved.push(game);
      } else {
        regular.push(game);
      }
    });

    // Return regular games followed by preserved games at the end
    return [...regular, ...preserved];
  }, [allGames, preservedGameIds]);

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
    [levelsBySport, uniqueLevels],
  );

  const uniqueValues = useMemo(() => {
    const values: Record<string, Set<string>> = {
      sport: new Set(),
      level: new Set(),
      opponent: new Set(),
      status: new Set(),
      location: new Set(),
      busTravel: new Set(),
      isHome: new Set(),
      time: new Set(),
      notes: new Set(["Has notes", "No notes"]),
      date: new Set(),
    };

    customColumns.forEach((col: any) => {
      values[`custom:${col.id}`] = new Set();
    });

    // Add sets for imported columns
    const importedColumns = columnPreferencesData?.customColumns as string[] | undefined;
    if (importedColumns && Array.isArray(importedColumns)) {
      importedColumns.forEach((colName) => {
        values[`imported:${colName}`] = new Set();
      });
    }

    games.forEach((game: Game) => {
      values.sport.add(game.homeTeam.sport.name);
      values.level.add(game.homeTeam.level);
      values.opponent.add(resolveOpponent(game));
      values.status.add(game.status);
      const locationValue = game.location || game.venue?.name || "TBD";
      values.location.add(locationValue);
      values.busTravel.add(game.busTravel ? "Yes" : "No");
      values.isHome.add(game.isHome ? "Home" : "Away");
      if (game.time) {
        // Store the human-readable 12-hour format in uniqueValues so filter
        // checkboxes always show "6:00 PM" rather than raw "18:00".
        const displayTime = formatTimeDisplay(game.time);
        values.time.add(displayTime && displayTime !== "TBD" ? displayTime : game.time);
      }

      // Add date value — emit full date, month token, and year token so the
      // filter panel can show individual-date, by-month, and by-year groups.
      if (game.date) {
        const datePart = extractDatePart(game.date); // YYYY-MM-DD
        values.date.add(datePart);
        // Month and year tokens are prefixed so the filter UI and API can
        // distinguish them from exact-date values.
        const [yyyy, mm] = datePart.split("-");
        if (yyyy && mm) values.date.add(`month:${yyyy}-${mm}`);
        if (yyyy) values.date.add(`year:${yyyy}`);
      }

      const customData = (game.customData as any) || {};
      customColumns.forEach((col: any) => {
        const value = customData[col.id] || "";
        if (value) {
          if (col.type === "DATETIME") {
            values[`custom:${col.id}`].add(extractDatePart(String(value)));
          } else {
            values[`custom:${col.id}`].add(value);
          }
        }
      });

      // Add values for imported columns
      const customFields = (game.customFields as Record<string, any>) || {};
      if (importedColumns && Array.isArray(importedColumns)) {
        const columnMapping = columnPreferencesData?.columnMapping as Record<string, string> | undefined;
        importedColumns.forEach((colName) => {
          const value = customFields[colName];
          if (value) {
            const strValue = String(value);
            const isMappedToDate = columnMapping?.[colName] === "date";
            // For imported columns, if it looks like an ISO date, extract the date part
            if (strValue.includes("T") && !isNaN(Date.parse(strValue))) {
              const datePart = extractDatePart(strValue);
              values[`imported:${colName}`].add(datePart);
              // If this column is mapped to "date", also emit month/year tokens so the
              // filter panel can show Year / Month / Specific Date groupings.
              if (isMappedToDate) {
                const [yyyy, mm] = datePart.split("-");
                if (yyyy && mm) values[`imported:${colName}`].add(`month:${yyyy}-${mm}`);
                if (yyyy) values[`imported:${colName}`].add(`year:${yyyy}`);
              }
            } else if (isMappedToDate && /^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
              // Already a bare YYYY-MM-DD date — still emit tokens
              values[`imported:${colName}`].add(strValue);
              const [yyyy, mm] = strValue.split("-");
              if (yyyy && mm) values[`imported:${colName}`].add(`month:${yyyy}-${mm}`);
              if (yyyy) values[`imported:${colName}`].add(`year:${yyyy}`);
            } else {
              values[`imported:${colName}`].add(strValue);
            }
          }
        });
      }
    });

    // Helper: convert a display time like "6:00 PM" to minutes-since-midnight
    // for chronological sorting. Falls back to 0 for unrecognised strings.
    const timeToMinutes = (t: string): number => {
      const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return 0;
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const period = m[3].toUpperCase();
      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + min;
    };

    const result: Record<string, string[]> = {};
    Object.keys(values).forEach((key) => {
      if (key === "time") {
        // Sort times chronologically ("6:00 AM" < "12:00 PM" < "6:00 PM")
        result[key] = Array.from(values[key]).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
      } else {
        result[key] = Array.from(values[key]).sort();
      }
    });

    return result;
  }, [games, customColumns, columnPreferencesData]);

  const getColumnLabel = useCallback(
    (columnId: ColumnId) => {
      // Check for custom title first
      if (customColumnTitles[columnId]) {
        return customColumnTitles[columnId];
      }

      // Handle imported columns
      if (columnId.startsWith("imported:")) {
        const columnName = columnId.split(":")[1];
        const columnMapping = columnPreferencesData?.columnMapping as Record<string, string> | undefined;

        // If this imported column is mapped to "date", return "Date"
        if (columnMapping?.[columnName] === "date") {
          return "Date";
        }

        return columnName; // Use the CSV column name as-is
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
    [customColumnsMap, customColumnTitles, columnPreferencesData],
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
        disableDelete: column.id === "date" || column.id === "actions",
      })),
    [columnState, getColumnLabel],
  );

  const visibleCustomColumns = useMemo(() => {
    const visibleIds = new Set(columnState.filter((column) => column.visible && column.id.startsWith("custom:")).map((column) => column.id.split(":")[1]));
    return customColumns.filter((column: any) => visibleIds.has(column.id));
  }, [columnState, customColumns]);

  const visibleColumnIds = useMemo(() => columnState.filter((column) => column.visible).map((column) => column.id), [columnState]);

  const findGameInCache = (queryClient: any, gameId: string): Game | undefined => {
    const gamesQueryData = queryClient.getQueryData(["games"]) as any;

    if (!gamesQueryData) return undefined;

    // Normalize the games list based on common query structures: array, wrapped, or nested
    let gameList: any[] = [];
    if (Array.isArray(gamesQueryData)) {
      gameList = gamesQueryData;
    } else if (gamesQueryData.data && Array.isArray(gamesQueryData.data.games)) {
      // This handles a response shape like { data: { games: [...] } }
      gameList = gamesQueryData.data.games;
    } else if (gamesQueryData.games && Array.isArray(gamesQueryData.games)) {
      // This handles a response shape like { games: [...] }
      gameList = gamesQueryData.games;
    }

    return gameList.find((g) => g.id === gameId);
  };

  const syncGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      console.log("🔄 Mutation function called with gameId:", gameId);

      const res = await fetch(`/api/games/${gameId}/gsync-calendar`, { method: "POST" });
      console.log("🔄 Response status:", res.status);

      if (!res.ok) {
        const error = await res.json();
        console.error("[Calendar Sync] API Error:", error);
        throw new Error(error.error || "Failed to sync calendar.");
      }
      const result = await res.json();
      console.log("[Calendar Sync] Success:", result);
      return result;
    },
    onMutate: async (gameId: string) => {
      console.log("[Calendar Sync] onMutate - Starting optimistic update for game:", gameId);
      // Use the same query key as the main games query
      await queryClient.cancelQueries({ queryKey: GAMES_QUERY_KEY });

      const previousGames = queryClient.getQueryData<any>(GAMES_QUERY_KEY);

      queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
        if (!oldData) return oldData;

        // Case 1: cache is a raw array of games
        if (Array.isArray(oldData)) {
          return oldData.map((g: Game) => (g.id === gameId ? { ...g, calendarSynced: true } : g));
        }

        // Case 2: cache is paginated object { data: { games: [...] } } — handle safely
        if (oldData.data && Array.isArray(oldData.data.games)) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              games: oldData.data.games.map((g: Game) => (g.id === gameId ? { ...g, calendarSynced: true, googleCalendarEventId: g.googleCalendarEventId } : g)),
            },
          };
        }

        // fallback: return unchanged
        return oldData;
      });

      return { previousGames };
    },
    onError: (err: Error, gameId, context: any) => {
      console.error("[Calendar Sync] onError - Failed to sync game:", gameId, err);
      if (context?.previousGames) {
        queryClient.setQueryData(GAMES_QUERY_KEY, context.previousGames);
      }
      // Show the actual error message from the API
      const errorMessage = err.message || "Failed to sync calendar";
      addNotification(errorMessage, "error");
    },
    onSuccess: (data, gameId) => {
      console.log("[Calendar Sync] onSuccess - Successfully synced game:", gameId, data);

      // apply authoritative server result if present
      // API response structure: { success: true, data: { eventId: "...", htmlLink: "..." } }
      const eventId = data?.data?.eventId;

      queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
        if (!oldData) return oldData;

        if (Array.isArray(oldData)) {
          return oldData.map((g: Game) => (g.id === gameId ? { ...g, calendarSynced: true, googleCalendarEventId: eventId ?? g.googleCalendarEventId } : g));
        }

        if (oldData.data && Array.isArray(oldData.data.games)) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              games: oldData.data.games.map((g: Game) => (g.id === gameId ? { ...g, calendarSynced: true, googleCalendarEventId: eventId ?? g.googleCalendarEventId } : g)),
            },
          };
        }

        return oldData;
      });

      // Also invalidate the dashboard widget to ensure sync state is consistent everywhere
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-games"] });

      // Show success notification
      addNotification("Successfully synced to Google Calendar", "success");

      // no refetch needed
    },
  });

  const unsyncGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const res = await fetch(`/api/games/${gameId}/gsync-calendar`, { method: "DELETE" });

      if (!res.ok) {
        const error = await res.json();
        console.error("[Calendar Unsync] API Error:", error);
        throw new Error(error.error || "Failed to remove from calendar.");
      }
      const result = await res.json();
      console.log("[Calendar Unsync] Success:", result);
      return result;
    },
    onMutate: async (gameId: string) => {
      // Use the same query key as the main games query
      await queryClient.cancelQueries({ queryKey: GAMES_QUERY_KEY });
      const previousGames = queryClient.getQueryData<any>(GAMES_QUERY_KEY);

      queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
        if (!oldData) return oldData;

        if (Array.isArray(oldData)) {
          return oldData.map((g: Game) => (g.id === gameId ? { ...g, calendarSynced: false, googleCalendarEventId: null } : g));
        }

        if (oldData.data && Array.isArray(oldData.data.games)) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              games: oldData.data.games.map((g: Game) => (g.id === gameId ? { ...g, calendarSynced: false, googleCalendarEventId: null } : g)),
            },
          };
        }

        return oldData;
      });

      return { previousGames };
    },
    onError: (err: Error, gameId, context: any) => {
      if (context?.previousGames) {
        queryClient.setQueryData(GAMES_QUERY_KEY, context.previousGames);
      }
      const errorMessage = err.message || "Failed to remove from calendar";
      addNotification(errorMessage, "error");
    },
    onSuccess: (data, gameId) => {
      queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
        if (!oldData) return oldData;

        if (Array.isArray(oldData)) {
          return oldData.map((g: Game) => (g.id === gameId ? { ...g, calendarSynced: false, googleCalendarEventId: null } : g));
        }

        if (oldData.data && Array.isArray(oldData.data.games)) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              games: oldData.data.games.map((g: Game) => (g.id === gameId ? { ...g, calendarSynced: false, googleCalendarEventId: null } : g)),
            },
          };
        }

        return oldData;
      });

      // Also invalidate the dashboard widget to ensure sync state is consistent everywhere
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-games"] });

      addNotification("Removed from Google Calendar", "success");
    },
  });

  // Bulk calendar sync mutation - syncs multiple games sequentially
  const bulkSyncGamesMutation = useMutation({
    mutationFn: async (gameIds: string[]) => {
      const results = {
        successful: [] as string[],
        failed: [] as { gameId: string; error: string }[],
        skipped: [] as string[],
      };

      // Sync games sequentially to avoid rate limiting
      for (const gameId of gameIds) {
        try {
          const res = await fetch(`/api/games/${gameId}/gsync-calendar`, { method: "POST" });

          if (!res.ok) {
            const error = await res.json();

            // Check if skipped due to no calendar connection
            if (error.skipped) {
              results.skipped.push(gameId);
            } else {
              results.failed.push({ gameId, error: error.error || "Failed to sync" });
            }
          } else {
            results.successful.push(gameId);
          }
        } catch (error: any) {
          results.failed.push({ gameId, error: error.message || "Failed to sync" });
        }
      }

      return results;
    },
    onMutate: async () => {
      // Show initial notification
      addNotification(`Syncing ${selectedGames.size} game(s) to Google Calendar...`, "info");
    },
    onSuccess: (results) => {
      // Update cache for successful syncs
      if (results.successful.length > 0) {
        queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
          if (!oldData) return oldData;

          const successfulSet = new Set(results.successful);

          if (Array.isArray(oldData)) {
            return oldData.map((g: Game) => (successfulSet.has(g.id) ? { ...g, calendarSynced: true } : g));
          }

          if (oldData.data && Array.isArray(oldData.data.games)) {
            return {
              ...oldData,
              data: {
                ...oldData.data,
                games: oldData.data.games.map((g: Game) => (successfulSet.has(g.id) ? { ...g, calendarSynced: true } : g)),
              },
            };
          }

          return oldData;
        });
      }

      // Also invalidate the dashboard widget to ensure sync state is consistent everywhere
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-games"] });

      // Build result message
      const messages: string[] = [];

      if (results.successful.length > 0) {
        messages.push(`✓ ${results.successful.length} game(s) synced successfully`);
      }

      if (results.failed.length > 0) {
        messages.push(`✗ ${results.failed.length} failed`);
      }

      if (results.skipped.length > 0) {
        messages.push(`⊘ ${results.skipped.length} skipped (Google Calendar not connected)`);
      }

      const message = messages.join(". ");

      // Determine notification type
      let type: "success" | "warning" | "error" = "success";
      if (results.successful.length === 0 && results.skipped.length > 0) {
        type = "error";
      } else if (results.failed.length > 0 || results.skipped.length > 0) {
        type = "warning";
      }

      addNotification(message, type);

      // Clear selections after sync completes
      clearSelectedGameIds();
    },
    onError: (error: any) => {
      addNotification(error.message || "Failed to sync games", "error");
    },
  });

  const savePreferencesMutation = useMutation({
    mutationFn: async (payload: ColumnPreferencePayload) => {
      const res = await fetch("/api/user/table-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: activePreferencesKey, preferences: payload }),
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
    onSuccess: (data) => {
      // CRITICAL FIX: Only update the cache, do NOT invalidate queries
      // Invalidating triggers a refetch which causes column state to be recalculated
      // This was causing default columns to reappear after reordering
      queryClient.setQueryData(["tablePreferences", activePreferencesKey], {
        success: true,
        data: data.data,
      });

      // CRITICAL FIX: Clear the reordering flag AFTER cache update completes
      // This prevents the useEffect from running until the cache is fully updated
      // Fixes double-render issue during column reordering
      setTimeout(() => {
        setIsUserReordering(false);
      }, 50);
    },
  });

  const persistColumnPreferences = useCallback(
    (nextState: ColumnStateConfig[], previousState: ColumnStateConfig[], updatedColumnTitles?: Record<string, string>, updatedColumnWidths?: Record<string, number>) => {
      const payload: ColumnPreferencePayload = {
        order: nextState.map((column) => column.id),
        hidden: nextState.filter((column) => !column.visible).map((column) => column.id),
        columnTitles: updatedColumnTitles !== undefined ? updatedColumnTitles : customColumnTitles,
        columnWidths: updatedColumnWidths !== undefined ? updatedColumnWidths : columnWidths,
        // CRITICAL FIX: Preserve existing imported column data
        customColumns: Array.isArray(columnPreferencesData?.customColumns) ? columnPreferencesData.customColumns : undefined,
        columnMapping:
          columnPreferencesData?.columnMapping && typeof columnPreferencesData.columnMapping === "object" && !Array.isArray(columnPreferencesData.columnMapping)
            ? (columnPreferencesData.columnMapping as Record<string, string>)
            : undefined,
        importedAt: typeof columnPreferencesData?.importedAt === "string" ? columnPreferencesData.importedAt : undefined,
      };
      savePreferencesMutation.mutate(payload, {
        onError: (error: any) => {
          setColumnState(previousState);
          addNotification(error?.message || "Failed to save column preferences", "error");
          // Clear the reordering flag on error as well
          setIsUserReordering(false);
        },
      });
    },
    [savePreferencesMutation, addNotification, customColumnTitles, columnWidths, columnPreferencesData],
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
    [persistColumnPreferences, addNotification],
  );

  const handleReorderColumns = useCallback(
    (order: string[]) => {
      // console.log("REORDER INPUT:", order);
      console.log("Input has date:", order.includes("date"));

      // Set flag to prevent column state recalculation during reordering
      // Flag will be cleared in savePreferencesMutation.onSuccess after cache update
      setIsUserReordering(true);

      const validOrder = order.filter((value): value is ColumnId => isColumnId(value));
      setColumnState((prev) => {
        const previousState = prev.map((column) => ({ ...column }));
        // Use the provided order directly - user's explicit reorder should be respected
        const visibilityMap = new Map(prev.map((column) => [column.id, column.visible]));
        const nextState = validOrder.map((id) => ({
          id,
          visible: visibilityMap.get(id) ?? true,
        }));
        // Optimistic update - immediately apply the new order
        persistColumnPreferences(nextState, previousState);
        return nextState;
      });

      // Note: isUserReordering flag is cleared in savePreferencesMutation.onSuccess
      // This ensures the flag stays true until the cache is fully updated
    },
    [persistColumnPreferences],
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
    [getColumnLabel],
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
    [customColumnTitles, columnState, persistColumnPreferences, addNotification],
  );

  // Column deletion mutation
  const deleteCustomColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const res = await fetch(`/api/organizations/custom-columns/${columnId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete column");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customColumns"] });
      queryClient.invalidateQueries({ queryKey: ["games"], exact: false });
      addNotification("Column deleted successfully", "success");
    },
    onError: (error: any) => {
      addNotification(error?.message || "Failed to delete column", "error");
    },
  });

  // Column deletion handler
  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      // Validate columnId
      if (!isColumnId(columnId)) {
        addNotification("Invalid column ID", "error");
        return;
      }

      const typedColumnId = columnId as ColumnId;

      // Protect date and actions columns
      if (typedColumnId === "date" || typedColumnId === "actions") {
        addNotification("Date and Actions columns cannot be deleted", "error");
        return;
      }

      // Remove from column state
      setColumnState((prev) => {
        const previousState = prev.map((column) => ({ ...column }));
        const nextState = prev.filter((column) => column.id !== typedColumnId);

        // Make sure we have at least one visible column
        const visibleCount = nextState.filter((column) => column.visible).length;
        if (visibleCount === 0) {
          addNotification("Cannot delete the last visible column", "warning");
          return prev;
        }

        persistColumnPreferences(nextState, previousState);
        return nextState;
      });

      // If it's a custom column from database, delete it
      if (typedColumnId.startsWith("custom:")) {
        const customColumnId = typedColumnId.split(":")[1];
        deleteCustomColumnMutation.mutate(customColumnId);
      }

      // Remove custom title if exists
      if (customColumnTitles[typedColumnId]) {
        const updatedTitles = { ...customColumnTitles };
        delete updatedTitles[typedColumnId];
        setCustomColumnTitles(updatedTitles);
      }

      // Remove column width if exists
      if (columnWidths[typedColumnId]) {
        const updatedWidths = { ...columnWidths };
        delete updatedWidths[typedColumnId];
        setColumnWidths(updatedWidths);
      }
    },
    [customColumnTitles, columnWidths, columnState, persistColumnPreferences, addNotification, deleteCustomColumnMutation],
  );

  // Column resizing handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnId: ColumnId) => {
      e.preventDefault();
      setResizingColumn(columnId);
      resizeStartX.current = e.clientX;
      const currentWidth = columnWidths[columnId] || DEFAULT_COLUMN_WIDTH;
      resizeStartWidth.current = currentWidth;
    },
    [columnWidths, DEFAULT_COLUMN_WIDTH],
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingColumn) return;

      const deltaX = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, resizeStartWidth.current + deltaX));

      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    },
    [resizingColumn, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH],
  );

  const handleResizeEnd = useCallback(() => {
    if (resizingColumn) {
      // Save the new width to preferences
      const updatedWidths = { ...columnWidths };
      persistColumnPreferences(columnState, columnState, customColumnTitles, updatedWidths);
      setResizingColumn(null);
    }
  }, [resizingColumn, columnWidths, columnState, customColumnTitles, persistColumnPreferences]);

  // Add global mouse event listeners for column resizing
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  // Cell expansion handlers
  const handleCellClick = useCallback((gameId: string, columnId: ColumnId, content: string, title: string) => {
    // Only show dialog for columns with potentially long content
    const expandableColumns: ColumnId[] = ["notes", "location", "opponent"];
    const isCustomColumn = columnId.startsWith("custom:");

    if (expandableColumns.includes(columnId) || isCustomColumn) {
      setExpandedCell({ gameId, columnId, content, title });
    }
  }, []);

  const handleCloseExpandedCell = useCallback(() => {
    setExpandedCell(null);
  }, []);

  const handleSyncCalendar = (gameId: string) => {
    console.log("🔄 Sync button clicked for game:", gameId);
    console.log("🔄 Mutation pending:", syncGameMutation.isPending);

    // Check if calendar is connected
    if (!isCalendarConnected) {
      router.push("/dashboard/gsync");
      return;
    }

    trackEvent("Calendar Sync Individual Game", {
      source: "games_table",
      action: "sync_to_calendar",
      game_id: gameId,
    });
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
      // OPTIMISTIC UPDATE: Add new game to cache immediately
      const newGame = data.data;

      queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
        if (!oldData) return oldData;

        if (Array.isArray(oldData)) {
          return [...oldData, newGame];
        } else if (oldData.data && Array.isArray(oldData.data.games)) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              games: [...oldData.data.games, newGame],
              pagination: oldData.data.pagination
                ? {
                    ...oldData.data.pagination,
                    total: oldData.data.pagination.total + 1,
                  }
                : oldData.data.pagination,
            },
          };
        }

        return oldData;
      });
      // Invalidate calendar widget
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-games"] });

      // NO REFETCH - data already updated!
      resetNewGameData();

      const newGameId = newGame.id;

      // Track this newly created game to preserve it from sort/filter
      setPreservedGameIds((prev) => new Set(prev).add(newGameId));

      // Only sync to calendar if not explicitly skipped (e.g., during duplicate)
      if (!variables.skipCalendarSync) {
        syncGameMutation.mutate(newGameId);
      }
    },
  });

  // --- Helper function to update the cache data structure ---
  const updateGameCache = (oldData: any, id: string, data: any): any => {
    if (!oldData) return oldData;

    let gameList: Game[] | undefined;
    let originalStructure: "array" | "wrapped" | "nested" = "array";

    // Determine the structure of the cached data and extract the game list
    if (Array.isArray(oldData)) {
      gameList = oldData;
      originalStructure = "array";
    } else if (oldData.data && Array.isArray(oldData.data.games)) {
      gameList = oldData.data.games;
      originalStructure = "nested";
    } else if (oldData.games && Array.isArray(oldData.games)) {
      gameList = oldData.games;
      originalStructure = "wrapped";
    } else {
      return oldData;
    }

    if (!gameList) return oldData;

    const gameToUpdate = gameList.find((g) => g.id === id);

    if (!gameToUpdate) {
      return oldData;
    }

    // 1. Perform the DEEP MERGE for the optimistic state
    const optimisticGame = {
      ...gameToUpdate,
      ...data,
      customData: {
        ...(gameToUpdate.customData || {}),
        ...(data.customData || {}),
      },
    };

    // 2. Create the new, updated game list
    const updatedGameList = gameList.map((g) => (g.id === id ? optimisticGame : g));

    // 3. Restore the original query data structure
    if (originalStructure === "array") return updatedGameList;
    if (originalStructure === "nested") return { ...oldData, data: { ...oldData.data, games: updatedGameList } };
    if (originalStructure === "wrapped") return { ...oldData, games: updatedGameList };

    return oldData;
  };

  const updateGameMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Use your required transformation logic here (e.g., merging time into date)
      const finalData = { ...data };

      if (!finalData || (Object.keys(finalData).length === 0 && (!finalData.customData || Object.keys(finalData.customData).length === 0))) {
        throw new Error("Cannot update game with empty data");
      }

      const res = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update game");
      }
      return res.json();
    },

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["games"] });

      const previousGames = queryClient.getQueriesData({ queryKey: ["games"] });

      // CRITICAL FIX: Use setQueriesData to target all cached table views
      queryClient.setQueriesData({ queryKey: ["games"] }, (oldData: any) => updateGameCache(oldData, id, data));

      return { previousGames };
    },

    onError: (error, variables, context: any) => {
      if (context?.previousGames) {
        // FIX: Explicitly access queryKey and data to avoid 'cannot find name' error
        context.previousGames.forEach((previousQuery: { queryKey: any; data: any }) => {
          queryClient.setQueryData(previousQuery.queryKey, previousQuery.data);
        });
      }

      // Add your notification/save status error handling here
      addNotification(`Failed to save game: ${error.message}`, "error");
      setSaveStatus("error");
    },

    onSuccess: (updatedGame, variables) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-games"] });

      // Add your save status and sync logic here
      setSaveStatus("saved");
      if (variables.id) {
        syncGameMutation.mutate(variables.id);
      }
    },

    onSettled: () => {
      // CRITICAL FIX: Reset the local Zustand state ONLY after mutation lifecycle is complete
      resetEditingState();

      // Add your saveStatus timeout logic here
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
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
    onMutate: async (gameId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: GAMES_QUERY_KEY });

      // Snapshot the previous value
      const previousGames = queryClient.getQueryData(GAMES_QUERY_KEY);

      // OPTIMISTIC UPDATE: Remove the game immediately
      queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
        if (!oldData) return oldData;

        if (Array.isArray(oldData)) {
          return oldData.filter((g: Game) => g.id !== gameId);
        } else if (oldData.data && Array.isArray(oldData.data.games)) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              games: oldData.data.games.filter((g: Game) => g.id !== gameId),
              pagination: oldData.data.pagination
                ? {
                    ...oldData.data.pagination,
                    total: oldData.data.pagination.total - 1,
                  }
                : oldData.data.pagination,
            },
          };
        }

        return oldData;
      });

      return { previousGames };
    },
    onError: (error: any, gameId, context: any) => {
      // ROLLBACK: Restore previous state on error
      if (context?.previousGames) {
        queryClient.setQueryData(GAMES_QUERY_KEY, context.previousGames);
      }
      addNotification(error?.message || "Failed to delete game", "error");
    },
    onSuccess: (data: any, gameId: string) => {
      // NO REFETCH - data already updated!

      // Clear stale state for the deleted game
      if (inlineEditState?.gameId === gameId) {
        setInlineEditState(null);
        setInlineEditValue("");
        setInlineEditError(null);
        setIsInlineSaving(false);
      }

      if (editingGameId === gameId) {
        resetEditingState();
        setEditingGameData(null);
      }

      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-games"] });

      // Clear pending changes for this game
      pendingChangesRef.current.delete(gameId);
      const timeout = saveTimeoutRef.current.get(gameId);
      if (timeout) {
        clearTimeout(timeout);
        saveTimeoutRef.current.delete(gameId);
      }
      const controller = abortControllersRef.current.get(gameId);
      if (controller) {
        controller.abort();
        abortControllersRef.current.delete(gameId);
      }
      savingGamesRef.current.delete(gameId);

      // Remove from selections if selected
      if (selectedGames.has(gameId)) {
        const newSelected = selectedGameIds.filter((id) => id !== gameId);
        setSelectedGameIds(newSelected);
      }

      addNotification("Game deleted successfully", "success");

      const calendarAttempted = data?.calendar?.attempted === true;
      const calendarSucceeded = data?.calendar?.succeeded === true;

      if (calendarAttempted && !calendarSucceeded) {
        addNotification("The linked Google Calendar event could not be removed.", "warning");
      }
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
    onMutate: async (gameIds: string[]) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: GAMES_QUERY_KEY });

      // Snapshot the previous value
      const previousGames = queryClient.getQueryData(GAMES_QUERY_KEY);

      // OPTIMISTIC UPDATE: Remove all games immediately
      const gameIdsSet = new Set(gameIds);
      queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
        if (!oldData) return oldData;

        if (Array.isArray(oldData)) {
          return oldData.filter((g: Game) => !gameIdsSet.has(g.id));
        } else if (oldData.data && Array.isArray(oldData.data.games)) {
          const filteredGames = oldData.data.games.filter((g: Game) => !gameIdsSet.has(g.id));
          return {
            ...oldData,
            data: {
              ...oldData.data,
              games: filteredGames,
              pagination: oldData.data.pagination
                ? {
                    ...oldData.data.pagination,
                    total: oldData.data.pagination.total - gameIds.length,
                  }
                : oldData.data.pagination,
            },
          };
        }

        return oldData;
      });

      return { previousGames };
    },
    onError: (error: any, gameIds, context: any) => {
      // ROLLBACK: Restore previous state on error
      if (context?.previousGames) {
        queryClient.setQueryData(GAMES_QUERY_KEY, context.previousGames);
      }
      addNotification(error?.message || "Failed to delete selected games", "error");
    },
    onSuccess: (data: any, gameIds: string[]) => {
      // NO REFETCH - data already updated!
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-games"] });

      // Clear all stale state to prevent UI inconsistencies
      clearSelectedGameIds();

      // Clear inline editing state
      setInlineEditState(null);
      setInlineEditValue("");
      setInlineEditError(null);
      setIsInlineSaving(false);

      // Clear full row editing state
      resetEditingState();
      setEditingGameData(null);

      // Clear pending autosave changes for deleted games
      gameIds.forEach((gameId) => {
        pendingChangesRef.current.delete(gameId);
        const timeout = saveTimeoutRef.current.get(gameId);
        if (timeout) {
          clearTimeout(timeout);
          saveTimeoutRef.current.delete(gameId);
        }
        const controller = abortControllersRef.current.get(gameId);
        if (controller) {
          controller.abort();
          abortControllersRef.current.delete(gameId);
        }
        savingGamesRef.current.delete(gameId);
      });

      // Reset save status
      setSaveStatus("idle");

      const deletedCount = data?.data?.deletedCount ?? gameIds.length;
      addNotification(`Deleted ${deletedCount} game${deletedCount === 1 ? "" : "s"}`, "success");

      const calendarFailures = data?.data?.calendar?.failed ?? 0;
      if (calendarFailures > 0) {
        addNotification(`${calendarFailures} Google Calendar event${calendarFailures === 1 ? "" : "s"} could not be removed.`, "warning");
      }
    },
  });

  // Track original value to prevent unnecessary saves
  const originalInlineValueRef = useRef<string>("");

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
      } else if (field.startsWith("imported:")) {
        const columnName = field.replace("imported:", "");
        const customFields = (game.customFields as Record<string, any>) || {};
        currentValue = customFields[columnName] || "";
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
            // Time field no longer supports inline editing - use modal instead
            return;
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
      originalInlineValueRef.current = currentValue; // Store original value
      setInlineEditError(null);
      setSaveStatus("idle");
    },
    [editingGameId],
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
          } else if (field.startsWith("imported:")) {
            const columnName = field.replace("imported:", "");
            // For imported columns, update customFields
            updateData.customFields = {
              ...(game.customFields || {}),
              [columnName]: value.slice(0, MAX_CHAR_LIMIT),
            };

            // CRITICAL FIX: If this imported column maps to date, also update main date field
            // This mirrors what the backend does in the API
            const columnMapping = columnPreferencesData?.columnMapping as Record<string, string> | undefined;
            if (columnMapping && columnMapping[columnName] === "date") {
              try {
                updateData.date = dateStringToUTCISOString(value);
                console.log("📅 Optimistic update: Also updating main date field to:", updateData.date);
              } catch (error) {
                console.warn("📅 Failed to parse date for optimistic update:", error);
              }
            }
          }
        }

        // Validate that updateData is not empty
        if (!updateData || Object.keys(updateData).length === 0) {
          console.warn(`Skipping empty update for game ${gameId}`);
          pendingChangesRef.current.delete(gameId);
          return;
        }

        // OPTIMISTIC UPDATE: Update the cache immediately without refetching
        const previousGames = queryClient.getQueryData<any>(GAMES_QUERY_KEY);

        queryClient.setQueryData(GAMES_QUERY_KEY, (oldData: any) => {
          if (!oldData) return oldData;

          // Handle the correct paginated response structure: { data: { games: [...] } }
          if (oldData.data && Array.isArray(oldData.data.games)) {
            return {
              ...oldData,
              data: {
                ...oldData.data,
                games: oldData.data.games.map((g: Game) => {
                  if (g.id === gameId) {
                    const optimisticGame = { ...g, ...updateData };

                    if (updateData.customFields) {
                      optimisticGame.customFields = {
                        ...(g.customFields || {}),
                        ...updateData.customFields,
                      };
                    }

                    if (updateData.customData) {
                      optimisticGame.customData = {
                        ...(g.customData || {}),
                        ...updateData.customData,
                      };
                    }

                    return optimisticGame;
                  }
                  return g;
                }),
              },
            };
          } else if (Array.isArray(oldData)) {
            return oldData.map((g: Game) => {
              if (g.id === gameId) {
                const optimisticGame = { ...g, ...updateData };

                if (updateData.customFields) {
                  optimisticGame.customFields = {
                    ...(g.customFields || {}),
                    ...updateData.customFields,
                  };
                }

                if (updateData.customData) {
                  optimisticGame.customData = {
                    ...(g.customData || {}),
                    ...updateData.customData,
                  };
                }

                return optimisticGame;
              }
              return g;
            });
          }

          return oldData;
        });

        const res = await fetch(`/api/games/${gameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
          signal: abortController.signal,
        });

        if (!res.ok) {
          // ROLLBACK: Restore previous data on error
          queryClient.setQueryData(GAMES_QUERY_KEY, previousGames);
          const error = await res.json();
          throw new Error(error.error || "Failed to update game");
        }

        // NO REFETCH - the cache is already updated optimistically!

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
        latestDatePickerValueRef.current = null;
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
    [queryClient, syncGameMutation, addNotification, MAX_CHAR_LIMIT],
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

      // Schedule save with debounce (or immediate if specified)
      const delay = immediate ? 0 : 45000; // 45 seconds debounce - data persists so no need to rush auto-save
      const timeoutId = setTimeout(() => {
        // Get the latest game data from ref to avoid stale closures
        const latestGame = gamesRef.current.find((g: Game) => g.id === gameId);
        const game = latestGame || gameData; // Fallback to the passed data if not found
        executeBatchedSave(gameId, game);
        saveTimeoutRef.current.delete(gameId);
      }, delay);

      saveTimeoutRef.current.set(gameId, timeoutId);
    },
    [executeBatchedSave],
  );

  const handleInlineKeyDown = useCallback(
    (e: React.KeyboardEvent, game: Game) => {
      if (!inlineEditState) return;

      if (e.key === "Enter" && inlineEditState.field !== "notes") {
        // Save immediately on Enter (except for notes textarea)
        e.preventDefault();

        // Only save if value has actually changed
        if (inlineEditValue !== originalInlineValueRef.current) {
          scheduleAutosave(game.id, inlineEditState.field, inlineEditValue, game, true);
        } else {
          // No changes, just exit edit mode quietly
          setInlineEditState(null);
          setInlineEditValue("");
          setSaveStatus("idle");
        }
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
        latestDatePickerValueRef.current = null;
      }
    },
    [inlineEditState, inlineEditValue, scheduleAutosave],
  );

  const handleInlineBlur = useCallback(
    (game: Game) => {
      if (!inlineEditState) return;

      // For date fields, check the ref value to avoid race condition with DatePicker onChange
      const valueToSave = inlineEditState.field === "date" && latestDatePickerValueRef.current ? latestDatePickerValueRef.current : inlineEditValue;

      // Only save if value has actually changed
      if (valueToSave !== originalInlineValueRef.current) {
        // Save immediately on blur
        scheduleAutosave(game.id, inlineEditState.field, valueToSave, game, true);
      } else {
        // No changes, just exit edit mode quietly
        setInlineEditState(null);
        setInlineEditValue("");
        setSaveStatus("idle");
      }

      // Clear the date picker ref after handling blur
      latestDatePickerValueRef.current = null;
    },
    [inlineEditState, inlineEditValue, scheduleAutosave],
  );

  // Trigger autosave as user types (debounced)
  const handleInlineChange = useCallback(
    (value: string, game: Game) => {
      if (!inlineEditState) return;
      const tempUpdateData: any = {};

      // Update UI immediately (optimistic update)
      handleInlineValueChange(value);

      // Schedule batched save with debounce
      scheduleAutosave(game.id, inlineEditState.field, value, game, false);
    },
    [inlineEditState, handleInlineValueChange, scheduleAutosave],
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

  // Clear selections when games array becomes empty (safety net for edge cases)
  useEffect(() => {
    if (games.length === 0 && selectedGameIds.length > 0) {
      clearSelectedGameIds();
    }
  }, [games.length, selectedGameIds.length, clearSelectedGameIds]);

  // Clear selections whenever the active workbook changes so game IDs from
  // one worksheet don't pollute another.  selectedWorkbookId is included in
  // the query key, so the games list is already re-fetched at this point.
  useEffect(() => {
    clearSelectedGameIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkbookId]);

  // Auto-populate time based on pattern detection when sport and level are selected
  useEffect(() => {
    // Only run if:
    // 1. AI Scheduler is enabled
    // 2. User is adding a new game
    // 3. Sport and level are selected
    // 4. Time is not already set
    // 5. There are existing games to analyze
    if (!aiSchedulerEnabled || !isAddingNew || !newGameData.sport || !newGameData.level || newGameData.time || !games || games.length === 0) {
      return;
    }

    // Detect pattern and auto-populate time
    const detectPattern = async () => {
      try {
        const res = await fetch("/api/games/detect-time-pattern", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sport: newGameData.sport,
            level: newGameData.level,
            date: newGameData.date || new Date().toISOString().split("T")[0],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.pattern?.predictedTime && data.pattern.confidence > 0.5) {
            // Auto-populate the time field
            updateNewGameData({ time: data.pattern.predictedTime });

            // Show a subtle notification about the auto-populated time
            addNotification(`Time auto-populated based on pattern: ${data.pattern.pattern}`, "info");
          }
        }
      } catch (error) {
        console.error("Error detecting pattern:", error);
        // Fail silently - pattern detection is a nice-to-have feature
      }
    };

    detectPattern();
  }, [aiSchedulerEnabled, isAddingNew, newGameData.sport, newGameData.level, games, newGameData.time, updateNewGameData, addNotification]);

  // Check for conflicts when sport, level, date, or time changes
  useEffect(() => {
    // Only run if:
    // 1. User is adding a new game
    // 2. Sport, level, date, and time are all set
    // 3. Not already checking conflicts
    if (!isAddingNew || !newGameData.sport || !newGameData.level || !newGameData.date || !newGameData.time || isCheckingConflicts) {
      return;
    }

    // Check for conflicts
    const checkConflicts = async () => {
      setIsCheckingConflicts(true);
      try {
        const res = await fetch("/api/games/detect-conflicts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sport: newGameData.sport,
            level: newGameData.level,
            date: newGameData.date,
            time: newGameData.time,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.hasConflict && data.conflicts.length > 0) {
            // Show conflict modal
            setConflictModal({
              open: true,
              conflicts: data.conflicts,
              suggestedTimes: data.suggestedTimes || [],
            });
          }
        }
      } catch (error) {
        console.error("Error checking conflicts:", error);
        // Fail silently
      } finally {
        setIsCheckingConflicts(false);
      }
    };

    // Debounce the conflict check to avoid too many API calls
    const timeoutId = setTimeout(checkConflicts, 500);
    return () => clearTimeout(timeoutId);
  }, [isAddingNew, newGameData.sport, newGameData.level, newGameData.date, newGameData.time, isCheckingConflicts]);

  const handleNewGame = async () => {
    trackEvent("Create Game Clicked", {
      source: "games_table",
      action: "create_game_button",
    });
    setIsAddingNew(true);
    setEditingGameId(null);
    setEditingGameData(null);
  };

  const toggleToolbarMenu = (visible: boolean) => {
    setToolbarMenuVisible(visible);
    if (typeof window !== "undefined") {
      localStorage.setItem("gamesTableToolbarVisible", String(visible));
    }
  };

  const handleFindAvailableDates = () => {
    trackEvent("Find Available Dates Clicked", {
      source: "games_table",
      action: "find_dates_button",
    });
    setAvailableDatesModalOpen(true);
  };

  const handleDateSelect = (date: Date, sport?: string, level?: string) => {
    // Pre-fill the date when user selects from available dates
    const dateStr = date.toISOString().split("T")[0];

    // Build the update object with date and any sport/level context from the search
    const updateData: Partial<NewGameData> = { date: dateStr };

    // If sport and level were part of the search context, use them
    if (sport) {
      updateData.sport = sport;
    } else if (newGameData.sport) {
      // Fallback to existing form data if no search context
      updateData.sport = newGameData.sport;
    }

    if (level) {
      updateData.level = level;
    } else if (newGameData.level) {
      // Fallback to existing form data if no search context
      updateData.level = newGameData.level;
    }

    // Update the form with the selected date and sport/level
    updateNewGameData(updateData);

    // Open the new game row
    setIsAddingNew(true);
    setEditingGameId(null);
    setEditingGameData(null);

    // Show success notification
    let message = `Date selected: ${format(date, "EEEE, MMM d, yyyy")}.`;
    if (sport || level) {
      message += ` Creating ${sport || "game"}${level ? ` (${level})` : ""}.`;
    }
    message += ` Continue filling in game details.`;

    addNotification(message, "success");
  };

  const handleExport = useCallback(() => {
    // Export selected games if any are selected, otherwise export all games
    const gamesToExport = selectedGames.size > 0 ? games.filter((game: Game) => selectedGames.has(game.id)) : games;

    if (gamesToExport.length === 0) {
      addNotification("No games to export", "warning");
      return;
    }

    trackEvent("Export Games", {
      source: "games_table",
      games_count: gamesToExport.length,
      visible_columns_count: visibleColumnIds.length,
      custom_columns_count: customColumns.length,
      is_partial_selection: selectedGames.size > 0 && selectedGames.size < games.length,
      is_select_all: selectedGames.size === games.length && games.length > 0,
    });

    ExportService.exportGames(gamesToExport, customColumns, visibleColumnIds);
  }, [games, customColumns, visibleColumnIds, addNotification, selectedGames]);

  const handleImportClick = useCallback(() => {
    trackEvent("Import Games Clicked", {
      source: "games_table",
      action: "import_button",
    });
    // Show worksheet choice first — new worksheet is the default
    setShowImportChoiceDialog(true);
  }, []);

  // Called from the choice dialog when user picks "Add to current worksheet"
  const handleImportMerge = useCallback(() => {
    setShowImportChoiceDialog(false);
    setShowImportDialog(true);
  }, []);

  const handleViewImportNew = useCallback(async (closeChoiceDialog = false) => {
    if (closeChoiceDialog) setShowImportChoiceDialog(false);
    if (planLimits && workbooks.length >= planLimits.worksheetLimit) {
      addNotification(`You have reached the limit of ${planLimits.worksheetLimit} isolated spreadsheets for your plan. Please upgrade to create more.`, "warning");
      return;
    }
    try {
      const currentLength = useGamesWorkbookStore.getState().workbooks.length;
      const tempName = `Spreadsheet${currentLength + 1}`;
      const res = await fetch("/api/games-workbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tempName }),
      });
      if (!res.ok) throw new Error("Failed to create workbook");
      const data = await res.json();
      // Only set the import workbook ID and open dialog — the query invalidation
      // in handleImportComplete will sync the store via the useEffect
      setViewImportWorkbookId(data.data.id);
      setShowImportDialog(true);
    } catch (error: any) {
      addNotification(error.message || "Failed to create workbook", "error");
    }
  }, [addNotification]);

  const handleViewSelectWorkbook = useCallback(
    (id: string) => {
      // Clear selections and filters before switching worksheets so IDs and
      // active filter conditions from the old worksheet don't bleed into the new one.
      clearSelectedGameIds();
      clearColumnFilters();
      useGamesWorkbookStore.setState({ selectedWorkbookId: id });
      setWorksheetTab("worksheet");
    },
    [clearSelectedGameIds, clearColumnFilters],
  );

  const handleViewRenameWorkbook = useCallback(
    (id: string, name: string) => {
      updateWorkbookMutation.mutate({ id, name });
    },
    [updateWorkbookMutation],
  );

  const handleViewDeleteWorkbook = useCallback(
    (id: string) => {
      // Show spinner on the card being deleted
      setDeletingWorkbookId(id);
      // Only delete on server and invalidate — the useEffect will clean up the store
      // Do NOT also call deleteWorkbook() — that causes a double store update → crash
      fetch(`/api/games-workbooks/${id}`, { method: "DELETE" })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["gamesWorkbooks"] });
          // Also invalidate games so deleted records disappear immediately
          queryClient.invalidateQueries({ queryKey: ["games"] });
          // Remove the stale per-workbook column preferences from the cache
          queryClient.removeQueries({ queryKey: ["tablePreferences", `games-${id}`] });
        })
        .finally(() => {
          setDeletingWorkbookId(null);
        });
    },
    [queryClient],
  );

  const handleImportComplete = useCallback(
    (result: any) => {
      setShowImportDialog(false);

      trackEvent("Import Games Complete", {
        source: "games_table",
        success_count: result.success,
        failed_count: result.failed,
        total_count: result.success + result.failed,
        has_errors: result.failed > 0,
      });

      // Show different message for duplicate/failed imports vs successful imports
      let message: string;
      if (result.success === 0 && result.failed > 0) {
        message = `Import Warning! 0 games imported, ${result.failed} duplicated games found, failed!`;
      } else {
        message = `Import complete! ${result.success} games imported successfully${result.failed > 0 ? `, ${result.failed} failed` : ""}. You have 30 seconds to undo.`;
      }

      addNotification(message, result.failed > 0 ? "warning" : "success");

      // Set up undo functionality if games were successfully imported
      if (result.success > 0 && result.createdGameIds && result.createdGameIds.length > 0) {
        useImportUndoStore.getState().setImportedGames(result.createdGameIds);
        // Clear delete undo state since import has happened
        useDeleteUndoStore.getState().clearDelete();
      }

      // CRITICAL STEP: Set the flag to permanently use the custom column structure.
      // This is what prevents default columns from reappearing.
      if (result.success > 0) {
        setIsCustomStructureActive(true);
        // Clear any stale column filters so the freshly imported games are
        // immediately visible.  Filters persist in localStorage across sessions
        // and an active filter (e.g. date "is empty") would hide all results.
        clearColumnFilters();
      }

      // If import was for a specific workbook (from View), rename workbook to filename
      if (viewImportWorkbookId && result.fileName && result.success > 0) {
        const nameWithoutExt = result.fileName.replace(/\.[^/.]+$/, "").slice(0, 22);
        // Rename via API (the query invalidation below will sync the store)
        fetch(`/api/games-workbooks/${viewImportWorkbookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nameWithoutExt }),
        }).catch(() => {}); // Non-critical, name will stay as temp name
        // Select this workbook and switch to table view
        useGamesWorkbookStore.setState({ selectedWorkbookId: viewImportWorkbookId });
        setWorksheetTab("worksheet");
        setViewImportWorkbookId(null);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["customColumns"] });
      queryClient.invalidateQueries({ queryKey: ["tablePreferences", activePreferencesKey] });
      queryClient.invalidateQueries({ queryKey: ["importedColumns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-games"] });
      queryClient.invalidateQueries({ queryKey: ["gamesWorkbooks"] });

      // ALSO TRY: Force a refetch instead of just invalidate
      queryClient.refetchQueries({ queryKey: ["games"] });
      queryClient.refetchQueries({ queryKey: ["tablePreferences", activePreferencesKey] });
      queryClient.refetchQueries({ queryKey: ["dashboard-upcoming-games"] });
    },
    [queryClient, addNotification, setIsCustomStructureActive, activePreferencesKey, viewImportWorkbookId, clearColumnFilters],
  );

  const handleSaveNewGame = async () => {
    console.log("🎾 newGameData:", newGameData);
    console.log("🎾 customFields:", newGameData.customFields);
    if (!isAddingNew) {
      addNotification("Not in create mode", "error");
      return;
    }
    // Check if we're dealing with imported data (has customFields with data)
    const hasImportedData = newGameData.customFields && Object.keys(newGameData.customFields).length > 0;
    console.log("🎾 hasImportedData:", hasImportedData);
    if (hasImportedData) {
      // For imported data, just validate that we have some essential data
      if (!newGameData.date) {
        addNotification("Date is required. Please enter a valid date.", "error");
        return;
      }

      // Create a basic team/sport setup or use a default
      const defaultSport = "Imported Game";
      const defaultLevel = "VARSITY";

      // Find or create a generic team for imported games
      let matchingTeam = teams.find((team: any) => team.sport?.name === defaultSport && team.level === defaultLevel);
      if (!matchingTeam) {
        try {
          // Create default sport and team for imported games
          const sportRes = await fetch("/api/sports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: defaultSport, season: "FALL" }),
          });
          let sportData;
          if (sportRes.ok) {
            sportData = await sportRes.json();
          } else {
            const existingSportRes = await fetch(`/api/sports?name=${encodeURIComponent(defaultSport)}`);
            if (existingSportRes.ok) {
              sportData = await existingSportRes.json();
            } else {
              throw new Error("Failed to create or find default sport");
            }
          }
          const sportId = sportData.data?.id || sportData.id;
          const teamRes = await fetch("/api/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${defaultSport} ${defaultLevel}`,
              sportId,
              level: defaultLevel,
            }),
          });
          if (!teamRes.ok) {
            const error = await teamRes.json();
            throw new Error(error.error || "Failed to create default team");
          }
          const teamData = await teamRes.json();
          matchingTeam = teamData.data;
          queryClient.invalidateQueries({ queryKey: ["teams"] });
        } catch (error: any) {
          addNotification(error.message || "Failed to create default team", "error");
          return;
        }
      }

      // Safeguard: Ensure matchingTeam and id exist
      if (!matchingTeam || !matchingTeam.id) {
        addNotification("Failed to find or create default team. Please try again.", "error");
        return;
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
        opponentId: null, // No opponent needed for imported data
        venueId: newGameData.venueId || null,
        status: newGameData.status || "SCHEDULED",
        notes: newGameData.notes || null,
        location: newGameData.location || null,
        customData: newGameData.customData || {},
        customFields: newGameData.customFields || {}, // This contains all the imported data
        workbookId: selectedWorkbookId || null,
      };
      console.log("🚀 Creating imported game with data:", gameData);
      createGameMutation.mutate({ gameData });
      return;
    }
    // Original validation logic for standard fields (when not imported data)
    const trimmedSport = newGameData.sport?.trim();
    const trimmedLevel = newGameData.level?.trim();
    const trimmedStatus = newGameData.status?.trim();
    if (!newGameData.date) {
      addNotification("Date is required. Please enter a valid date.", "error");
      return;
    }
    if (!trimmedSport) {
      addNotification("Sport is required. Please select a sport.", "error");
      return;
    }
    if (!trimmedLevel) {
      addNotification("Level is required. Please select a level.", "error");
      return;
    }
    if (!trimmedStatus) {
      addNotification("Status is required. Please select a status (Confirmed).", "error");
      return;
    }
    let matchingTeam = teams.find((team: any) => team.sport?.name === trimmedSport && team.level === trimmedLevel);
    if (!matchingTeam) {
      try {
        const sportRes = await fetch("/api/sports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedSport, season: "FALL" }),
        });
        let sportData;
        if (sportRes.ok) {
          sportData = await sportRes.json();
        } else {
          const existingSportRes = await fetch(`/api/sports?name=${encodeURIComponent(trimmedSport)}`);
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
            name: `${trimmedSport} ${trimmedLevel}`,
            sportId,
            level: trimmedLevel,
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

    // Safeguard: Ensure matchingTeam and id exist
    if (!matchingTeam || !matchingTeam.id) {
      addNotification("Failed to find or create team. Please try again.", "error");
      return;
    }

    // Handle opponent - create if new (similar to edit mode)
    let opponentId = newGameData.opponentId || null;
    if (newGameData.opponent && newGameData.opponent.trim()) {
      const opponentName = newGameData.opponent.trim();
      const existingOpponent = opponents.find((opp: any) => opp.name.toLowerCase() === opponentName.toLowerCase());
      if (existingOpponent) {
        opponentId = existingOpponent.id;
      } else {
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
          queryClient.invalidateQueries({ queryKey: ["opponents"] });
        } catch (createError: any) {
          addNotification(`Error creating opponent: ${createError.message}`, "error");
          return; // Abort save if opponent creation fails
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
      opponentId,
      venueId: newGameData.venueId || null,
      status: newGameData.status || "SCHEDULED",
      notes: newGameData.notes || null,
      location: newGameData.location || null,
      customData: newGameData.customData || {},
      customFields: newGameData.customFields || {}, // This contains all the imported data
      workbookId: selectedWorkbookId || null,
    };
    console.log("🚀 Creating game with data:", gameData);
    createGameMutation.mutate({ gameData });
    return;
  };

  const handleCustomFieldChange = useCallback(
    (columnId: string, value: string) => {
      // Enforce character limit
      const limitedValue = value.slice(0, MAX_CHAR_LIMIT);
      updateEditingCustomData(columnId, limitedValue);
    },
    [MAX_CHAR_LIMIT, updateEditingCustomData],
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

    // Validate required fields and provide specific error messages
    if (!editingGameData.date) {
      addNotification("Date is required. Please enter a valid date.", "error");
      return;
    }

    const sportName = editingGameData.homeTeam.sport.name;
    const level = editingGameData.homeTeam.level;

    if (!sportName) {
      addNotification("Sport is required. Please select a sport.", "error");
      return;
    }

    if (!level) {
      addNotification("Level is required. Please select a level.", "error");
      return;
    }

    if (!editingGameData.status) {
      addNotification("Status is required. Please select a status (Confirmed).", "error");
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
      // Capture game data before deletion for undo functionality
      const homeTeamId = game.homeTeamId || game.homeTeam.id;
      if (!homeTeamId) {
        addNotification("Cannot delete game: invalid team data", "error");
        return;
      }

      const gameData = {
        date: dateStringToUTCISOString(game.date),
        time: game.time || null,
        homeTeamId: homeTeamId,
        isHome: game.isHome,
        busTravel: game.busTravel,
        actualDepartureTime: game.actualDepartureTime || null,
        actualArrivalTime: game.actualArrivalTime || null,
        opponentId: game.opponentId || game.opponent?.id || null,
        venueId: game.venueId || game.venue?.id || null,
        status: game.status as GameStatus,
        notes: game.notes || null,
        location: game.location || null,
        customData: game.customData || {},
        customFields: game.customFields || {},
        sortOrder: game.sortOrder,
      };

      // Store game data in undo store
      useDeleteUndoStore.getState().setDeletedGames([gameData]);

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
        // Keep duplicate in the same worksheet as the original; fall back to active sheet
        workbookId: game.workbookId || selectedWorkbookId || null,
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
        },
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
      // Capture game data before deletion for undo functionality
      type DeletedGameData = {
        date: string;
        time: string | null;
        homeTeamId: string;
        isHome: boolean;
        busTravel: boolean;
        actualDepartureTime: string | null;
        actualArrivalTime: string | null;
        opponentId: string | null;
        venueId: string | null;
        status: GameStatus;
        notes: string | null;
        location: string | null;
        customData: any;
        customFields?: Record<string, any>;
        sortOrder?: number;
      };

      const gamesData = selectedGameDetails
        .map((game: Game): DeletedGameData | null => {
          const homeTeamId = game.homeTeamId || game.homeTeam.id;
          if (!homeTeamId) return null;

          return {
            date: dateStringToUTCISOString(game.date),
            time: game.time || null,
            homeTeamId: homeTeamId,
            isHome: game.isHome,
            busTravel: game.busTravel,
            actualDepartureTime: game.actualDepartureTime || null,
            actualArrivalTime: game.actualArrivalTime || null,
            opponentId: game.opponentId || game.opponent?.id || null,
            venueId: game.venueId || game.venue?.id || null,
            status: game.status as GameStatus,
            notes: game.notes || null,
            location: game.location || null,
            customData: game.customData || {},
            customFields: game.customFields || {},
            sortOrder: game.sortOrder,
          };
        })
        .filter((game: DeletedGameData | null): game is DeletedGameData => game !== null);

      // Store games data in undo store (only valid games)
      useDeleteUndoStore.getState().setDeletedGames(gamesData);

      // Clear selections IMMEDIATELY to hide action buttons
      clearSelectedGameIds();

      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleSaveDismissDepartTimes = async (dismissTime: string, departTime: string) => {
    if (!dismissDepartModal) return;

    const { gameId, columnName } = dismissDepartModal;
    const game = games.find((g: Game) => g.id === gameId);
    if (!game) return;

    try {
      // Save dismiss and depart times in customFields
      const customFields = (game.customFields as Record<string, any>) || {};
      const updatedCustomFields = {
        ...customFields,
        [`${columnName}_dismiss`]: dismissTime,
        [`${columnName}_depart`]: departTime,
      };

      // Update game with new custom fields
      const response = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: updatedCustomFields }),
      });

      if (!response.ok) {
        throw new Error("Failed to save bus travel times");
      }

      // Refresh games data
      await queryClient.invalidateQueries({ queryKey: ["games"] });
      addNotification("Bus travel times saved successfully", "success");
    } catch (error: any) {
      addNotification(error.message || "Failed to save bus travel times", "error");
    }
  };

  const handleSaveTravelTime = async (departureTime: string, address: string) => {
    if (!travelTimeModal) return;

    const { gameId, columnName } = travelTimeModal;

    try {
      // If columnName is provided, save to customFields for Bus Info column
      if (columnName) {
        const game = games.find((g: Game) => g.id === gameId);
        if (!game) throw new Error("Game not found");

        // Save departure time and address in customFields
        const customFields = (game.customFields as Record<string, any>) || {};
        const updatedCustomFields = {
          ...customFields,
          [`${columnName}_depart`]: departureTime,
          [`${columnName}_address`]: address,
        };

        // Update game with new custom fields
        const response = await fetch(`/api/games/${gameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customFields: updatedCustomFields }),
        });

        if (!response.ok) {
          throw new Error("Failed to save travel time");
        }

        // Refresh games data
        await queryClient.invalidateQueries({ queryKey: ["games"] });
        addNotification("Travel time saved successfully", "success");
      } else {
        // Legacy behavior: use the save-travel-time API endpoint
        const response = await fetch("/api/games/save-travel-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId,
            departureTime,
            address,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to save travel time");
        }

        const result = await response.json();

        // Refresh games and custom columns data
        await queryClient.invalidateQueries({ queryKey: ["games"] });
        await queryClient.invalidateQueries({ queryKey: ["customColumns"] });

        let message = "Travel time saved successfully";
        if (result.data?.addressColumnCreated) {
          message += ". Address column was automatically created.";
        }

        addNotification(message, "success");
      }
    } catch (error: any) {
      addNotification(error.message || "Failed to save travel time", "error");
    }
  };

  const handleSaveCost = async (cost: number) => {
    if (!costModal) return;

    const { gameId } = costModal;

    try {
      const response = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost: cost === 0 ? null : cost }),
      });

      if (!response.ok) {
        throw new Error("Failed to save cost");
      }

      // Refresh games data and cost budget data
      await queryClient.invalidateQueries({ queryKey: ["games"] });
      await queryClient.invalidateQueries({ queryKey: ["costBudgetEnabled"] });
      addNotification("Cost saved successfully", "success");
    } catch (error: any) {
      addNotification(error.message || "Failed to save cost", "error");
    }
  };

  const handleColumnFilterChange = useCallback(
    (columnId: string, filter: ColumnFilterValue | null) => {
      // Clear preserved games when user manually applies a filter
      setPreservedGameIds(new Set());
      updateFilter(columnId, filter);
      setPage(0);
    },
    [updateFilter],
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

  const handleSort = (field: SortField, event?: React.MouseEvent) => {
    setPreservedGameIds(new Set());
    setPage(0);

    if (event?.shiftKey) {
      // ── Multi-sort: Shift+click adds / cycles / removes a secondary key ──
      const idx = sortFields.findIndex((s) => s.field === field);
      if (idx === -1) {
        // Add as next sort key (asc)
        setSortFields([...sortFields, { field, order: "asc" }]);
      } else if (sortFields[idx].order === "asc") {
        // Toggle to desc
        const updated = sortFields.map((s, i) =>
          i === idx ? { ...s, order: "desc" as const } : s
        );
        setSortFields(updated);
      } else {
        // Remove this key; fall back to date asc if list becomes empty
        const updated = sortFields.filter((_, i) => i !== idx);
        setSortFields(updated.length > 0 ? updated : [{ field: "date", order: "asc" }]);
      }
    } else {
      // ── Single-sort: replace all active sorts with this field ──
      const isSoleSort = sortFields.length === 1 && sortFields[0].field === field;
      if (isSoleSort) {
        // Cycle: asc → desc → default (date asc)
        if (sortFields[0].order === "asc") {
          setSortFields([{ field, order: "desc" }]);
        } else {
          setSortFields([{ field: "date", order: "asc" }]);
        }
      } else {
        setSortFields([{ field, order: "asc" }]);
      }
    }
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

    // By default the cost column is excluded from emails so recipients never see
    // internal cost/budget data.  The user can opt-in via Settings → Cost & Budget.
    const isCostCustomColumn = (colId: string): boolean => {
      if (!colId.startsWith("custom:")) return false;
      const colIdPart = colId.substring(7);
      const col = customColumns.find((c) => c.id === colIdPart);
      return !!(col?.name && /^(cost|expenses?)$/i.test(col.name.trim()));
    };
    const emailVisibleColumns = includeCostInEmail ? visibleColumnIds : visibleColumnIds.filter((id) => !isCostCustomColumn(id));

    // Persist the exact column config from the active worksheet so ComposeEmail
    // displays the same columns/mappings the user sees here, regardless of which
    // workbook (or the default table) is currently active.
    sessionStorage.setItem("selectedGames", JSON.stringify(selectedGamesData));
    sessionStorage.setItem("gamesTableVisibleColumns", JSON.stringify(emailVisibleColumns));
    sessionStorage.setItem("gamesTableColumnMapping", JSON.stringify(columnPreferencesData?.columnMapping ?? null));
    sessionStorage.setItem("gamesTableCustomColumns", JSON.stringify(customColumns));
    sessionStorage.setItem("gamesOpponentFilter", JSON.stringify(opponentFilter || null));
    router.push("/dashboard/compose-email");
  };

  const handleBulkSync = useCallback(() => {
    trackEvent("Calendar Bulk Sync Clicked", {
      source: "games_table",
      action: "bulk_sync_to_calendar",
      selected_games_count: selectedGames.size,
    });

    if (selectedGames.size === 0) {
      addNotification("No games selected to sync", "warning");
      return;
    }

    // Check if calendar is connected
    if (!isCalendarConnected) {
      router.push("/dashboard/gsync");
      return;
    }

    // Get array of selected game IDs
    const gameIdsToSync = Array.from(selectedGames);

    // Trigger bulk sync mutation
    bulkSyncGamesMutation.mutate(gameIdsToSync);
  }, [selectedGames, bulkSyncGamesMutation, addNotification, isCalendarConnected]);

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
      if (isNaN(date.getTime())) return dateString;
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
            cellValue = resolveOpponent(game);
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
      },
    );
  }, [selectedGames, games, resolvedColumns, getColumnLabel, formatGameDate, addNotification]);

  // Time edit modal handlers
  const handleTimeClick = useCallback(
    (game: Game) => {
      // Don't open modal if in full edit mode
      if (editingGameId === game.id) return;

      const formattedDate = formatGameDate(game.date);
      setTimeEditModal({
        open: true,
        gameId: game.id,
        time: game.time || "",
        gameInfo: {
          date: formattedDate,
          opponent: game.opponent?.name,
        },
      });
    },
    [editingGameId, formatGameDate],
  );

  const handleTimeModalSave = useCallback(
    async (time: string) => {
      if (!timeEditModal) return;

      const gameId = timeEditModal.gameId;

      // Handle new game time edit
      if (gameId === "new-game") {
        updateNewGameData({ time });
        setTimeEditModal(null);
        return;
      }

      const game = games.find((g: any) => g.id === gameId);
      if (!game) return;

      // Save the time update
      scheduleAutosave(gameId, "time", time, game, true);
      setTimeEditModal(null);
    },
    [timeEditModal, games, scheduleAutosave, updateNewGameData],
  );

  const handleTimeModalClose = useCallback(() => {
    setTimeEditModal(null);
  }, []);

  // Conflict modal handlers
  const handleConflictModalClose = useCallback(() => {
    setConflictModal(null);
  }, []);

  const handleConflictSelectTime = useCallback(
    (time: string) => {
      updateNewGameData({ time });
      setConflictModal(null);
    },
    [updateNewGameData],
  );

  const handleConflictProceedAnyway = useCallback(() => {
    // Just close the modal - user wants to proceed with the conflicting time
    setConflictModal(null);
  }, []);

  // Helper to render editable column title
  const renderEditableColumnTitle = (columnId: ColumnId, defaultLabel: string, sortable: boolean = false, sortFieldValue?: SortField) => {
    const isEditing = editingColumnId === columnId;
    const displayLabel = getColumnLabel(columnId);
    const hasCustomTitle = customColumnTitles[columnId] !== undefined;

    // Protect date and actions columns from being renamed
    const isProtectedColumn = columnId === "date" || columnId === "actions";

    if (isEditing && !isProtectedColumn) {
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
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, position: "relative", group: 1 }}>
        {sortable && sortFieldValue ? (
          (() => {
            const sortIdx = sortFields.findIndex((s) => s.field === sortFieldValue);
            const isActive = sortIdx !== -1;
            const direction = isActive ? sortFields[sortIdx].order : "asc";
            return (
              <Tooltip title="Hold Shift to sort by multiple columns" placement="top" arrow>
              <TableSortLabel
                active={isActive}
                direction={direction}
                onClick={(e) => handleSort(sortFieldValue, e)}
              >
                {displayLabel.toUpperCase()}
                {sortFields.length > 1 && isActive && (
                  <Box
                    component="span"
                    sx={{
                      ml: 0.4,
                      fontSize: 9,
                      fontWeight: 700,
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      borderRadius: "50%",
                      width: 14,
                      height: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    {sortIdx + 1}
                  </Box>
                )}
              </TableSortLabel>
              </Tooltip>
            );
          })()
        ) : (
          <Typography sx={{ fontWeight: 600, fontSize: 12, color: "text.secondary" }}>{displayLabel.toUpperCase()}</Typography>
        )}
        {!isProtectedColumn && (
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
        )}
      </Box>
    );
  };

  const getColumnWidth = useCallback(
    (columnId: ColumnId) => {
      return columnWidths[columnId] || DEFAULT_COLUMN_WIDTH;
    },
    [columnWidths, DEFAULT_COLUMN_WIDTH],
  );

  const renderResizeHandle = useCallback(
    (columnId: ColumnId) => {
      return (
        <Box
          onMouseDown={(e) => handleResizeStart(e, columnId)}
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "8px",
            cursor: "col-resize",
            userSelect: "none",
            zIndex: 1,
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.1)",
            },
            "&:active": {
              backgroundColor: "rgba(0, 0, 0, 0.2)",
            },
          }}
        />
      );
    },
    [handleResizeStart],
  );

  const renderHeaderCell = (column: ResolvedColumn) => {
    const columnWidth = getColumnWidth(column.id);
    const cellSx = {
      fontWeight: 600,
      fontSize: 12,
      py: 1,
      color: "text.secondary",
      position: "relative" as const,
      width: columnWidth,
      minWidth: MIN_COLUMN_WIDTH,
      maxWidth: MAX_COLUMN_WIDTH,
    };

    switch (column.id) {
      case "date":
        return (
          <TableCell key="date" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("date", "Date", true, "date")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("date")}
          </TableCell>
        );
      case "sport":
        return (
          <TableCell key="sport" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("sport", "Sport", true, "sport")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("sport")}
          </TableCell>
        );
      case "level":
        return (
          <TableCell key="level" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("level", "Level", true, "level")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("level")}
          </TableCell>
        );
      case "opponent":
        return (
          <TableCell key="opponent" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("opponent", "Opponent", true, "opponent")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("opponent")}
          </TableCell>
        );
      case "isHome":
        return (
          <TableCell key="isHome" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("isHome", "Home/Away", true, "isHome")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("isHome")}
          </TableCell>
        );
      case "time":
        return (
          <TableCell key="time" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("time", "Time", true, "time")}
              <ColumnFilterDragDrop
                columnId="time"
                columnName={getColumnLabel("time")}
                columnType="time"
                uniqueValues={uniqueValues.time || []}
                currentFilter={columnFilters.time}
                onFilterChange={handleColumnFilterChange}
              />
              <Tooltip title="Hide column">
                <IconButton size="small" onClick={() => handleToggleColumnVisibility("time", false)} sx={{ ml: 0.5, p: 0.25 }}>
                  <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                </IconButton>
              </Tooltip>
            </Box>
            {renderResizeHandle("time")}
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("status", "Confirmed", true, "status")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("status")}
          </TableCell>
        );
      case "location":
        return (
          <TableCell key="location" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("location", "Location", true, "location")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("location")}
          </TableCell>
        );
      case "busTravel":
        return (
          <TableCell key="busTravel" sx={{ ...cellSx, whiteSpace: "nowrap" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("busTravel", "Bus Info", true, "busTravel")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("busTravel")}
          </TableCell>
        );
      case "notes":
        return (
          <TableCell key="notes" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {renderEditableColumnTitle("notes", "Notes", true, "notes")}
              <ColumnFilterDragDrop
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
            {renderResizeHandle("notes")}
          </TableCell>
        );
      case "actions":
        return (
          <TableCell key="actions" sx={cellSx}>
            <Box sx={{ display: "flex", alignItems: "center" }}>{renderEditableColumnTitle("actions", "Actions", false)}</Box>
            {renderResizeHandle("actions")}
          </TableCell>
        );
      default:
        if (column.id.startsWith("imported:")) {
          // Handle imported CSV columns
          const columnName = column.id.split(":")[1];
          const columnLabel = getColumnLabel(column.id);
          const importedColumnMapping = columnPreferencesData?.columnMapping as Record<string, string> | undefined;
          const importedColumnType = importedColumnMapping?.[columnName] === "date" ? "date" : importedColumnMapping?.[columnName] === "time" ? "time" : "text";
          return (
            <TableCell key={column.id} sx={cellSx}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {renderEditableColumnTitle(column.id, columnLabel, true, column.id)}
                <ColumnFilterDragDrop
                  columnId={column.id}
                  columnName={getColumnLabel(column.id)}
                  columnType={importedColumnType}
                  uniqueValues={uniqueValues[column.id] || []}
                  currentFilter={columnFilters[column.id]}
                  onFilterChange={handleColumnFilterChange}
                />
                <Tooltip title="Hide column">
                  <IconButton size="small" onClick={() => handleToggleColumnVisibility(column.id, false)} sx={{ ml: 0.5, p: 0.25 }}>
                    <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              {renderResizeHandle(column.id)}
            </TableCell>
          );
        }
        if (column.id.startsWith("custom:")) {
          const customColumn = column.customColumn;
          const columnLabel = customColumn?.name || getColumnLabel(column.id);

          return (
            <TableCell key={column.id} sx={cellSx}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {renderEditableColumnTitle(column.id, columnLabel, true, column.id)}
                <ColumnFilterDragDrop
                  columnId={column.id}
                  columnName={columnLabel}
                  columnType="text"
                  uniqueValues={uniqueValues[column.id] || []}
                  currentFilter={columnFilters[column.id]}
                  onFilterChange={handleColumnFilterChange}
                />
                <Tooltip title="Hide column">
                  <IconButton size="small" onClick={() => handleToggleColumnVisibility(column.id, false)} sx={{ ml: 0.5, p: 0.25 }}>
                    <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              {renderResizeHandle(column.id)}
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
          <TableCell key="date" sx={getRequiredCellSx("date")}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                value={newGameData.date ? parse(newGameData.date, "yyyy-MM-dd", new Date()) : null}
                onChange={(newValue) => {
                  if (newValue) {
                    const formattedDate = format(newValue, "yyyy-MM-dd");
                    updateNewGameData({ date: formattedDate });
                  }
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    error: isRequiredFieldEmpty("date"),
                    sx: {
                      width: 140,
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "transparent",
                        "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                        "&:hover fieldset": { borderColor: "primary.main" },
                        "&.Mui-focused fieldset": { borderColor: "primary.main" },
                      },
                    },
                    InputProps: { sx: { fontSize: 13 } },
                  },
                  popper: {
                    placement: "bottom-start",
                  },
                }}
              />
            </LocalizationProvider>
          </TableCell>
        );
      case "sport":
        return (
          <TableCell key="sport" sx={{ ...getRequiredCellSx("sport"), minWidth: 180 }}>
            <TextField
              size="small"
              value={newGameData.sport}
              onChange={(e) => {
                const sport = e.target.value;
                updateNewGameData({ sport });
                // Reset level if not valid for new sport
                const levels = getLevelsForSport(sport);
                if (newGameData.level && !levels.includes(newGameData.level)) {
                  updateNewGameData({ level: "" });
                }
              }}
              error={isRequiredFieldEmpty("sport")}
              placeholder="Enter sport..."
              sx={{
                minWidth: 140,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "transparent",
                  "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                  "&:hover fieldset": { borderColor: "primary.main" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
                "& .MuiInputBase-input": {
                  fontSize: 13,
                },
              }}
            />
          </TableCell>
        );
      case "level":
        return (
          <TableCell key="level" sx={{ ...getRequiredCellSx("level"), minWidth: 150 }}>
            <TextField
              size="small"
              value={newGameData.level}
              onChange={(e) => updateNewGameData({ level: e.target.value })}
              error={isRequiredFieldEmpty("level")}
              placeholder="Enter level (e.g., Varsity, JV)..."
              sx={{
                minWidth: 140,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "transparent",
                  "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                  "&:hover fieldset": { borderColor: "primary.main" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
                "& .MuiInputBase-input": {
                  fontSize: 13,
                },
              }}
            />
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
            <TextField
              size="small"
              value={newGameData.isHome ? "Home" : "Away"}
              onChange={(e) => updateNewGameData({ isHome: e.target.value.toLowerCase() === "home" })}
              placeholder="Home or Away..."
              sx={{
                width: 120,
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
      case "time":
        return (
          <TableCell
            key="time"
            sx={{
              py: 1,
              cursor: "pointer",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
            onClick={() => {
              setTimeEditModal({
                open: true,
                gameId: "new-game",
                time: newGameData.time || "",
                gameInfo: {
                  date: newGameData.date ? formatGameDate(newGameData.date) : "New Game",
                  opponent: newGameData.opponent,
                },
              });
            }}
          >
            <TextField
              size="small"
              value={newGameData.time ? formatTimeDisplay(newGameData.time) : "TBD"}
              placeholder="Click to set time"
              sx={{
                width: 120,
                "& .MuiInputBase-input": {
                  fontSize: 13,
                  cursor: "pointer",
                },
              }}
              InputProps={{
                readOnly: true,
                sx: { fontSize: 13 },
              }}
            />
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" sx={getRequiredCellSx("status")}>
            <TextField
              size="small"
              value={newGameData.status === "SCHEDULED" ? "Pending" : newGameData.status === "CONFIRMED" ? "Yes" : newGameData.status === "CANCELLED" ? "No" : newGameData.status}
              onChange={(e) => {
                const displayValue = e.target.value.toLowerCase();
                const statusValue =
                  displayValue.includes("pending") || displayValue.includes("scheduled")
                    ? "SCHEDULED"
                    : displayValue.includes("yes") || displayValue.includes("confirmed")
                      ? "CONFIRMED"
                      : displayValue.includes("no") || displayValue.includes("cancelled")
                        ? "CANCELLED"
                        : "SCHEDULED"; // Default to scheduled for unrecognized values
                updateNewGameData({ status: statusValue });
              }}
              error={isRequiredFieldEmpty("status")}
              placeholder="Yes, Pending, or No..."
              sx={{
                width: 110,
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
            <TextField
              size="small"
              value={newGameData.busTravel ? "Yes" : "No"}
              onChange={(e) => updateNewGameData({ busTravel: e.target.value.toLowerCase().includes("yes") })}
              placeholder="Yes or No..."
              sx={{
                width: 120,
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
              sx={{
                width: 180,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "transparent",
                  "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                  "&:hover fieldset": { borderColor: "primary.main" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
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
        if (column.id.startsWith("imported:")) {
          // Handle imported CSV columns (editable in new row form)
          const columnName = column.id.split(":")[1];
          const columnMapping = columnPreferencesData?.columnMapping as Record<string, string> | undefined;
          const mapping = columnMapping?.[columnName];

          // If this imported column is mapped to "date", render a DatePicker
          if (mapping === "date") {
            return (
              <TableCell key={column.id} sx={getRequiredCellSx("date")}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    value={newGameData.date ? parse(newGameData.date, "yyyy-MM-dd", new Date()) : null}
                    onChange={(newValue) => {
                      if (newValue) {
                        const formattedDate = format(newValue, "yyyy-MM-dd");
                        updateNewGameData({ date: formattedDate });
                      }
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        error: isRequiredFieldEmpty("date"),
                        sx: {
                          width: 140,
                          "& .MuiOutlinedInput-root": {
                            bgcolor: "transparent",
                            "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                            "&:hover fieldset": { borderColor: "primary.main" },
                            "&.Mui-focused fieldset": { borderColor: "primary.main" },
                          },
                        },
                        InputProps: { sx: { fontSize: 13 } },
                      },
                      popper: {
                        placement: "bottom-start",
                      },
                    }}
                  />
                </LocalizationProvider>
              </TableCell>
            );
          }

          // If this imported column is mapped to "time", render a TimePicker modal
          if (mapping === "time") {
            return (
              <TableCell
                key={column.id}
                sx={{
                  py: 1,
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
                onClick={() => {
                  setTimeEditModal({
                    open: true,
                    gameId: "new-game",
                    time: newGameData.time || "",
                    gameInfo: {
                      date: newGameData.date ? formatGameDate(newGameData.date) : "New Game",
                      opponent: newGameData.opponent,
                    },
                  });
                }}
              >
                <TextField
                  size="small"
                  value={newGameData.time ? formatTimeDisplay(newGameData.time) : "TBD"}
                  placeholder="Click to set time"
                  sx={{
                    width: 120,
                    "& .MuiInputBase-input": {
                      fontSize: 13,
                      cursor: "pointer",
                    },
                  }}
                  InputProps={{
                    readOnly: true,
                    sx: { fontSize: 13 },
                  }}
                />
              </TableCell>
            );
          }

          // Default rendering for other imported columns
          return (
            <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
              <TextField
                size="small"
                fullWidth
                value={newGameData.customFields?.[columnName] || ""}
                onChange={(e) => {
                  const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                  updateNewGameData({
                    customFields: {
                      ...(newGameData.customFields || {}),
                      [columnName]: value,
                    },
                  });
                }}
                placeholder={`Enter ${columnName.toLowerCase()}`}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "transparent",
                    "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                    "&:hover fieldset": { borderColor: "primary.main" },
                    "&.Mui-focused fieldset": { borderColor: "primary.main" },
                  },
                  "& .MuiInputBase-input": {
                    fontSize: 13,
                    py: 0.5,
                  },
                }}
              />
            </TableCell>
          );
        }
        if (column.id.startsWith("custom:")) {
          const customColumn = column.customColumn as CustomColumn;
          const customId = customColumn?.id || column.id.split(":")[1];
          const columnType = customColumn?.type || "TEXT";

          // Check if this is "Cost" column (case-insensitive)
          const isCostColumn = customColumn?.name && /^cost$/i.test(customColumn.name.trim());

          // Special rendering for Cost column with Cost & Budget feature
          if (isCostColumn && costBudgetEnabled) {
            return (
              <TableCell key={column.id} sx={{ py: 1, minWidth: 150, textAlign: "center" }}>
                <Typography variant="body2" sx={{ fontSize: 13, color: "text.secondary", fontStyle: "italic" }}>
                  Add cost
                </Typography>
              </TableCell>
            );
          }

          // If this custom column is TIME type, render a time input
          if (columnType === "TIME") {
            return (
              <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
                <TextField
                  type="time"
                  size="small"
                  fullWidth
                  value={newGameData.customData?.[customId] || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateNewGameData({
                      customData: {
                        ...(newGameData.customData || {}),
                        [customId]: value,
                      },
                    });
                  }}
                  placeholder={`Enter ${customColumn?.name?.toLowerCase?.() || "time"}`}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "transparent",
                      "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                      "&:hover fieldset": { borderColor: "primary.main" },
                      "&.Mui-focused fieldset": { borderColor: "primary.main" },
                    },
                    "& .MuiInputBase-input": {
                      fontSize: 13,
                      py: 0.5,
                    },
                  }}
                />
              </TableCell>
            );
          }

          // If this custom column is DATETIME type, render a datetime input
          if (columnType === "DATETIME") {
            return (
              <TableCell key={column.id} sx={{ py: 1, minWidth: 180 }}>
                <TextField
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={newGameData.customData?.[customId] || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateNewGameData({
                      customData: {
                        ...(newGameData.customData || {}),
                        [customId]: value,
                      },
                    });
                  }}
                  placeholder={`Enter ${customColumn?.name?.toLowerCase?.() || "datetime"}`}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "transparent",
                      "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                      "&:hover fieldset": { borderColor: "primary.main" },
                      "&.Mui-focused fieldset": { borderColor: "primary.main" },
                    },
                    "& .MuiInputBase-input": {
                      fontSize: 13,
                      py: 0.5,
                    },
                  }}
                />
              </TableCell>
            );
          }

          // Default rendering for TEXT and DROPDOWN types
          return (
            <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
              <TextField
                size="small"
                fullWidth
                value={newGameData.customData?.[customId] || ""}
                onChange={(e) => {
                  const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                  updateNewGameData({
                    customData: {
                      ...(newGameData.customData || {}),
                      [customId]: value,
                    },
                  });
                }}
                placeholder={`Enter ${customColumn?.name?.toLowerCase?.() || "value"}`}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "transparent",
                    "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                    "&:hover fieldset": { borderColor: "primary.main" },
                    "&.Mui-focused fieldset": { borderColor: "primary.main" },
                  },
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
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                value={extractDatePart(editingGame.date) ? parse(extractDatePart(editingGame.date), "yyyy-MM-dd", new Date()) : null}
                onChange={(newValue) => {
                  if (newValue) {
                    const nextDate = format(newValue, "yyyy-MM-dd");
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
                  }
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      width: 140,
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "transparent",
                        "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                        "&:hover fieldset": { borderColor: "primary.main" },
                        "&.Mui-focused fieldset": { borderColor: "primary.main" },
                      },
                    },
                    InputProps: { sx: { fontSize: 13 } },
                  },
                }}
              />
            </LocalizationProvider>
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
              <Tooltip title="Add new sport">
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
                  {formatLevelDisplay(level)}
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
                      : prev,
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
                      : prev,
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
          const customId = customColumn?.id || column.id.split(":")[1];
          const columnType = customColumn?.type || "TEXT";

          return (
            <TableCell key={column.id} sx={{ py: 1, minWidth: 150 }}>
              {columnType === "TIME" ? (
                <TextField
                  type="time"
                  size="small"
                  fullWidth
                  value={editingCustomData[customId] || ""}
                  onChange={(e) => handleCustomFieldChange(customId, e.target.value)}
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
                  value={editingCustomData[customId] || ""}
                  onChange={(e) => handleCustomFieldChange(customId, e.target.value)}
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
                  value={editingCustomData[customId] || ""}
                  onChange={(e) => handleCustomFieldChange(customId, e.target.value as string)}
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
                  value={editingCustomData[customId] || ""}
                  onChange={(e) => handleCustomFieldChange(customId, e.target.value)}
                  placeholder={`Enter ${customColumn?.name?.toLowerCase?.() || "value"}`}
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

  const getDataCellSx = useCallback(
    (columnId: ColumnId, isEditing: boolean, additionalSx?: any) => {
      const columnWidth = getColumnWidth(columnId);
      return {
        fontSize: 13,
        py: 0,
        width: columnWidth,
        minWidth: MIN_COLUMN_WIDTH,
        maxWidth: MAX_COLUMN_WIDTH,
        cursor: isEditing ? "default" : "pointer",
        bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "transparent",
        ...(isEditing && {
          boxShadow: (theme: any) => `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
        }),
        "&:hover": {
          bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "action.hover",
        },
        ...additionalSx,
      };
    },
    [getColumnWidth, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH],
  );

  const renderViewRowCell = (column: ResolvedColumn, game: Game) => {
    // if (column.id === "date" || column.id.startsWith("imported:")) {
    //   console.log("🔍 RENDER PATH:", {
    //     columnId: column.id,
    //     gameId: game.id,
    //     gameDate: game.date,
    //     formattedDate: formatGameDate(game.date),
    //     isImportedColumn: column.id.startsWith("imported:"),
    //     mapping: column.id.startsWith("imported:") ? (columnPreferencesData?.columnMapping as Record<string, string>)?.[column.id.split(":")[1]] : "default",
    //   });
    // }

    switch (column.id) {
      case "date": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "date";
        const isHovered = hoveredDateGameId === game.id;

        return (
          <TableCell
            key="date"
            sx={{
              ...getDataCellSx("date", isEditing),
              cursor: isEditing ? "default" : "pointer",
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDoubleClick(game, "date");
            }}
            onMouseEnter={() => setHoveredDateGameId(game.id)}
            onMouseLeave={() => setHoveredDateGameId(null)}
          >
            {isEditing ? (
              <Box sx={{ py: 1, width: "100%" }}>
                <InlineDatePicker
                  inlineEditValue={inlineEditValue}
                  isInlineSaving={isInlineSaving}
                  onClose={() => handleInlineBlur(game)}
                  onDateChange={(formatted) => {
                    // Store in ref immediately to avoid race condition with onClose
                    latestDatePickerValueRef.current = formatted;
                    handleInlineChange(formatted, game);
                  }}
                  onKeyDown={(e) => handleInlineKeyDown(e as React.KeyboardEvent<HTMLInputElement>, game)}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  py: 1,
                  minHeight: 40,
                  cursor: "pointer",
                }}
              >
                <Typography variant="body2" sx={{ fontSize: 13, userSelect: "none" }}>
                  {formatGameDate(game.date)}
                </Typography>
                {isHovered && !isInlineSaving && (
                  <CalendarMonth
                    sx={{
                      fontSize: 16,
                      color: "primary.main",
                      transition: "opacity 0.2s",
                    }}
                  />
                )}
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
              bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "action.hover",
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
              bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "action.hover",
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
                      {formatLevelDisplay(level)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {formatLevelDisplay(game.homeTeam.level)}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "level" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "opponent": {
        const isEditing = inlineEditState?.gameId === game.id && inlineEditState.field === "opponent";
        const opponentName = resolveOpponent(game);
        return (
          <TableCell key="opponent" sx={getDataCellSx("opponent", isEditing)} onDoubleClick={() => handleDoubleClick(game, "opponent")}>
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
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {opponentName}
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
              bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "action.hover",
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
              cursor: "pointer",
              bgcolor: "transparent",
              "&:hover": {
                bgcolor: "#f5f5f5",
              },
            }}
            onClick={() => handleTimeClick(game)}
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
              bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "action.hover",
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
        const locationText = game.location || game.venue?.name || "—";
        return (
          <TableCell key="location" sx={getDataCellSx("location", isEditing)} onDoubleClick={() => handleDoubleClick(game, "location")}>
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
                  {locationText}
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
              bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "transparent",
              ...(isEditing && {
                boxShadow: "inset 0 0 0 1px #DBEAFE",
              }),
              "&:hover": {
                bgcolor: isEditing ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "action.hover",
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
        const notesText = game.notes || "";
        return (
          <TableCell key="notes" sx={getDataCellSx("notes", isEditing)} onDoubleClick={() => handleDoubleClick(game, "notes")}>
            {isEditing ? (
              <Box sx={{ py: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={inlineEditValue}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, MAX_CHAR_LIMIT);
                    handleInlineChange(value, game);
                  }}
                  onKeyDown={(e) => handleInlineKeyDown(e, game)}
                  onBlur={() => handleInlineBlur(game)}
                  autoFocus
                  disabled={isInlineSaving}
                  placeholder="Add notes..."
                  sx={{
                    "& .MuiInputBase-input": {
                      fontSize: 13,
                    },
                  }}
                />
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
                  {getNotesPreview(notesText)}
                </Typography>
                {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === "notes" && <CircularProgress size={12} />}
              </Box>
            )}
          </TableCell>
        );
      }
      case "actions": {
        const isSyncingThisGame = syncGameMutation.isPending && syncGameMutation.variables === game.id;
        const isUnsyncingThisGame = unsyncGameMutation.isPending && unsyncGameMutation.variables === game.id;
        const isCalendarSynced = game.calendarSynced && game.googleCalendarEventId;
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
              <Tooltip title={isCalendarSynced ? "Unlink from Calendar" : "Sync to Calendar"}>
                <IconButton
                  size="small"
                  sx={{ p: 0.5 }}
                  onClick={() => {
                    if (isCalendarSynced) {
                      setGameToUnsync(game.id);
                      setUnsyncDialogOpen(true);
                    } else {
                      handleSyncCalendar(game.id);
                    }
                  }}
                  disabled={isSyncingThisGame || isUnsyncingThisGame}
                >
                  {isSyncingThisGame || isUnsyncingThisGame ? <CircularProgress size={16} /> : isCalendarSynced ? <SyncLock sx={{ fontSize: 18, color: "#babfb3" }} /> : <Sync sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              {gameHasSyncedParents(game) && game.status !== "CANCELLED" && (
                <Tooltip title="Cancel game — notifies all synced parents">
                  <IconButton size="small" sx={{ p: 0.5, color: "text.secondary" }} disabled={cancellingGameId === game.id} onClick={() => cancelGameMutation.mutate(game.id)}>
                    {cancellingGameId === game.id ? <CircularProgress size={16} /> : <DoNotDisturbOn sx={{ fontSize: 18 }} />}
                  </IconButton>
                </Tooltip>
              )}
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
        if (column.id.startsWith("imported:")) {
          // Handle imported CSV columns - read from game.customFields
          const columnName = column.id.split(":")[1];
          const columnMapping = columnPreferencesData?.columnMapping as Record<string, string> | undefined;
          const customFields = (game.customFields as Record<string, any>) || {};

          // Check if this column is mapped to date field
          const mapping = columnMapping?.[columnName];

          // Check if this is a Bus Info/Travel column with Enhanced Travel Times enabled
          const isBusInfoColumn = /^(bus info|travel)$/i.test(columnName.trim());
          const shouldShowEnhancedBusInfo = isBusInfoColumn && aiTravelTimesEnabled;

          if (shouldShowEnhancedBusInfo) {
            // Special rendering for Bus Info/Travel columns with Enhanced Travel Times
            const departTime = customFields[`${columnName}_depart`] || "";
            const opponentAddress = customFields[`${columnName}_address`] || "";
            const hasData = departTime;

            // Show "Add Travel Time" button when cell is empty
            if (!hasData) {
              return (
                <TableCell
                  key={column.id}
                  sx={{
                    py: 1,
                    minWidth: 180,
                    textAlign: "center",
                  }}
                >
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      const opponentName = resolveOpponent(game);
                      const gameName = `${game.homeTeam.sport.name} vs ${opponentName}`;
                      setTravelTimeModal({
                        open: true,
                        gameId: game.id,
                        gameName,
                        columnName,
                      });
                    }}
                    sx={{
                      textTransform: "none",
                      color: "text.secondary",
                      fontSize: 13,
                      fontWeight: 400,
                      "&:hover": {
                        bgcolor: "transparent",
                        color: "primary.main",
                      },
                    }}
                  >
                    Add Travel Time
                  </Button>
                </TableCell>
              );
            }

            // Show calculated departure time (editable on double-click)
            const departDisplay = formatTimeDisplay(departTime);

            return (
              <TableCell
                key={column.id}
                sx={{
                  py: 1,
                  minWidth: 180,
                  cursor: "pointer",
                  textAlign: "center",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
                onDoubleClick={() => {
                  const opponentName = game.opponent?.name || "TBD";
                  const gameName = `${game.homeTeam.sport.name} vs ${opponentName}`;
                  setTravelTimeModal({
                    open: true,
                    gameId: game.id,
                    gameName,
                    columnName,
                    currentDepartTime: departTime,
                    currentAddress: opponentAddress,
                  });
                }}
              >
                <Box sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>
                    {departDisplay}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", display: "block", mt: 0.5 }}>
                    Departure Time
                  </Typography>
                </Box>
              </TableCell>
            );
          }

          // Regular rendering for non-Bus Info columns or when toggle is off
          // Check if this column is being edited
          const fieldKey = column.id as InlineEditField;
          const isImportedEditing = inlineEditState?.gameId === game.id && inlineEditState.field === fieldKey;

          let cellValue = "";

          if (mapping === "date") {
            // CRITICAL: Use column.id for imported date columns
            const isEditingDate = inlineEditState?.gameId === game.id && inlineEditState.field === column.id;
            const isHovered = hoveredDateGameId === game.id;

            return (
              <TableCell
                key={column.id}
                sx={{
                  fontSize: 13,
                  py: 0,
                  cursor: isEditingDate ? "default" : "pointer",
                  bgcolor: isEditingDate ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "transparent",
                  ...(isEditingDate && {
                    boxShadow: "inset 0 0 0 1px #DBEAFE",
                  }),
                  "&:hover": {
                    bgcolor: isEditingDate ? (theme: any) => alpha(theme.palette.warning.main, 0.15) : "action.hover",
                  },
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("📅 Imported date double-clicked for game:", game.id);
                  console.log("📅 Using column ID:", column.id);

                  // Use column.id as the field for imported columns
                  setInlineEditState({ gameId: game.id, field: column.id as InlineEditField });
                  setInlineEditValue(game.date.split("T")[0]);
                  setInlineEditError(null);
                  setSaveStatus("idle");
                }}
                onMouseEnter={() => setHoveredDateGameId(game.id)}
                onMouseLeave={() => setHoveredDateGameId(null)}
              >
                {isEditingDate ? ( // <-- CRITICAL: Use isEditingDate variable
                  <Box sx={{ py: 1, width: "100%" }}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        open={isEditingDate}
                        onClose={() => {
                          console.log("📅 Imported DatePicker closed");
                          // Check if a date was selected via the ref
                          if (latestDatePickerValueRef.current && inlineEditState) {
                            const valueToSave = latestDatePickerValueRef.current;
                            // Save immediately if value changed
                            if (valueToSave !== originalInlineValueRef.current) {
                              scheduleAutosave(game.id, column.id as InlineEditField, valueToSave, game, true);
                            }
                            latestDatePickerValueRef.current = null;
                          }
                          setInlineEditState(null);
                          setInlineEditValue("");
                          setSaveStatus("idle");
                        }}
                        value={inlineEditValue ? parse(inlineEditValue, "yyyy-MM-dd", new Date()) : null}
                        onChange={(newValue) => {
                          if (newValue) {
                            const formattedDate = format(newValue, "yyyy-MM-dd");
                            console.log("📅 Date changed to:", formattedDate);
                            // Store in ref immediately to avoid race condition with onClose
                            latestDatePickerValueRef.current = formattedDate;
                            // Update the value in state for UI display
                            handleInlineValueChange(formattedDate);
                          }
                        }}
                        disabled={isInlineSaving}
                        slotProps={{
                          textField: {
                            size: "small",
                            autoFocus: true,
                            onKeyDown: (e: any) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                latestDatePickerValueRef.current = null;
                                setInlineEditState(null);
                                setInlineEditValue("");
                                setSaveStatus("idle");
                              }
                            },
                            sx: { width: "100%" },
                            InputProps: { sx: { fontSize: 13 } },
                          },
                          popper: {
                            placement: "bottom-start",
                          },
                        }}
                      />
                    </LocalizationProvider>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      py: 1,
                      minHeight: 40,
                      cursor: "pointer",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: 13, userSelect: "none" }}>
                      {formatGameDate(game.date)}
                    </Typography>
                    {isHovered && !isInlineSaving && (
                      <CalendarMonth
                        sx={{
                          fontSize: 16,
                          color: "primary.main",
                          transition: "opacity 0.2s",
                        }}
                      />
                    )}
                    {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === column.id && <CircularProgress size={12} />}
                  </Box>
                )}
              </TableCell>
            );
          } else if (mapping === "time") {
            cellValue = formatTimeDisplay(customFields[columnName]);
          } else {
            // Display value from customFields (editable)
            cellValue = customFields[columnName] || "—";
          }

          return (
            <TableCell key={column.id} sx={getDataCellSx(column.id, isImportedEditing)} onDoubleClick={() => handleDoubleClick(game, fieldKey)}>
              {isImportedEditing ? (
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cellValue}
                  </Typography>
                  {isInlineSaving && inlineEditState?.gameId === game.id && inlineEditState?.field === fieldKey && <CircularProgress size={12} />}
                </Box>
              )}
            </TableCell>
          );
        }
        if (column.id.startsWith("custom:")) {
          const customColumn = column.customColumn as CustomColumn;
          const customId = customColumn?.id || column.id.split(":")[1];
          const fieldKey = `custom:${customId}` as InlineEditField;
          const customData = (game.customData as any) || {};
          const cellValue = customData[customId] || "";
          const isCustomEditing = inlineEditState?.gameId === game.id && inlineEditState.field === fieldKey;
          const columnType = customColumn?.type || "TEXT";

          // Check if this is the "Travel Time" column (case-insensitive)
          const isTravelTimeColumn = customColumn?.name && /^travel time$/i.test(customColumn.name.trim());

          // Check if this is the "Cost" or "Expenses" column (case-insensitive)
          const isCostColumn = customColumn?.name && (/^cost$/i.test(customColumn.name.trim()) || /^expenses$/i.test(customColumn.name.trim()));

          // Special rendering for Cost column with Cost & Budget feature
          if (isCostColumn && costBudgetEnabled) {
            const gameCost = game.cost || null;

            return (
              <TableCell
                key={column.id}
                sx={{
                  py: 1,
                  minWidth: 150,
                  textAlign: "center",
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
                onClick={() => {
                  const opponentName = game.opponent?.name || "TBD";
                  const gameName = `${game.homeTeam.sport.name} vs ${opponentName}`;
                  setCostModal({
                    open: true,
                    gameId: game.id,
                    gameName,
                    currentCost: gameCost,
                  });
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 0.5 }}>
                  {gameCost !== null ? (
                    <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>
                      ${gameCost.toFixed(2)}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ fontSize: 13, color: "text.secondary", fontStyle: "italic" }}>
                      Add cost
                    </Typography>
                  )}
                </Box>
              </TableCell>
            );
          }

          // Special rendering for Travel Time column with Enhanced Travel Times
          if (isTravelTimeColumn && aiTravelTimesEnabled) {
            // Read data from customFields (where enhanced travel time feature stores data)
            const columnName = customColumn.name; // e.g., "Travel Time"
            const customFields = (game.customFields as Record<string, any>) || {};
            const departTime = customFields[`${columnName}_depart`] || "";
            const opponentAddress = customFields[`${columnName}_address`] || "";
            const hasData = departTime;

            // Show "Add Travel Time" button when cell is empty
            if (!hasData) {
              return (
                <TableCell
                  key={column.id}
                  sx={{
                    py: 1,
                    minWidth: 180,
                    textAlign: "center",
                  }}
                >
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      const opponentName = resolveOpponent(game);
                      const gameName = `${game.homeTeam.sport.name} vs ${opponentName}`;
                      setTravelTimeModal({
                        open: true,
                        gameId: game.id,
                        gameName,
                        columnName,
                      });
                    }}
                    sx={{
                      textTransform: "none",
                      color: "text.secondary",
                      fontSize: 13,
                      fontWeight: 400,
                      "&:hover": {
                        bgcolor: "transparent",
                        color: "primary.main",
                      },
                    }}
                  >
                    Add Travel Time
                  </Button>
                </TableCell>
              );
            }

            // Show calculated departure time (editable on double-click)
            const departDisplay = formatTimeDisplay(departTime);

            return (
              <TableCell
                key={column.id}
                sx={{
                  py: 1,
                  minWidth: 180,
                  cursor: "pointer",
                  textAlign: "center",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
                onDoubleClick={() => {
                  const opponentName = game.opponent?.name || "TBD";
                  const gameName = `${game.homeTeam.sport.name} vs ${opponentName}`;
                  setTravelTimeModal({
                    open: true,
                    gameId: game.id,
                    gameName,
                    columnName,
                  });
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, mb: 0.5 }}>
                    Departure Time
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>
                    {departDisplay}
                  </Typography>
                </Box>
              </TableCell>
            );
          }

          // Format display value based on column type (for non-Travel Time columns)
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
            <TableCell key={column.id} sx={getDataCellSx(column.id, isCustomEditing)} onDoubleClick={() => handleDoubleClick(game, fieldKey)}>
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
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
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

    // Use the same column configuration as existing rows to prevent alignment issues
    // If user has imported columns, the new row will show those columns (with "—" for read-only fields)
    // If user has default columns, the new row will show those
    return (
      <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) }}>
        <TableCell padding="checkbox">
          <Checkbox disabled sx={{ p: 0 }} />
        </TableCell>
        {resolvedColumns.map((column) => renderNewRowCell(column))}
      </TableRow>
    );
  };

  // Mobile card rendering
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const handleExpandCard = (gameId: string) => {
    setExpandedCard(expandedCard === gameId ? null : gameId);
  };

  // Build a human-readable team title: [Girls/Boys] [Level] [Sport]
  // Falls back gracefully when fields are missing.
  const buildTeamTitle = (homeTeam: Game["homeTeam"]): string => {
    const parts: string[] = [];
    if (homeTeam?.gender === "FEMALE") parts.push("Girls");
    else if (homeTeam?.gender === "MALE") parts.push("Boys");
    // COED or null → no gender prefix
    const level = homeTeam?.level ? formatLevelDisplay(homeTeam.level) : "";
    if (level) parts.push(level);
    const sport = homeTeam?.sport?.name;
    if (sport) parts.push(sport);
    return parts.join(" ") || "—";
  };

  const renderMobileCard = (game: Game) => {
    const isSelected = selectedGames.has(game.id);
    const isExpanded = expandedCard === game.id;

    // Format date as MM/dd/yyyy (extract the local date part to avoid TZ shift)
    const datePart = extractDatePart(game.date);
    const formattedDate = datePart ? format(new Date(datePart + "T12:00:00"), "MM/dd/yyyy") : "—";

    // Get time
    const timeDisplay = formatTimeDisplay(game.time);

    // Get status
    const statusConfig = getConfirmedStatus(game.status);

    // Smart team title
    const teamTitle = buildTeamTitle(game.homeTeam);

    // Get location
    const locationName = game.venue?.name || "";

    // Home/Away
    const homeAway = game.isHome ? "Home" : "Away";

    return (
      <Card
        key={game.id}
        sx={{
          mb: 2,
          borderLeft: isSelected ? 4 : 0,
          borderColor: "primary.main",
          bgcolor: "background.paper",
        }}
      >
        <CardContent sx={{ pb: 1 }}>
          {/* Header with checkbox and date */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Checkbox checked={isSelected} onChange={() => handleSelectGame(game.id)} sx={{ p: 0, mr: 1 }} />
            <Typography variant="h6" sx={{ flexGrow: 1, fontSize: "1rem", fontWeight: 600 }}>
              {formattedDate}
            </Typography>
            {game.googleCalendarEventId && <Chip size="small" icon={<Sync sx={{ fontSize: 14 }} />} label="Synced" sx={{ height: 20, fontSize: "0.7rem", mr: 1 }} />}
          </Box>

          {/* Team title + Home/Away chip */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              {teamTitle}
            </Typography>
            <Chip label={homeAway} size="small" sx={{ height: 20, fontSize: "0.7rem" }} />
          </Box>

          {/* Time and Status */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Schedule sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2">{timeDisplay}</Typography>
            </Box>
            <Chip size="small" label={statusConfig.label} icon={statusConfig.icon} color={statusConfig.color as ChipProps["color"]} sx={{ height: 20, fontSize: "0.7rem" }} />
          </Box>

          {/* Expandable section */}
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Divider sx={{ my: 1 }} />

            {/* Location */}
            {locationName && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Location
                </Typography>
                <Typography variant="body2">{locationName}</Typography>
              </Box>
            )}

            {/* Notes */}
            {game.notes && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Notes
                </Typography>
                <Typography variant="body2">{game.notes}</Typography>
              </Box>
            )}

            {/* Custom fields */}
            {game.customData && Object.keys(game.customData).length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  Additional Info
                </Typography>
                {Object.entries(game.customData).map(([key, value]) => {
                  const customColumn = customColumns.find((col) => col.id === key);
                  const label = customColumn?.name || key;
                  return (
                    <Typography key={key} variant="body2" sx={{ fontSize: "0.875rem" }}>
                      <strong>{label}:</strong> {customColumn?.type === "TIME" ? formatTimeDisplay(String(value)) : String(value)}
                    </Typography>
                  );
                })}
              </Box>
            )}

            {/* CSV imported fields */}
            {game.customFields && Object.keys(game.customFields).length > 0 && (
              <Box>
                {Object.entries(game.customFields).map(([key, value]) => {
                  if (value === null || value === undefined) return null;
                  const colMapping = (columnPreferencesData?.columnMapping as Record<string, string>)?.[key];
                  let displayValue: string;
                  if (colMapping === "time") {
                    displayValue = formatTimeDisplay(String(value));
                  } else if (colMapping === "date" || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value))) {
                    const dp = extractDatePart(String(value));
                    displayValue = dp ? format(new Date(dp + "T12:00:00"), "MM/dd/yyyy") : String(value);
                  } else {
                    displayValue = String(value);
                  }
                  if (!displayValue) return null;
                  return (
                    <Typography key={key} variant="body2" sx={{ fontSize: "0.875rem", mb: 0.5 }}>
                      <strong>{key}:</strong> {displayValue}
                    </Typography>
                  );
                })}
              </Box>
            )}
          </Collapse>

          {/* Expand/Collapse button */}
          <Button size="small" onClick={() => handleExpandCard(game.id)} endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />} sx={{ mt: 1, textTransform: "none" }}>
            {isExpanded ? "Show Less" : "Show More"}
          </Button>
        </CardContent>

        <CardActions sx={{ justifyContent: "flex-end", pt: 0, pb: 1, px: 2 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleEditGame(game)} color="primary">
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => handleDeleteGame(game)} color="error">
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
          {game.googleCalendarEventId ? (
            <Tooltip title="Update in Google Calendar">
              <IconButton size="small" onClick={() => handleSyncCalendar(game.id)} color="success">
                <Sync fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Sync to Google Calendar">
              <IconButton size="small" onClick={() => handleSyncCalendar(game.id)} sx={{ color: "text.secondary" }}>
                <CalendarMonth fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </CardActions>
      </Card>
    );
  };

  const renderGameRow = (game: Game) => {
    const isSelected = selectedGames.has(game.id);
    const isEditing = editingGameId === game.id && editingGameData;

    if (isEditing && editingGameData) {
      return (
        <TableRow key={game.id} sx={{ bgcolor: "warning.light" }}>
          <TableCell padding="checkbox">
            <Checkbox disabled sx={{ p: 0 }} />
          </TableCell>
          {resolvedColumns.map((column) => renderEditingRowCell(column, editingGameData))}
        </TableRow>
      );
    }

    const isCancelled = game.status === "CANCELLED";
    return (
      <TableRow
        key={game.id}
        selected={isSelected}
        sx={{
          bgcolor: "background.paper",
          "&:hover": { bgcolor: "action.hover" },
          transition: "background-color 0.2s",
          "&.Mui-selected": {
            bgcolor: "action.selected !important",
            "&:hover": {
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2) + " !important",
            },
          },
          // Dark mode: dim the row borders (using alpha to make them more subtle)
          borderTop: (theme) => (theme.palette.mode === "dark" ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.action.hover : theme.palette.divider}` : "none"),
          borderBottom: (theme) => (theme.palette.mode === "dark" ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.action.hover : theme.palette.divider}` : "none"),
          // CANCELLED: cross-out the entire row
          ...(isCancelled && {
            opacity: 0.65,
            "& td": { textDecoration: "line-through", color: "text.disabled" },
          }),
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

  // Wait for both games data AND column preferences to load before rendering
  // This prevents default columns from flashing on page refresh when user has imported columns
  // Also show loading when fetching with filters and no data yet (prevents "No games found" flash)
  const isInitialLoading = !mounted || isLoading || isLoadingPreferences;
  const isFilterLoading = isFetching && games.length === 0 && activeFilterCount > 0;

  if (isInitialLoading || isFilterLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <Typography color="text.secondary">Loading schedule...</Typography>
      </Box>
    );
  }

  const selectedWorkbook = workbooks.find((wb) => wb.id === selectedWorkbookId);
  const currentWorksheetName = selectedWorkbook?.name || "Spreadsheet";

  return (
    <Box>
      {/* Worksheet Toggle */}
      <WorksheetToggle activeTab={worksheetTab} worksheetName={currentWorksheetName} onTabChange={setWorksheetTab} />

      {/* Worksheet View - shown when "View" tab is active */}
      {worksheetTab === "view" ? (
        <WorksheetView
          workbooks={workbooks}
          selectedWorkbookId={selectedWorkbookId}
          onSelectWorkbook={handleViewSelectWorkbook}
          onCreateWorkbook={handleViewImportNew}
          onRenameWorkbook={handleViewRenameWorkbook}
          onDeleteWorkbook={handleViewDeleteWorkbook}
          isCreating={createWorkbookMutation.isPending}
          worksheetLimit={planLimits?.worksheetLimit}
          deletingWorkbookId={deletingWorkbookId}
        />
      ) : (
        <>
          {/* Header */}
          <Box
            sx={{
              mb: { xs: 2, md: 0 },
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: { xs: 2, md: 0 },
              justifyContent: "space-between",
              alignItems: { xs: "stretch", md: "center" },
            }}
          >
            <Box className={styles.GamesTableContainer}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  mb: 0.5,
                  fontSize: { xs: "1.25rem", md: "1.5rem" },
                  color: (theme) => (theme.palette.mode === "dark" ? theme.palette.primary.light : theme.palette.text.primary),
                }}
              >
                Game Schedules
              </Typography>

              <Typography variant="body2" component="div" color="text.primary" sx={{ fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
                {/* Manage your athletic schedules and create your own customized columns. */}
                Import your CSV game schedule and instantly sync, organize, and coordinate your athletic programs in one place.
                <span>
                  <Tooltip
                    title="Import your spreadsheets using the import button above the table, sync them to your Google Calendar, and use Email Manager to create contact groups and rapidly send schedules at scale."
                    placement="top"
                    arrow
                  >
                    <IconButton size="small" sx={{ ml: 0, pl: 0 }}>
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </span>
                {activeFilterCount > 0 && (
                  <Chip
                    label={`${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`}
                    size="small"
                    onDelete={() => setColumnFilters({})}
                    sx={{
                      ml: 1,
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      "& .MuiChip-deleteIcon": {
                        color: "primary.contrastText",
                        "&:hover": {
                          color: (theme) => alpha(theme.palette.primary.contrastText, 0.7),
                        },
                      },
                      "&:hover": {
                        bgcolor: "primary.dark",
                      },
                    }}
                  />
                )}
              </Typography>

              {!showWorkbookSelector && !toolbarMenuVisible && (
                <Tooltip title="Show menu">
                  <Box
                    onClick={() => toggleToolbarMenu(true)}
                    sx={{
                      mt: 2,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      cursor: "pointer",
                      // Match the body-text colour so the toggle reads as part
                      // of the intro copy rather than disabled-looking ghost text.
                      color: "text.secondary",
                      userSelect: "none",
                      "&:hover": { color: "text.primary" },
                      transition: "color 0.18s ease",
                    }}
                  >
                    <SettingsMenuIcon sx={{ fontSize: "1rem" }} />
                    <Typography variant="body2" sx={{ lineHeight: 1.2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
                      Show menu
                    </Typography>
                    <ChevronRight sx={{ fontSize: "1.05rem" }} />
                  </Box>
                </Tooltip>
              )}
              {!showWorkbookSelector && (
              <Collapse in={toolbarMenuVisible} timeout={220} unmountOnExit>
                <Stack direction="row" spacing={{ xs: 1, sm: 2 }} sx={{ mt: 2, flexWrap: "wrap", gap: 0 }}>
                  {selectedGames.size > 0 && games.length > 0 && (
                    <Button
                      variant="contained"
                      startIcon={theme.palette.mode === "dark" ? <SendIcon sx={{ color: theme.palette.themeButtonText.main }} /> : <GradientSendIcon />}
                      onClick={handleSendEmail}
                      size="small"
                      sx={{ color: theme.palette.themeButtonText.main, textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}
                    >
                      Send Email ({selectedGames.size})
                    </Button>
                  )}
                  {/* Create Game Button */}
                  <Tooltip title={scheduleView ? "Switch to Table View to create a game" : selectedGames.size > 0 ? "Deselect rows to create a game" : "Create a new row in the table below"}>
                    <span>
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={handleNewGame}
                        disabled={isAddingNew || scheduleView || selectedGames.size > 0}
                        size="small"
                        sx={{ color: theme.palette.mode === "dark" ? "#121212" : "white", textTransform: "none", boxShadow: 0, "&:hover": { boxShadow: 2 } }}
                      >
                        Create Game
                      </Button>
                    </span>
                  </Tooltip>

                  {/* Create Table Button - to create separate tables */}
                  {/* <Tooltip title="Add a separate table">
                {selectedGames.size > 0 ? (
                  <IconButton
                    disabled
                    size="small"
                    sx={{
                      opacity: 0.5,
                      minWidth: 32,
                      width: 32,
                      height: 32,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                    }}
                  >
                    <TableChart fontSize="small" />
                  </IconButton>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<TableChart />}
                    onClick={() => setShowWorkbookSelector(true)}
                    size="small"
                    sx={{
                      borderColor: theme.palette.themeButtonText.subtle,
                      color: `${theme.palette.mode}` === "dark" ? `${theme.palette.primary.light}}` : "inherit",
                      textTransform: "none",
                    }}
                  >
                    Create Table
                  </Button>
                )}
              </Tooltip> */}

                  <Tooltip title="Use AI to find available dates in your schedule">
                    <Button
                      variant="contained"
                      startIcon={<AutoAwesome fontSize="small" />}
                      onClick={handleFindAvailableDates}
                      size="small"
                      sx={{
                        textTransform: "none",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "white",
                        boxShadow: 0,
                        "&:hover": {
                          background: "linear-gradient(135deg, #5568d3 0%, #653a8b 100%)",
                          boxShadow: 2,
                        },
                      }}
                    >
                      Find Dates
                    </Button>
                  </Tooltip>

                  {/* Add Columns Button */}
                  <Tooltip title={scheduleView ? "Switch to Table View to add columns" : selectedGames.size > 0 ? "Deselect rows to add columns" : "Add a custom column to the table below."}>
                    <span>
                      <Button
                        variant="outlined"
                        startIcon={<ViewColumn />}
                        onClick={handleAddColumnsClick}
                        disabled={selectedGames.size > 0 || scheduleView}
                        size="small"
                        sx={{
                          borderColor: theme.palette.themeButtonText.subtle,
                          color: theme.palette.mode === "dark" ? theme.palette.primary.light : "inherit",
                          textTransform: "none",
                          py: "5px",
                          display: { xs: "none", sm: "inline-flex" },
                        }}
                      >
                        Add Columns ({customColumns.length})
                      </Button>
                    </span>
                  </Tooltip>

                  {/* Columns Button */}
                  <Tooltip title={scheduleView ? "Switch to Table View to customize columns" : selectedGames.size > 0 ? "Deselect rows to customize columns" : "Arrange your columns using drag and drop."}>
                    <span>
                      <Button
                        variant="outlined"
                        startIcon={<Tune />}
                        onClick={() => {
                          trackEvent("Columns Button Clicked", {
                            source: "games_table",
                            action: "customize_columns",
                            visible_columns_count: visibleColumnIds.length,
                          });
                          setIsColumnPreferencesOpen(true);
                        }}
                        disabled={selectedGames.size > 0 || scheduleView}
                        size="small"
                        sx={{ borderColor: theme.palette.themeButtonText.subtle, color: theme.palette.mode === "dark" ? theme.palette.primary.light : "inherit", textTransform: "none", py: "5px" }}
                      >
                        Columns ({visibleColumnIds.length})
                      </Button>
                    </span>
                  </Tooltip>

                  {selectedGames.size > 0 && games.length > 0 && (
                    <>
                      <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<ContentCopy />}
                        onClick={handleCopySelectedRows}
                        size="small"
                        sx={{
                          color: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                          borderColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                          textTransform: "none",
                          display: { xs: "none", sm: "inline-flex" },
                        }}
                      >
                        Copy ({selectedGames.size})
                      </Button>
                      <Tooltip title="Sync calendars">
                        <IconButton
                          onClick={handleBulkSync}
                          disabled={bulkSyncGamesMutation.isPending}
                          size="small"
                          sx={{
                            color: "primary.main",
                            display: { xs: "none", sm: "inline-flex" },
                          }}
                        >
                          {bulkSyncGamesMutation.isPending ? <CircularProgress size={20} /> : <Sync />}
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {hiddenColumnCount > 0 && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        trackEvent("Columns Hidden Indicator Clicked", {
                          source: "games_table",
                          action: "customize_columns",
                          hidden_columns_count: hiddenColumnCount,
                          visible_columns_count: visibleColumnIds.length,
                        });
                        setIsColumnPreferencesOpen(true);
                      }}
                      startIcon={<VisibilityOff />}
                      sx={{ textTransform: "none", display: { xs: "none", sm: "inline-flex" } }}
                    >
                      {hiddenColumnCount} hidden
                    </Button>
                  )}

                  {/* Post Schedule Button — visible only when enabled in Settings > Other */}
                  {showPostScheduleButton && (
                    <Tooltip title="Post your schedule to the Schedule Exchange Board">
                      <Button
                        variant="outlined"
                        startIcon={<PostAddIcon />}
                        onClick={() => { setPostSchedulePosted(false); setPostScheduleModalOpen(true); }}
                        size="small"
                        sx={{
                          borderColor: theme.palette.themeButtonText.subtle,
                          color: theme.palette.mode === "dark" ? theme.palette.primary.light : "inherit",
                          textTransform: "none",
                          py: "5px",
                        }}
                      >
                        Post Schedule
                      </Button>
                    </Tooltip>
                  )}

                  {/* Hide menu toggle — subtle arrow at the far end */}
                  <Tooltip title="Hide menu">
                    <IconButton
                      size="small"
                      onClick={() => toggleToolbarMenu(false)}
                      sx={{
                        color: "text.disabled",
                        opacity: 0.35,
                        "&:hover": { opacity: 0.75, bgcolor: "transparent" },
                        transition: "opacity 0.18s ease",
                        ml: 0.5,
                      }}
                      disableRipple
                    >
                      <ChevronLeft fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Collapse>
              )}
            </Box>
            <Stack direction="row" spacing={{ xs: 1, sm: 2 }} sx={{ flexShrink: 0 }}>
              {selectedGames.size > 0 && games.length > 0 && (
                <>
                  {/* Delete Button */}
                  <LoadingButton
                    variant="outlined"
                    startIcon={!bulkDeleteMutation.isPending && <DeleteOutline sx={{ color: "darkgray" }} />}
                    onClick={handleBulkDelete}
                    loading={bulkDeleteMutation.isPending}
                    size="small"
                    sx={{
                      border: `${theme.palette.mode}` === "dark" ? "1px solid gray" : "#181b38",
                      borderRadius: "10px",
                      padding: "3px 9px",
                      textTransform: "none",
                      background: "transparent",
                      boxShadow: 0,
                      "&:hover": { boxShadow: 0 },
                    }}
                  >
                    {bulkDeleteMutation.isPending ? "Deleting..." : `Delete(${selectedGames.size})`}
                  </LoadingButton>
                </>
              )}
              {/* Import Button */}
              <Tooltip title="Import games from CSV">
                <Button
                  ref={setImportBtnEl}
                  variant="outlined"
                  startIcon={<Upload />}
                  onClick={handleImportClick}
                  size="small"
                  sx={{ borderColor: theme.palette.themeButtonText.subtle, color: `${theme.palette.mode}` === "dark" ? `${theme.palette.primary.light}}` : "inherit", textTransform: "none" }}
                >
                  Import
                </Button>
              </Tooltip>
              <TipBubble
                tipId={TIP_IDS.GAMES_IMPORT}
                anchorEl={importBtnEl}
                placement="bottom-end"
                title="Upload your Sport Schedule CSV"
                body="Click Import to drop in your CSV — this is how you load your full schedule into Opletics."
              />
              <Tooltip title={selectedGames.size > 0 ? "Export selected games to CSV" : "Export all games to CSV"}>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleExport}
                  disabled={games.length === 0}
                  size="small"
                  sx={{
                    borderColor: theme.palette.themeButtonText.subtle,
                    color: `${theme.palette.mode}` === "dark" ? `${theme.palette.primary.light}}` : "inherit",
                    textTransform: "none",
                    display: { xs: "none", sm: "inline-flex" },
                  }}
                >
                  Export{selectedGames.size > 0 ? ` (${selectedGames.size})` : ""}
                </Button>
              </Tooltip>
              {/* Schedule / Calendar View Toggle */}
              <Tooltip title={scheduleView ? "Switch to Table View" : "Switch to Calendar View"}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setGamesViewMode(scheduleView ? "table" : "schedule")}
                  startIcon={scheduleView ? <TableRowsIcon fontSize="small" /> : <ViewModuleIcon fontSize="small" />}
                  sx={{
                    borderColor: theme.palette.themeButtonText.subtle,
                    color: scheduleView ? "primary.main" : "text.secondary",
                    textTransform: "none",
                    display: { xs: "none", sm: "inline-flex" },
                  }}
                >
                  {scheduleView ? "Table View" : "Calendar View"}
                </Button>
              </Tooltip>
            </Stack>
          </Box>

          {/* Edit Workbook Name Dialog */}
          <Dialog open={editingWorkbookDialog?.open ?? false} onClose={() => setEditingWorkbookDialog(null)} maxWidth="xs" fullWidth>
            <DialogTitle>Rename Table</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                fullWidth
                label="Table Name"
                defaultValue={editingWorkbookDialog?.currentName}
                variant="outlined"
                sx={{ mt: 2 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (editingWorkbookDialog?.currentName.trim()) {
                      updateWorkbookMutation.mutate({
                        id: editingWorkbookDialog.workbookId,
                        name: editingWorkbookDialog.currentName.trim(),
                      });
                    }
                  }
                }}
                onChange={(e) => {
                  if (editingWorkbookDialog) {
                    setEditingWorkbookDialog({
                      ...editingWorkbookDialog,
                      currentName: e.target.value,
                    });
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditingWorkbookDialog(null)}>Cancel</Button>
              <LoadingButton
                onClick={() => {
                  if (editingWorkbookDialog?.currentName.trim()) {
                    updateWorkbookMutation.mutate({
                      id: editingWorkbookDialog.workbookId,
                      name: editingWorkbookDialog.currentName.trim(),
                    });
                  }
                }}
                loading={updateWorkbookMutation.isPending}
                variant="contained"
                disabled={!editingWorkbookDialog?.currentName.trim()}
              >
                Rename
              </LoadingButton>
            </DialogActions>
          </Dialog>

          {/* Save Status Banner */}
          <SaveStatusBanner status={saveStatus} />

          {/* Sample Game Banner */}
          <SampleGameBanner hasSampleGames={games.some((game: Game) => game.isSampleGame)} />

          {/* ── Schedule / Calendar View ── */}
          {scheduleView ? (
            <>
<ScheduleCalendarView games={calendarGames} isLoading={calendarLoading} workbookId={selectedWorkbookId ?? null} />
            </>
          ) : isMobile ? (
            <Box sx={{ position: "relative" }}>
              {/* Show skeleton loader on initial load OR when fetching with no data */}
              {isLoading || (!mounted && !isAddingNew) ? (
                <Stack spacing={2}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={`skeleton-${index}`}>
                      <CardContent>
                        <Skeleton variant="rectangular" width={120} height={20} sx={{ mb: 1 }} />
                        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
                        <Skeleton variant="text" width="80%" height={20} sx={{ mb: 1 }} />
                        <Skeleton variant="text" width="40%" height={20} />
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              ) : games.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: "center", bgcolor: "background.paper" }}>
                  <Typography color="text.secondary" variant="body2">
                    No games found. Import your spreadsheet or click &quot;Create Game&quot; to add one.
                  </Typography>
                </Paper>
              ) : (
                <Box>{games.filter((game: any) => game && game.id).map((game: any) => renderMobileCard(game))}</Box>
              )}

              {/* Loading overlay for data refresh - show when fetching and we have previous data */}
              {isFetching && mounted && !isLoading && games.length > 0 && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10,
                    borderRadius: 2,
                  }}
                >
                  <CircularProgress size={40} sx={{ mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Loading spreadsheet...
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            /* Desktop Table View */
            <Box sx={{ position: "relative" }}>
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
                    <TableRow sx={{ bgcolor: "rgb(127 158 203 / 8%)" }}>
                      <TableCell padding="checkbox" sx={{ py: 0 }}>
                        <Checkbox indeterminate={isIndeterminate} checked={isAllSelected} onChange={handleSelectAll} sx={{ p: 0 }} />
                      </TableCell>
                      {resolvedColumns.map((column) => renderHeaderCell(column))}
                    </TableRow>
                  </TableHead>
                  {/* Show skeleton loader on initial load OR when fetching with no data */}
                  {isLoading || (!mounted && !isAddingNew) ? (
                    <TableBody>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`}>
                          <TableCell padding="checkbox">
                            <Skeleton
                              variant="rectangular"
                              width={18}
                              height={18}
                              sx={{
                                borderRadius: 0.5,
                                bgcolor: "rgba(0, 0, 0, 0.11)",
                              }}
                            />
                          </TableCell>
                          {resolvedColumns.map((column) => (
                            <TableCell key={`skeleton-${index}-${column.id}`} sx={{ py: 1.5 }}>
                              <Skeleton
                                variant="rectangular"
                                width={
                                  column.id === "date"
                                    ? "80%"
                                    : column.id === "time"
                                      ? "60%"
                                      : column.id === "sport"
                                        ? "70%"
                                        : column.id === "level"
                                          ? "65%"
                                          : column.id === "opponent"
                                            ? "85%"
                                            : column.id === "status"
                                              ? "50%"
                                              : column.id === "isHome"
                                                ? "55%"
                                                : column.id === "location"
                                                  ? "75%"
                                                  : column.id === "busTravel"
                                                    ? "70%"
                                                    : column.id === "notes"
                                                      ? "90%"
                                                      : column.id === "actions"
                                                        ? "90%"
                                                        : "75%"
                                }
                                height={24}
                                sx={{
                                  borderRadius: 1,
                                  bgcolor: "rgba(0, 0, 0, 0.11)",
                                }}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  ) : games.length === 0 && !isAddingNew ? (
                    <TableBody>
                      {renderNewRow()}
                      <TableRow>
                        <TableCell colSpan={resolvedColumns.length + 1} align="center" sx={{ py: 8, bgcolor: "background.paper" }}>
                          {/* Show loading indicator when fetching with no results, otherwise show empty state */}
                          {isFetching ? (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <CircularProgress size={40} />
                              <Typography color="text.secondary" variant="body2">
                                Loading spreadsheet...
                              </Typography>
                            </Box>
                          ) : (
                            <Typography color="text.secondary" variant="body2">
                              No games found. Import your spreadsheet or click &quot;Create Game&quot; to add one.
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : (
                    <TableBody>
                      {renderNewRow()}
                      {games.filter((game: any) => game && game.id).map((game: any) => renderGameRow(game))}
                    </TableBody>
                  )}
                </Table>
              </TableContainer>

              {/* Loading overlay for data refresh (after import) */}
              {isFetching && mounted && !isLoading && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10,
                    borderRadius: 2,
                  }}
                >
                  <CircularProgress size={40} sx={{ mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Loading spreadsheet...
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Workbook Selector Dialog */}
          <Dialog open={showWorkbookSelector} onClose={() => setShowWorkbookSelector(false)} maxWidth="md" fullWidth>
            <DialogTitle>Select or Create a Table</DialogTitle>
            <DialogContent>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(auto-fill, minmax(280px, 1fr))",
                    sm: "repeat(auto-fill, minmax(320px, 1fr))",
                    md: "repeat(auto-fill, minmax(360px, 1fr))",
                  },
                  gap: 3,
                  mt: 2,
                }}
              >
                {/* Render existing workbooks */}
                {workbooks.map((workbook) => (
                  <Card
                    key={workbook.id}
                    sx={{
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      border: selectedWorkbookId === workbook.id ? "2px solid" : "1px solid",
                      borderColor: selectedWorkbookId === workbook.id ? "primary.main" : "divider",
                      bgcolor: "background.paper",
                      "&:hover": {
                        boxShadow: 3,
                        transform: "translateY(-2px)",
                      },
                    }}
                    onClick={() => setSelectedWorkbookId(workbook.id)}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
                          {workbook.name}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          <Tooltip title="Rename table">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWorkbookDialog({
                                  open: true,
                                  workbookId: workbook.id,
                                  currentName: workbook.name,
                                });
                              }}
                              sx={{ p: 0.5 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete table">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteWorkbookDialog({
                                  open: true,
                                  workbookId: workbook.id,
                                  workbookName: workbook.name,
                                  gameCount: workbook._count?.games || 0,
                                });
                              }}
                              sx={{ p: 0.5, color: "error.main" }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {workbook._count?.games || 0} game{workbook._count?.games !== 1 ? "s" : ""}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}

                {/* Add new workbook card */}
                <Card
                  sx={{
                    cursor: planLimits && workbooks.length >= planLimits.worksheetLimit ? "not-allowed" : "pointer",
                    border: "2px dashed",
                    borderColor: "divider",
                    bgcolor: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 140,
                    transition: "all 0.2s ease",
                    opacity: planLimits && workbooks.length >= planLimits.worksheetLimit ? 0.6 : 1,
                    "&:hover": {
                      borderColor: planLimits && workbooks.length >= planLimits.worksheetLimit ? "divider" : "primary.main",
                      bgcolor: (theme) => (planLimits && workbooks.length >= planLimits.worksheetLimit ? "transparent" : alpha(theme.palette.primary.main, 0.05)),
                    },
                  }}
                  onClick={() => {
                    if (planLimits && workbooks.length >= planLimits.worksheetLimit) {
                      addNotification(`You have reached the limit of ${planLimits.worksheetLimit} isolated spreadsheets for your plan. Please upgrade to create more.`, "warning");
                      return;
                    }
                    const newWorkbookName = `Spreadsheet${workbooks.length + 1}`;
                    createWorkbookMutation.mutate({ name: newWorkbookName });
                    setShowWorkbookSelector(false);
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <TableChart sx={{ fontSize: 48, color: "text.secondary" }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Create Table
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Start a new games table
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowWorkbookSelector(false)}>Cancel</Button>
            </DialogActions>
          </Dialog>

          {/* Pagination */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              alignItems: { xs: "stretch", sm: "center" },
              gap: { xs: 2, sm: 0 },
              mt: 3,
              px: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 2, sm: 3 }, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
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

            <Box sx={{ display: "flex", gap: { xs: 2, sm: 3 }, justifyContent: { xs: "space-between", sm: "flex-start" } }}>
              <Typography variant="body2" color="text.secondary">
                Page {page + 1} of {pagination.totalPages || 1}
              </Typography>
              {selectedGames.size > 0 && (
                <Typography variant="body2" color="primary">
                  {selectedGames.size} selected
                </Typography>
              )}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: { xs: "center", sm: "flex-start" } }}>
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
        </>
      )}

      <ColumnPreferencesMenu
        open={isColumnPreferencesOpen}
        onClose={() => setIsColumnPreferencesOpen(false)}
        columns={columnMenuColumns}
        onToggleVisibility={handleToggleColumnVisibility}
        onReorder={handleReorderColumns}
        onShowAll={handleShowAllColumns}
        onDeleteColumn={handleDeleteColumn}
      />

      <CustomColumnManager open={showColumnManager} onClose={() => setShowColumnManager(false)} workbookId={selectedWorkbookId} />

      {/* ── Import Worksheet Choice Dialog ── */}
      <Dialog open={showImportChoiceDialog} onClose={() => setShowImportChoiceDialog(false)} maxWidth="xs" fullWidth disableScrollLock>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Upload fontSize="small" />
            <Typography variant="h6">Import Schedule</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Where should the imported data go?
          </Typography>
          <Stack spacing={1.5}>
            {/* New worksheet — default / recommended */}
            <Box
              onClick={() => handleViewImportNew(true)}
              sx={{
                p: 2,
                border: "2px solid",
                borderColor: "primary.main",
                borderRadius: 2,
                cursor: "pointer",
                bgcolor: (t) => t.palette.mode === "dark" ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)",
                "&:hover": { bgcolor: (t) => t.palette.mode === "dark" ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.08)" },
                transition: "background-color 0.15s",
              }}
            >
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>New Worksheet</Typography>
                <Chip label="Recommended" size="small" color="primary" sx={{ fontSize: "0.65rem", height: 18 }} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Creates a fresh isolated worksheet for this import. Keeps your existing schedule untouched.
              </Typography>
            </Box>

            {/* Merge into current */}
            <Box
              onClick={handleImportMerge}
              sx={{
                p: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
                transition: "background-color 0.15s",
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                Add to Current Worksheet
                {workbooks.find((w: any) => w.id === selectedWorkbookId)?.name && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    ({workbooks.find((w: any) => w.id === selectedWorkbookId)?.name})
                  </Typography>
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Merges the imported games into the currently open worksheet. Duplicates are detected and skipped.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button size="small" onClick={() => setShowImportChoiceDialog(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {showImportDialog && (
        <ErrorBoundary
          onError={(error) => {
            addNotification(`Import error: ${error.message}. Please check your CSV file and try again.`, "error");
            setShowImportDialog(false);
          }}
        >
          <CSVImport
            onImportComplete={handleImportComplete}
            onClose={() => {
              setShowImportDialog(false);
              // If user cancels import from View, delete the empty workbook we pre-created
              if (viewImportWorkbookId) {
                // Only delete on server and invalidate — no direct store update
                fetch(`/api/games-workbooks/${viewImportWorkbookId}`, { method: "DELETE" }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["gamesWorkbooks"] });
                });
                setViewImportWorkbookId(null);
              }
            }}
            workbookId={viewImportWorkbookId || selectedWorkbookId || undefined}
          />
        </ErrorBoundary>
      )}

      <ImportUndoButton
        onUndo={() => {
          queryClient.invalidateQueries({ queryKey: ["games"] });
          queryClient.invalidateQueries({ queryKey: ["tablePreferences", TABLE_PREFERENCES_KEY] });
          addNotification("Import undone - all imported games have been deleted", "success");
        }}
      />

      <UndoDeleteButton
        onUndo={() => {
          queryClient.invalidateQueries({ queryKey: ["games"] });
          addNotification("Delete undone - games have been restored", "success");
        }}
      />

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

      {/* Cell Content Dialog for viewing full content */}
      <CellContentDialog open={expandedCell !== null} onClose={handleCloseExpandedCell} title={expandedCell?.title || ""} content={expandedCell?.content || ""} />

      {/* Time Edit Modal */}
      {timeEditModal && <TimeEditModal open={timeEditModal.open} onClose={handleTimeModalClose} onSave={handleTimeModalSave} initialValue={timeEditModal.time} gameInfo={timeEditModal.gameInfo} />}

      {/* Conflict Detection Modal */}
      {conflictModal && (
        <ConflictDetectionModal
          open={conflictModal.open}
          onClose={handleConflictModalClose}
          conflicts={conflictModal.conflicts}
          suggestedTimes={conflictModal.suggestedTimes}
          onSelectTime={handleConflictSelectTime}
          onProceedAnyway={handleConflictProceedAnyway}
          currentTime={newGameData.time}
          sport={newGameData.sport}
          level={newGameData.level}
          date={newGameData.date}
        />
      )}

      {/* Available Dates Modal */}
      <AvailableDatesModal
        open={availableDatesModalOpen}
        onClose={() => setAvailableDatesModalOpen(false)}
        sport={newGameData.sport || undefined}
        level={newGameData.level || undefined}
        homeTeamId={newGameData.homeTeamId || undefined}
        workbookId={selectedWorkbookId}
        workbookName={workbooks.find((w: any) => w.id === selectedWorkbookId)?.name || null}
        onDateSelect={handleDateSelect}
        /**
         * Route the form's gameData through the SAME createGameMutation that
         * handles CSV-imported games. That mutation already does optimistic
         * cache insertion + preservedGameIds tracking. Anything else duplicates
         * that wiring and risks the row not showing up — which is exactly the
         * bug we kept hitting.
         */
        onSubmitGameData={async (gameData) => {
          const res = await createGameMutation.mutateAsync({
            gameData,
            // The mutation auto-syncs to calendar; that's fine for form-created games too.
            skipCalendarSync: false,
          });
          return res?.data ?? res;
        }}
        onGameCreated={() => {
          // createGameMutation.onSuccess already handled cache + preservedGameIds.
          // Just refetch as a safety net so the row survives the next full pull.
          refetch();
        }}
      />

      {/* Post Schedule Modal */}
      <Dialog
        open={postScheduleModalOpen}
        onClose={() => { setPostScheduleModalOpen(false); setPostSchedulePosted(false); }}
        maxWidth="md"
        fullWidth
        disableScrollLock
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PostAddIcon />
            <Typography variant="h6">Post Schedule</Typography>
          </Box>
          <IconButton size="small" onClick={() => { setPostScheduleModalOpen(false); setPostSchedulePosted(false); }}>
            <ChevronLeft sx={{ fontSize: "1.1rem" }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {postSchedulePosted ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "success.main", mb: 2 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Schedule Posted!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your schedule has been posted to the Schedule Exchange Board. Other ADs can now request games on your open dates.
              </Typography>
            </Box>
          ) : (
            <SchedulePostForm onPosted={() => setPostSchedulePosted(true)} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setPostScheduleModalOpen(false); setPostSchedulePosted(false); }} variant={postSchedulePosted ? "contained" : "text"}>
            {postSchedulePosted ? "Close" : "Cancel"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dismiss/Depart Modal for Bus Info/Travel columns */}
      {dismissDepartModal && (
        <DismissDepartModal
          open={dismissDepartModal.open}
          onClose={() => setDismissDepartModal(null)}
          gameId={dismissDepartModal.gameId}
          gameName={dismissDepartModal.gameName}
          currentDismissTime={dismissDepartModal.currentDismissTime}
          currentDepartTime={dismissDepartModal.currentDepartTime}
          onSave={handleSaveDismissDepartTimes}
        />
      )}

      {/* Travel Time Modal for Travel Time custom column */}
      {travelTimeModal && (
        <TravelTimeModal
          open={travelTimeModal.open}
          onClose={() => setTravelTimeModal(null)}
          gameId={travelTimeModal.gameId}
          gameName={travelTimeModal.gameName}
          columnName={travelTimeModal.columnName}
          onSave={handleSaveTravelTime}
        />
      )}

      {/* Cost Modal for Cost custom column */}
      {costModal && (
        <CostModal
          open={costModal.open}
          onClose={() => setCostModal(null)}
          gameId={costModal.gameId}
          gameName={costModal.gameName}
          currentCost={costModal.currentCost}
          onSave={handleSaveCost}
          allGamesCosts={response?.data?.games?.reduce((sum: number, game: any) => sum + (game.cost || 0), 0) || 0}
          monthlyBudget={monthlyBudget}
        />
      )}

      {/* Delete Workbook Confirmation Dialog */}
      <Dialog open={deleteWorkbookDialog?.open ?? false} onClose={() => setDeleteWorkbookDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete &quot;{deleteWorkbookDialog?.workbookName}&quot;?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteWorkbookDialog?.gameCount
              ? `This will permanently delete the worksheet and all ${deleteWorkbookDialog.gameCount} game${deleteWorkbookDialog.gameCount === 1 ? "" : "s"} inside it. This cannot be undone.`
              : "This will permanently delete the worksheet. This cannot be undone."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteWorkbookDialog(null)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (deleteWorkbookDialog) {
                handleViewDeleteWorkbook(deleteWorkbookDialog.workbookId);
                setDeleteWorkbookDialog(null);
              }
            }}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unsync Confirmation Dialog */}
      <Dialog
        open={unsyncDialogOpen}
        onClose={() => {
          setUnsyncDialogOpen(false);
          setGameToUnsync(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove from Google Calendar?</DialogTitle>
        <DialogContent>
          <DialogContentText>This will remove the game from your Google Calendar. You can always sync it again later.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUnsyncDialogOpen(false);
              setGameToUnsync(null);
            }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (gameToUnsync) {
                trackEvent("Calendar Unsync Individual Game", {
                  source: "games_table",
                  action: "unsync_from_calendar",
                  game_id: gameToUnsync,
                });
                unsyncGameMutation.mutate(gameToUnsync);
              }
              setUnsyncDialogOpen(false);
              setGameToUnsync(null);
            }}
            variant="contained"
            color="error"
            disabled={unsyncGameMutation.isPending}
          >
            {unsyncGameMutation.isPending ? <CircularProgress size={20} /> : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function getDefaultColumnOrder(customColumns: any[], preferences: TablePreferencesData | null = null): ColumnId[] {
  // Check if user has imported custom columns from CSV
  const importedColumns = preferences?.customColumns as string[] | undefined;
  const columnMapping = preferences?.columnMapping as Record<string, string> | undefined;

  // CRITICAL FIX: Extract custom column IDs for BOTH imported and default column scenarios
  const customIds = customColumns
    .map((column: any) => column?.id)
    .filter((id: string | undefined): id is string => Boolean(id))
    .map((id: string) => `custom:${id}` as ColumnId);

  if (importedColumns && columnMapping && importedColumns.length > 0) {
    // User imported CSV with custom columns
    const importedIds: ColumnId[] = [];
    let importedDateColumnId: ColumnId | null = null;

    importedColumns.forEach((colName) => {
      const mapping = columnMapping[colName];
      if (mapping && mapping !== "skip") {
        const columnId = `imported:${colName}` as ColumnId;
        if (mapping === "date") {
          // This imported column is mapped to the date field
          importedDateColumnId = columnId;
        }
        importedIds.push(columnId);
      }
    });

    // CRITICAL FIX: Use EITHER the imported date column OR default date column, never both
    const finalOrder: ColumnId[] = [];

    if (importedDateColumnId) {
      // Use the imported date column, don't add default "date"
      finalOrder.push(...importedIds);
    } else {
      // No imported date column, so include default "date"
      finalOrder.push("date", ...importedIds);
    }

    // CRITICAL FIX: Add custom columns before "actions" when user has imported columns
    finalOrder.push(...customIds, "actions");
    return finalOrder;
  }

  // No imported columns - use default column order with custom columns
  // CRITICAL: Place custom columns (including Travel Time) right before "actions"
  return ["date", "sport", "level", "opponent", "isHome", "time", "status", "location", "busTravel", "notes", ...customIds, "actions"];
}

function isColumnId(value: string): value is ColumnId {
  return STATIC_COLUMN_SEQUENCE.includes(value as StaticColumnId) || value.startsWith("custom:") || value.startsWith("imported:");
}

function deriveColumnState(previous: ColumnStateConfig[], preferences: TablePreferencesData | null, defaultOrder: ColumnId[], initialPreferencesApplied: boolean): ColumnStateConfig[] {
  const hiddenSet = new Set<ColumnId>(Array.isArray(preferences?.hidden) ? (preferences!.hidden as ColumnId[]) : []);

  // Check if user has imported columns - if so, NEVER merge default columns back in
  const hasImportedColumns: boolean = !!(preferences?.customColumns && (preferences.customColumns as string[]).length > 0);

  // CRITICAL FIX: Pass hasImportedColumns flag to normalizePreferenceOrder
  // When user has imported columns, we should NOT filter against defaultOrder
  const preferenceOrder = normalizePreferenceOrder(preferences?.order, defaultOrder, hasImportedColumns);

  // CRITICAL FIX: Always respect saved preferences order when available
  // This ensures column reordering persists across page refreshes
  let finalOrder: ColumnId[];

  if (preferenceOrder.length > 0) {
    // User has saved preferences - use them as the source of truth
    if (hasImportedColumns) {
      // CRITICAL: User has imported columns - merge ONLY new custom columns (custom:*), NOT default static columns
      // This allows new custom columns to appear while keeping imported columns intact
      const newCustomColumns = defaultOrder.filter((id) => id.startsWith("custom:") && !preferenceOrder.includes(id));
      finalOrder = [...preferenceOrder, ...newCustomColumns];
    } else {
      // No imported columns - merge with defaultOrder to include any new columns that were added
      finalOrder = mergeWithDefaultOrder(preferenceOrder, defaultOrder);
    }
  } else if (previous.length > 0) {
    // No saved preferences, but we have previous state - preserve it
    const previousOrder = previous.map((column) => column.id).filter((id) => defaultOrder.includes(id));
    if (hasImportedColumns) {
      // CRITICAL: User has imported columns - merge ONLY new custom columns (custom:*), NOT default static columns
      const newCustomColumns = defaultOrder.filter((id) => id.startsWith("custom:") && !previousOrder.includes(id));
      finalOrder = [...previousOrder, ...newCustomColumns];
    } else {
      finalOrder = mergeWithDefaultOrder(previousOrder, defaultOrder);
    }
  } else {
    // First load with no preferences - use default order (which will be imported columns if they exist)
    finalOrder = defaultOrder;
  }

  // ALWAYS enforce 'actions' as the last column, no matter how preferences were
  // merged or which new columns were appended.  When the user saves preferences
  // with 'actions' somewhere in the middle and a new custom column is added later,
  // mergeWithDefaultOrder appends the new column AFTER 'actions' — breaking the
  // invariant.  Moving 'actions' to the end here fixes every code path at once.
  const actionsIdx = finalOrder.indexOf("actions" as ColumnId);
  if (actionsIdx !== -1 && actionsIdx !== finalOrder.length - 1) {
    finalOrder.splice(actionsIdx, 1);
    finalOrder.push("actions" as ColumnId);
  }

  // Determine visibility: respect saved hidden state, otherwise default to visible
  return finalOrder.map((id) => ({
    id,
    visible: !hiddenSet.has(id),
  }));
}

function normalizePreferenceOrder(order: unknown, defaultOrder: ColumnId[], hasImportedColumns: boolean = false): ColumnId[] {
  if (!Array.isArray(order)) {
    return [];
  }

  // CRITICAL FIX: When user has imported columns, do NOT filter against defaultOrder
  // This prevents the bug where reordered custom columns get reset to default order
  if (hasImportedColumns) {
    // Just validate that all values are valid ColumnIds, don't filter against defaultOrder
    return order.map((value) => String(value) as ColumnId).filter((id) => isColumnId(id));
  }

  // For default columns, filter against defaultOrder to ensure consistency
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

  // After appending new columns, re-pin 'actions' to the very end so that any
  // column added since the last save (custom columns, AI features, etc.) always
  // appears before the Actions column, not after it.
  const actionsIdx = merged.indexOf("actions" as ColumnId);
  if (actionsIdx !== -1 && actionsIdx !== merged.length - 1) {
    merged.splice(actionsIdx, 1);
    merged.push("actions" as ColumnId);
  }

  return merged;
}
