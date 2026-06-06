"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Tooltip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { Search, AutoAwesome, EventAvailable, AddCircleOutline, DragIndicator, Settings, Close, ExpandMore, ArrowBack, CalendarMonth } from "@mui/icons-material";
import { format } from "date-fns";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import Draggable from "react-draggable";
import { alpha } from "@mui/material/styles";
import SchoolAddressAutocomplete from "@/components/forms/SchoolAddressAutocomplete";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AvailableDatesModalProps {
  open: boolean;
  onClose: () => void;
  sport?: string;
  level?: string;
  /** Already-resolved homeTeamId from the parent table. When provided the form
   *  skips the client-side team lookup entirely and uses this value directly. */
  homeTeamId?: string;
  workbookId?: string | null;
  /** Display name of the active worksheet — shown in the Add form's context row
   *  so the user can verify which worksheet they're writing into. */
  workbookName?: string | null;
  onDateSelect?: (date: Date, sport?: string, level?: string) => void;
  onGameCreated?: (game: any) => void;
  /**
   * Optional parent-owned submit hook. When provided, the modal hands the
   * fully-built gameData to the parent and lets the parent's existing
   * createGameMutation handle the POST + cache insertion. This guarantees the
   * new row uses the SAME code path as CSV-imported games (which already
   * appear correctly), instead of the modal duplicating that logic.
   *
   * Must return the created game row (or null on failure).
   */
  onSubmitGameData?: (gameData: any) => Promise<any>;
}

interface ClusterMatch {
  sport: string;
  gender: string;
  level: string;
  confidence: number;
}

interface DebugInfo {
  parsedTokens: string[];
  matchedClusters: ClusterMatch[];
  clusterDates: string[];
  excludedClusters?: ClusterMatch[];
  excludedClusterDates?: string[];
  notes: string[];
  excludedDays?: string[];
  weekdaysIncluded?: string[];
  weekOfMonthFilter?: number;
  dateRange?: { start?: string; end?: string; month?: string; months?: string[] };
  minSpacing?: number;
  interpretation?: string;
  recommendation?: string;
  parseMethod?: string;
}

interface AvailableDatesResult {
  recommendations: string[];
  debug: DebugInfo;
  aiQuotaExceeded?: boolean;
  parseMethod?: string;
}

interface AddDateContext {
  dateStr: string;
  sport: string;
  level: string;
  gender: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDateDisplay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "EEE, MMM d, yyyy");
  } catch {
    return dateStr;
  }
};

/** Normalize a column name to a lowercase no-punctuation key for matching */
const normalizeColName = (s: string) => s.toLowerCase().replace(/[\s_\-\/\.]+/g, "");

/**
 * Aliases for the "opponent" / "away team" worksheet column.
 * Anything in this set is treated as the opponent column when backfilling.
 * Add new spellings here, not in the resolver — keeps both call sites in sync.
 */
const OPPONENT_ALIASES = new Set([
  "opponent",
  "opponents",
  "vs",
  "vsteam",
  "awayteam",
  "away",
  "otherteam",
  "otherteams",
  "challenger",
  "visitor",
  "visitors",
  "visitingteam",
  "enemy",
  "theirteam",
  "competitor",
  "opposing",
  "opposingteam",
]);

/**
 * Aliases for the HOME TEAM column (column whose value is the AD's own
 * school/team name). Distinct from the home/away INDICATOR — see
 * HOME_AWAY_ALIASES below.
 */
const HOME_TEAM_ALIASES = new Set([
  "hometeam",
  "mainteam",
  "ourteam",
  "ourteams",
  "ourschool",
  "myteam",
  "myschool",
  "school",
  "schoolname",
  "team1",
  "host",
  "hostteam",
  // Broader informal names the user may call their own team
  "team",
  "squad",
  "gang",
  "peeps",
]);

/**
 * Aliases for the home/away INDICATOR column (value is "Home"/"Away").
 * Note: bare "home" is intentionally listed here, not in HOME_TEAM_ALIASES.
 * A column literally named "Home" in the wild is overwhelmingly the indicator
 * (paired with an "Away" column) rather than the team name. Users who want
 * auto-fill of the home team's name should label the column "Home Team",
 * "Main Team", "Our Team", etc.
 */
const HOME_AWAY_ALIASES = new Set(["home", "homeaway", "ishome"]);

/** Column names (normalized) that map to core game fields — not shown as extra custom fields */
const STANDARD_FIELD_KEYS = new Set([
  "date",
  "time",
  "gametime",
  "starttime",
  "sport",
  "level",
  "gender",
  "team",
  ...OPPONENT_ALIASES,
  "location",
  "venue",
  "site",
  "fieldsite",
  "notes",
  "note",
  "comments",
  "info",
  "status",
  "gamestatus",
  ...HOME_AWAY_ALIASES,
  ...HOME_TEAM_ALIASES,
]);

/** Map a normalized column name to the standard game form field it represents */
function resolveStandardField(col: string): string | null {
  const key = normalizeColName(col);
  if (["time", "gametime", "starttime"].includes(key)) return "time";
  if (OPPONENT_ALIASES.has(key)) return "opponent";
  if (["location", "venue", "site", "fieldsite"].includes(key)) return "location";
  if (["notes", "note", "comments", "info"].includes(key)) return "notes";
  if (["status", "gamestatus"].includes(key)) return "status";
  if (HOME_AWAY_ALIASES.has(key)) return "isHome";
  if (HOME_TEAM_ALIASES.has(key)) return "homeTeam";
  return null;
}

/** Convert a YYYY-MM-DD string to a UTC ISO timestamp */
function dateStrToUTC(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

// ── Draggable paper ───────────────────────────────────────────────────────────

function DraggablePaper(props: any) {
  const nodeRef = React.useRef(null);
  return (
    <Draggable handle="#draggable-dialog-title" cancel={'[class*="MuiDialogContent-root"]'} nodeRef={nodeRef}>
      <Paper {...props} ref={nodeRef} />
    </Draggable>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

const GAME_STATUSES = ["SCHEDULED", "CONFIRMED", "CANCELLED", "POSTPONED"];

// ── Component ─────────────────────────────────────────────────────────────────

export const AvailableDatesModal: React.FC<AvailableDatesModalProps> = ({
  open,
  onClose,
  sport,
  level,
  homeTeamId: homeTeamIdProp,
  workbookId,
  workbookName,
  onDateSelect,
  onGameCreated,
  onSubmitGameData,
}) => {
  // ── Search view state ────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AvailableDatesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excludeDays, setExcludeDays] = useState<number[]>([]);
  const [maxResults, setMaxResults] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [showConfiguration, setShowConfiguration] = useState<boolean>(false);
  const [showMatchedTeamsAlert, setShowMatchedTeamsAlert] = useState(true);

  // ── Add-date form state ──────────────────────────────────────────────────
  const [view, setView] = useState<"search" | "addForm">("search");
  const [addDateCtx, setAddDateCtx] = useState<AddDateContext | null>(null);
  /** All editable form field values keyed by (normalised) column name */
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  /** Worksheet columns fetched from the API (union of CustomColumn names + imported CSV keys) */
  const [worksheetColumns, setWorksheetColumns] = useState<string[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  /**
   * Map of CustomColumn.name → CustomColumn.id for this workbook.
   *
   * The GamesTable reads user-defined worksheet columns from `customData[col.id]`
   * (keyed by ID) and imported CSV columns from `customFields[col.name]` (keyed by name).
   * We need this map so on submit we can route each value to the correct location —
   * otherwise CustomColumn values get saved to `customFields` and never display in the
   * table (because the table looks them up by ID, not name).
   */
  const [customColumnIdByName, setCustomColumnIdByName] = useState<Record<string, string>>({});

  /**
   * The AD's own school name — used to auto-fill the "Home Team" / "Main Team"
   * worksheet column on submit so the user doesn't have to type their own
   * school's name into every game. Fetched on form open. Mascot/team name is
   * deliberately NOT included; if the user wants the mascot they edit before
   * submitting.
   */
  const [homeSchoolName, setHomeSchoolName] = useState<string>("");

  useEffect(() => {
    if (view !== "addForm") return;
    if (homeSchoolName) return;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.schoolName && typeof data.schoolName === "string") {
          setHomeSchoolName(data.schoolName.trim());
        }
      })
      .catch(() => {
        /* non-fatal — the column just stays empty if profile fetch fails */
      });
  }, [view, homeSchoolName]);

  // ── Pre-fill prompt ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open && (sport || level) && !prompt) {
      setPrompt(`Find available dates for ${sport || ""} ${level || ""}`.trim());
    }
  }, [open, sport, level]);

  // Reset to search view when dialog closes
  useEffect(() => {
    if (!open) {
      setView("search");
      setAddDateCtx(null);
      setFieldValues({});
      setFormError(null);
      setFormSuccess(false);
      setCustomColumnIdByName({});
      setWorksheetColumns([]);
    }
  }, [open]);

  // Fetch worksheet columns whenever we enter the add-form view.
  //
  // We fetch from TWO endpoints in parallel:
  //   1. /api/calendar/workbook-columns → union of column NAMES (CustomColumn.name + customFields keys)
  //   2. /api/organizations/custom-columns → CustomColumn records with { id, name }
  //
  // The second is what lets us know which displayed columns are CustomColumn-defined
  // (and therefore need to be saved into `customData[col.id]` not `customFields[col.name]`).
  useEffect(() => {
    if (view !== "addForm" || !workbookId) return;
    setColumnsLoading(true);

    Promise.all([
      fetch(`/api/calendar/workbook-columns?workbookId=${workbookId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/organizations/custom-columns?workbookId=${workbookId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([colsRes, customColsRes]) => {
        if (colsRes?.columns) setWorksheetColumns(colsRes.columns as string[]);

        // Build name → id map for CustomColumn rows (scoped to this workbook or global)
        const map: Record<string, string> = {};
        const records: any[] = customColsRes?.data || [];
        for (const c of records) {
          if (c?.name && c?.id) map[c.name] = c.id;
        }
        setCustomColumnIdByName(map);
      })
      .finally(() => setColumnsLoading(false));
  }, [view, workbookId]);

  // ── Search handlers ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError("Please enter a search prompt");
      return;
    }
    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const effectivePrompt = selectedMonth > 0
      ? `${prompt.trim()} in ${MONTH_NAMES[selectedMonth - 1]}`
      : prompt.trim();
    setLoading(true);
    setError(null);
    setResult(null);
    trackEvent("Available Dates - Search Started", {
      prompt: effectivePrompt,
      sport,
      level,
      source: "games_table",
      excludeDays: excludeDays.length > 0 ? excludeDays : undefined,
      year: selectedYear,
      month: selectedMonth > 0 ? selectedMonth : undefined,
    });
    try {
      const response = await fetch("/api/games/find-available-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: effectivePrompt,
          excludeDays: excludeDays.length > 0 ? excludeDays : undefined,
          maxResults,
          year: selectedYear,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to find available dates");
      setResult(data);
      setShowMatchedTeamsAlert(true);
      trackEvent("Available Dates - Search Completed", {
        prompt: effectivePrompt,
        sport,
        level,
        datesFound: data.recommendations.length,
        source: "games_table",
        year: selectedYear,
        month: selectedMonth > 0 ? selectedMonth : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred";
      setError(msg);
      trackEvent("Available Dates - Search Failed", {
        prompt: effectivePrompt,
        sport,
        level,
        error: msg,
        source: "games_table",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (dateStr: string) => {
    if (onDateSelect) {
      const date = new Date(dateStr + "T00:00:00");
      onDateSelect(date, sport, level);
      trackEvent("Available Dates - Date Selected", {
        selectedDate: dateStr,
        sport,
        level,
        source: "games_table",
      });
    }
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    if (result) {
      setResult(null);
      setError(null);
    }
  };

  const handleDayToggle = (_event: React.MouseEvent<HTMLElement>, newExcludeDays: number[]) => {
    setExcludeDays(newExcludeDays);
    if (result) {
      setResult(null);
      setError(null);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    if (result) {
      setResult(null);
      setError(null);
    }
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    if (result) {
      setResult(null);
      setError(null);
    }
  };

  const generateYearOptions = () => {
    const y = new Date().getFullYear();
    return [y, y + 1, y + 2];
  };

  // ── Add-date form handlers ────────────────────────────────────────────────

  const handleOpenAddForm = useCallback(
    (dateStr: string, clusters: ClusterMatch[]) => {
      const first = clusters[0];
      const ctx: AddDateContext = {
        dateStr,
        sport: first?.sport || sport || "",
        level: first?.level || level || "",
        gender: first?.gender || "",
      };
      setAddDateCtx(ctx);
      // Seed form with pre-populated standard field defaults
      setFieldValues({ status: "SCHEDULED", isHome: "home" });
      setFormError(null);
      setFormSuccess(false);
      setView("addForm");
    },
    [sport, level],
  );

  const setField = (col: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [col]: value }));
  };

  /** Submit the Add Date form — resolves team then POSTs to /api/games */
  const handleFormSubmit = async () => {
    if (!addDateCtx) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const { dateStr, sport: sportName, level: levelName } = addDateCtx;

      // ── 0. workbookId guard ───────────────────────────────────────────
      // The GamesTable query filters by workbookId — a row created without
      // one (or against the wrong worksheet) would never appear in the active
      // view. Snapshot the prop at submit time so a worksheet switch mid-flow
      // can't redirect the write to a different worksheet.
      const targetWorkbookId = workbookId || null;
      if (!targetWorkbookId) {
        throw new Error("No worksheet is currently selected. Open the worksheet you want to add this game to, then try again.");
      }

      // ── 1. homeTeamId ─────────────────────────────────────────────────
      // Fast path: the parent table passes down the already-resolved team ID.
      // When that isn't available we do a single GET /api/teams lookup.
      // We never create teams/sports here — that would produce wrong data.
      let resolvedHomeTeamId: string | null = homeTeamIdProp || null;

      if (!resolvedHomeTeamId) {
        if (!sportName || !levelName) {
          throw new Error("Sport and level are required. Select a sport in the Game Center row first, then use Find Dates.");
        }

        const normLevel = (l: string): string => {
          const s = l.toLowerCase().trim();
          if (["jv", "j.v.", "junior var", "jr varsity"].includes(s)) return "junior varsity";
          if (["v", "var"].includes(s)) return "varsity";
          return s;
        };

        const teamsRes = await fetch("/api/teams");
        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          const targetSport = sportName.toLowerCase();
          const targetLevel = normLevel(levelName);
          const match = (teamsData.data || teamsData || []).find((t: any) => {
            const tSport = (t.sport?.name || "").toLowerCase();
            const sportMatches = tSport === targetSport || tSport.includes(targetSport) || targetSport.includes(tSport);
            const levelMatches = normLevel(t.level || "") === targetLevel;
            return sportMatches && levelMatches;
          });
          if (match) resolvedHomeTeamId = match.id;
        }

        if (!resolvedHomeTeamId) {
          throw new Error(`No team found for "${sportName} – ${levelName}". ` + "Create a game from the main form first to register that team, then try again.");
        }
      }

      // ── 2. opponentId (optional) ──────────────────────────────────────
      let opponentId: string | null = null;
      const opponentName = (fieldValues["opponent"] || "").trim();
      if (opponentName) {
        const oppRes = await fetch("/api/opponents");
        if (oppRes.ok) {
          const oppData = await oppRes.json();
          const existing = (oppData.data || oppData || []).find((o: any) => o.name.toLowerCase() === opponentName.toLowerCase());
          if (existing) {
            opponentId = existing.id;
          } else {
            const createRes = await fetch("/api/opponents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: opponentName }),
            });
            if (createRes.ok) {
              const od = await createRes.json();
              opponentId = od.data?.id || od.id;
            }
          }
        }
      }

      // ── 3. Map fieldValues → game fields ─────────────────────────────
      //
      // Worksheet columns split into TWO storage locations:
      //   • customData[colId]   ← for CustomColumn-defined columns (UI keys them by ID)
      //   • customFields[name]  ← for imported CSV columns (UI keys them by name)
      // Routing by the customColumnIdByName map ensures values land where the
      // GamesTable will actually read them back.
      const customFields: Record<string, string> = {};
      const customData: Record<string, string> = {};
      let time: string | null = null;
      let location: string | null = null;
      let notes: string | null = null;
      let status = fieldValues["status"] || "SCHEDULED";
      let isHome = fieldValues["isHome"] !== "away";

      for (const [col, val] of Object.entries(fieldValues)) {
        if (!val?.trim()) continue;
        const stdField = resolveStandardField(col);
        if (stdField === "time") {
          time = val.trim();
          continue;
        }
        if (stdField === "location") {
          location = val.trim();
          continue;
        }
        if (stdField === "notes") {
          notes = val.trim();
          continue;
        }
        if (stdField === "status") {
          status = val.trim();
          continue;
        }
        if (stdField === "isHome") {
          isHome = val !== "away";
          continue;
        }
        if (stdField === "opponent") continue; // handled above
        if (!STANDARD_FIELD_KEYS.has(normalizeColName(col))) {
          const customColId = customColumnIdByName[col];
          if (customColId) {
            // User-defined CustomColumn → stored by ID in customData
            customData[customColId] = val.trim();
          } else {
            // Imported CSV column → stored by name in customFields
            customFields[col] = val.trim();
          }
        }
      }

      // ── 3b. Backfill the canonical worksheet columns ────────────────────
      //
      // The form filters Sport / Level / Gender / Date / Team out of the
      // editable inputs (they're shown read-only in the context row at the
      // top). But the GamesTable RENDERS those columns by reading
      // `customFields[colName]` — so unless we write them here, the new row
      // appears with blank Sport/Level/Gender/Date cells even though we have
      // the values right there in addDateCtx.
      //
      // We use the exact column-name spelling from the worksheet (worksheet
      // column "Sport" vs custom column "sport" matter because the table
      // looks up by name). For each match we route to the right storage
      // (customData by ID for CustomColumns, customFields by name otherwise).
      const writeWorksheetValue = (col: string, value: string) => {
        if (!value) return;
        // Skip if the user already typed something for this column.
        const existing = fieldValues[col]?.trim();
        if (existing) return;
        const customColId = customColumnIdByName[col];
        if (customColId) {
          customData[customColId] = value;
        } else {
          customFields[col] = value;
        }
      };

      // Format date for worksheet "Date" column — match the most common
      // imported style (YYYY-MM-DD). The table's date column reads from
      // game.date directly, but the imported "Date" column (if it exists)
      // reads from customFields["Date"], so we backfill both.
      const dateForWorksheet = dateStr; // already YYYY-MM-DD

      for (const col of worksheetColumns) {
        const norm = normalizeColName(col);
        if (norm === "sport" && sportName) writeWorksheetValue(col, sportName);
        else if (norm === "level" && levelName) writeWorksheetValue(col, levelName);
        else if (norm === "gender" && addDateCtx.gender) writeWorksheetValue(col, addDateCtx.gender);
        else if (norm === "date") writeWorksheetValue(col, dateForWorksheet);
        else if (norm === "team" && sportName && levelName) {
          // Best-effort team label: "<Gender> <Level> <Sport>" trimmed.
          const teamLabel = [addDateCtx.gender, levelName, sportName].filter(Boolean).join(" ").trim();
          if (teamLabel) writeWorksheetValue(col, teamLabel);
        } else if (OPPONENT_ALIASES.has(norm) && opponentName) {
          // Route the typed opponent into ANY column the worksheet considers
          // the "opponent" — opponent / vs / away team / challenger / visitor /
          // other team / etc. The standard-field resolver pulled the value into
          // the canonical opponent relation; this mirrors it into the imported
          // column so the table cell isn't empty.
          writeWorksheetValue(col, opponentName);
        } else if (HOME_TEAM_ALIASES.has(norm) && homeSchoolName) {
          // Auto-fill the home-team column with the AD's school name. The
          // mascot/team-nickname is intentionally NOT appended — the user
          // asked for the school name only.
          writeWorksheetValue(col, homeSchoolName);
        } else if (norm === "time" && time) {
          writeWorksheetValue(col, time);
        } else if (norm === "location" && location) {
          writeWorksheetValue(col, location);
        } else if (norm === "status" && status) {
          writeWorksheetValue(col, status);
        } else if (HOME_AWAY_ALIASES.has(norm)) {
          writeWorksheetValue(col, isHome ? "Home" : "Away");
        } else if (norm === "notes" && notes) {
          writeWorksheetValue(col, notes);
        }
      }

      // ── 4. Build gameData payload ─────────────────────────────────────
      const gameData = {
        date: dateStrToUTC(dateStr),
        time,
        homeTeamId: resolvedHomeTeamId,
        isHome,
        opponentId,
        status,
        location,
        notes,
        customData,
        customFields,
        // Pinned to the worksheet that was active when the user clicked Submit.
        workbookId: targetWorkbookId,
      };

      // ── 5. Submit via parent's mutation (preferred) or direct POST ────
      //
      // The parent (GamesTable) supplies `onSubmitGameData` so the same
      // createGameMutation that handles CSV imports also handles this. That
      // mutation already does the optimistic cache insert + preservedGameIds
      // bookkeeping correctly — duplicating it here led to rows that never
      // appeared. If no parent hook is wired up we fall back to a direct
      // POST so the modal still works in isolation.
      let createdGame: any = null;
      if (onSubmitGameData) {
        createdGame = await onSubmitGameData(gameData);
      } else {
        const gameRes = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gameData),
        });
        if (!gameRes.ok) {
          const e = await gameRes.json();
          throw new Error(e.error || "Failed to create game");
        }
        const createdData = await gameRes.json();
        createdGame = createdData?.data ?? createdData;
      }

      // Guard: confirm a real game row came back before declaring success.
      if (!createdGame?.id) {
        throw new Error("Game was not created. Please try again.");
      }

      setFormSuccess(true);
      onGameCreated?.(createdGame);

      // Mark this date as taken — drop it from the available list so the user
      // can't re-add it from the same search results panel. The "Available
      // Dates (N)" counter updates automatically since it reads .length.
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recommendations: prev.recommendations.filter((d) => d !== dateStr),
          debug: {
            ...prev.debug,
            clusterDates: prev.debug.clusterDates?.filter((d) => d !== dateStr) ?? prev.debug.clusterDates,
          },
        };
      });

      trackEvent("Available Dates - Game Created", {
        dateStr,
        sport: sportName,
        level: levelName,
        source: "find_dates_modal",
      });

      setTimeout(() => {
        setView("search");
        setFormSuccess(false);
      }, 1500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Extra worksheet columns that aren't already handled by standard form fields
  const extraColumns = worksheetColumns.filter(
    (col) =>
      !STANDARD_FIELD_KEYS.has(normalizeColName(col)) &&
      normalizeColName(col) !== "sport" &&
      normalizeColName(col) !== "level" &&
      normalizeColName(col) !== "date" &&
      normalizeColName(col) !== "gender" &&
      normalizeColName(col) !== "team",
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableScrollLock
      PaperComponent={DraggablePaper}
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: "90vh",
        },
      }}
    >
      {/* ── Title ── */}
      <DialogTitle id="draggable-dialog-title" sx={{ cursor: "move", userSelect: "none" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <DragIndicator sx={{ color: "text.secondary", fontSize: 20 }} />
          {view === "search" ? <AutoAwesome sx={{ color: "primary.main", fontSize: 28 }} /> : <CalendarMonth sx={{ color: "primary.main", fontSize: 28 }} />}
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {view === "search" ? "Find Available Dates" : "Add Game to Schedule"}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, ml: 5 }}>
          {view === "search"
            ? "Use natural language to find open dates • Drag to move"
            : addDateCtx
              ? `${formatDateDisplay(addDateCtx.dateStr)} · ${addDateCtx.sport} ${addDateCtx.level}`
              : "Fill in the details below"}
        </Typography>
      </DialogTitle>

      {/* ── Content ── */}
      <DialogContent>
        {view === "search" ? (
          /* ── Search view ────────────────────────────────────────────────── */
          <Stack spacing={3}>
            <Stack spacing={3}>
              {/* Search Input */}
              <Box>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="e.g., 'Find me open dates for Girls Varsity Soccer'"
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  variant="outlined"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Try: "Find open dates for B V Basketball"
                </Typography>
              </Box>

              {/* Configuration Accordion */}
              <Accordion
                expanded={showConfiguration}
                onChange={() => setShowConfiguration(!showConfiguration)}
                sx={{
                  boxShadow: "none",
                  "&:before": { display: "none" },
                  "&.Mui-expanded": { margin: 0 },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  aria-controls="configuration-content"
                  id="configuration-header"
                  sx={{
                    minHeight: 56,
                    "&.Mui-expanded": { minHeight: 56 },
                    borderRadius: 1,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                    "&:hover": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Settings sx={{ color: "primary.main", fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Search Settings
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0, pt: 2 }}>
                  <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {/* Year Filter */}
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                        Year
                      </Typography>
                      <FormControl size="small" fullWidth>
                        <Select value={selectedYear} onChange={(e) => handleYearChange(e.target.value as number)} disabled={loading}>
                          {generateYearOptions().map((year) => (
                            <MenuItem key={year} value={year}>
                              {year}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Select the year to search through all 12 months
                      </Typography>
                    </Box>

                    {/* Month Filter */}
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                        Month (Optional)
                      </Typography>
                      <FormControl size="small" fullWidth>
                        <Select value={selectedMonth} onChange={(e) => handleMonthChange(e.target.value as number)} disabled={loading}>
                          <MenuItem value={0}>All months</MenuItem>
                          {["January","February","March","April","May","June","July","August","September","October","November","December"].map((name, i) => (
                            <MenuItem key={i + 1} value={i + 1}>{name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Narrow results to a specific month
                      </Typography>
                    </Box>

                    {/* Exclude Days Filter */}
                    <Box sx={{ flex: 2, minWidth: 250 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                        Exclude Days (Optional)
                      </Typography>
                      <ToggleButtonGroup
                        value={excludeDays}
                        onChange={handleDayToggle}
                        aria-label="exclude days of week"
                        size="small"
                        disabled={loading}
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.5,
                          "& .MuiToggleButton-root": {
                            borderRadius: 1,
                            px: 1.5,
                            py: 0.5,
                            textTransform: "none",
                            border: "1px solid",
                            borderColor: "divider",
                            "&.Mui-selected": {
                              bgcolor: "error.light",
                              color: "error.dark",
                              borderColor: "error.main",
                              "&:hover": { bgcolor: "error.main", color: "white" },
                            },
                          },
                        }}
                      >
                        {DAYS_OF_WEEK.map((day) => (
                          <ToggleButton key={day.value} value={day.value} aria-label={day.label}>
                            {day.label}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Click to exclude days from the search results
                      </Typography>
                    </Box>
                  </Box>

                  {/* Number of Results */}
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      Number of Results
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={maxResults}
                        onChange={(e) => {
                          setMaxResults(e.target.value as number);
                          if (result) {
                            setResult(null);
                            setError(null);
                          }
                        }}
                        disabled={loading}
                      >
                        <MenuItem value={10}>10 dates</MenuItem>
                        <MenuItem value={25}>25 dates</MenuItem>
                        <MenuItem value={50}>50 dates</MenuItem>
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Maximum number of dates to display
                    </Typography>
                  </Box>

                  {/* AI Info Banner */}
                  {result?.aiQuotaExceeded ? (
                    <Alert severity="warning" icon={<AutoAwesome />} sx={{ borderRadius: 2 }}>
                      <Typography variant="body2">Opletics is experiencing AI token usage at a high volume.</Typography>
                    </Alert>
                  ) : (
                    <Alert severity="info" icon={<AutoAwesome />} sx={{ borderRadius: 2 }}>
                      <Typography variant="body2">
                        <strong>AI-Powered Search:</strong> Use natural language to find dates with constraints like "in December", "at least 3 days apart", or "not on same days as other teams"
                      </Typography>
                    </Alert>
                  )}
                </AccordionDetails>
              </Accordion>
            </Stack>

            {/* Loading */}
            {loading && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary">
                  Analyzing your schedule and finding available dates...
                </Typography>
              </Box>
            )}

            {/* Error */}
            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {/* Results */}
            {result && !loading && (
              <>
                <Divider />

                {/* AI Interpretation */}
                {!result.aiQuotaExceeded && (result.debug.interpretation || result.debug.recommendation) && (
                  <Alert
                    severity="success"
                    icon={<AutoAwesome />}
                    sx={{
                      borderRadius: 2,
                      bgcolor: (theme) => (theme.palette.mode === "dark" ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.success.main, 0.05)),
                      "& .MuiAlert-message": { width: "100%" },
                    }}
                  >
                    {result.debug.interpretation && (
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: result.debug.recommendation ? 0.5 : 0 }}>
                        {result.debug.interpretation}
                      </Typography>
                    )}
                    {result.debug.recommendation && (
                      <Typography variant="body2" sx={{ fontStyle: "italic", color: "text.primary" }}>
                        "{result.debug.recommendation}"
                      </Typography>
                    )}
                  </Alert>
                )}

                {/* Matched Teams Banner */}
                {result.debug.matchedClusters.length > 0 && showMatchedTeamsAlert && (
                  <Alert
                    severity="info"
                    icon={<EventAvailable />}
                    sx={{ borderRadius: 2 }}
                    action={
                      <IconButton size="small" aria-label="close" color="inherit" onClick={() => setShowMatchedTeamsAlert(false)}>
                        <Close fontSize="small" />
                      </IconButton>
                    }
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                      Matched Teams:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {result.debug.matchedClusters.slice(0, 3).map((cluster, idx) => (
                        <Chip key={idx} label={`${cluster.gender} ${cluster.level} ${cluster.sport}`} size="small" color="primary" variant="outlined" />
                      ))}
                      {result.debug.matchedClusters.length > 3 && <Chip label={`+${result.debug.matchedClusters.length - 3} more`} size="small" variant="outlined" />}
                    </Stack>
                  </Alert>
                )}

                {/* No-team global scan */}
                {result.debug.matchedClusters.length === 0 && result.recommendations.length > 0 && (
                  <Alert severity="info" icon={<EventAvailable />} sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Showing dates with no games scheduled (all teams)
                    </Typography>
                  </Alert>
                )}

                {/* Excluded Days */}
                {result.debug.excludedDays && result.debug.excludedDays.length > 0 && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Excluding: {result.debug.excludedDays.join(", ")}
                    </Typography>
                  </Alert>
                )}

                {/* Weekday Inclusion */}
                {result.debug.weekdaysIncluded && result.debug.weekdaysIncluded.length > 0 && (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                      Showing only:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {result.debug.weekdaysIncluded.map((day, idx) => (
                        <Chip key={idx} label={day} size="small" color="primary" variant="outlined" />
                      ))}
                    </Stack>
                  </Alert>
                )}

                {/* Date Cards */}
                {result.recommendations.length > 0 ? (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                      Available Dates ({result.recommendations.length})
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 2.5,
                        maxHeight: "350px",
                        overflowY: "auto",
                        pr: 0.5,
                        p: 1,
                      }}
                    >
                      {result.recommendations.map((dateStr, index) => {
                        const date = new Date(dateStr + "T00:00:00");
                        const isWeekday = date.getDay() !== 0 && date.getDay() !== 6;

                        return (
                          <Paper
                            key={index}
                            elevation={0}
                            sx={(theme) => ({
                              p: "10px 16px",
                              bgcolor: theme.palette.mode === "dark" ? "#081417ed" : "success.lighter",
                              border: "1px solid",
                              borderColor: theme.palette.mode === "dark" ? "rgb(79, 109, 165)" : "#272D60",
                              borderRadius: 1.5,
                              display: "flex",
                              flexDirection: "column",
                              gap: 0.75,
                              minHeight: "90px",
                            })}
                          >
                            {/* Date */}
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", lineHeight: 1.3 }}>
                              {formatDateDisplay(dateStr)}
                            </Typography>

                            {/* Weekday chip */}
                            {isWeekday && (
                              <Chip
                                label="Weekday"
                                size="small"
                                sx={{
                                  alignSelf: "flex-start",
                                  height: 16,
                                  fontSize: "0.6rem",
                                  bgcolor: "#272D60",
                                  color: "white",
                                  "& .MuiChip-label": { px: 0.75, py: 0 },
                                }}
                              />
                            )}

                            {/* Add Date button — replaces matched-teams text */}
                            <Box sx={{ mt: "auto" }}>
                              <Tooltip title="Add to schedule">
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<AddCircleOutline sx={{ fontSize: 14 }} />}
                                  fullWidth
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAddForm(dateStr, result.debug.matchedClusters);
                                  }}
                                  sx={(theme) => ({
                                    fontSize: "0.7rem",
                                    py: 0.4,
                                    px: 1,
                                    textTransform: "none",
                                    fontWeight: 600,
                                    ...(theme.palette.mode === "dark" && {
                                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                      color: "#fff",
                                      "&:hover": {
                                        background: "linear-gradient(135deg, #5568d3 0%, #653a8b 100%)",
                                      },
                                    }),
                                  })}
                                >
                                  Add Date
                                </Button>
                              </Tooltip>
                            </Box>
                          </Paper>
                        );
                      })}
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        No Available Dates Found
                      </Typography>
                      {result.debug.notes.some((n) => n.startsWith("No team specified")) ? (
                        <Typography variant="body2">No open dates found in the specified period. All dates in this range are occupied.</Typography>
                      ) : (
                        <Typography variant="body2">Try narrowing your search by being more specific using fewer words.</Typography>
                      )}
                      {result.debug.notes.length > 0 && (
                        <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                          {result.debug.notes.join(" • ")}
                        </Typography>
                      )}
                    </Alert>
                  </Box>
                )}
              </>
            )}
          </Stack>
        ) : (
          /* ── Add Game Form view ──────────────────────────────────────────── */
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            {formSuccess ? (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Game added successfully!
                </Typography>
                <Typography variant="body2">Returning to results…</Typography>
              </Alert>
            ) : (
              <>
                {formError && (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {formError}
                  </Alert>
                )}

                {/* Pre-populated read-only context row */}
                <Box
                  sx={(theme) => ({
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: theme.palette.mode === "dark" ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    display: "flex",
                    gap: 2,
                    flexWrap: "wrap",
                    alignItems: "center",
                  })}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                      Date
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {addDateCtx ? formatDateDisplay(addDateCtx.dateStr) : "—"}
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                      Sport
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {addDateCtx?.sport || "—"}
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                      Level
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {addDateCtx?.level || "—"}
                    </Typography>
                  </Box>
                  {(workbookName || workbookId) && (
                    <>
                      <Divider orientation="vertical" flexItem />
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                          Worksheet
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {workbookName || "—"}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>

                {!workbookId && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      No worksheet selected
                    </Typography>
                    <Typography variant="body2">Open the worksheet you want to add this game to before submitting — the new row needs a worksheet to appear in the table.</Typography>
                  </Alert>
                )}

                {/* Standard game fields */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  {/* Opponent */}
                  <TextField label="Opponent" size="small" fullWidth value={fieldValues["opponent"] || ""} onChange={(e) => setField("opponent", e.target.value)} placeholder="e.g. Lincoln High" />

                  {/* Time */}
                  <TextField
                    label="Time"
                    size="small"
                    fullWidth
                    value={fieldValues["time"] || ""}
                    onChange={(e) => setField("time", e.target.value)}
                    placeholder="e.g. 7:00 PM"
                    helperText="e.g. 7:00 PM or 3:30 PM"
                  />

                  {/* Home / Away */}
                  <FormControl size="small" fullWidth>
                    <InputLabel>Home / Away</InputLabel>
                    <Select label="Home / Away" value={fieldValues["isHome"] || "home"} onChange={(e) => setField("isHome", e.target.value)}>
                      <MenuItem value="home">Home</MenuItem>
                      <MenuItem value="away">Away</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Status */}
                  <FormControl size="small" fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={fieldValues["status"] || "SCHEDULED"} onChange={(e) => setField("status", e.target.value)}>
                      {GAME_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Location — full width. Google Places autocomplete with
                      manual-entry fallback (the underlying component already
                      gracefully degrades to free text when the Places API is
                      unavailable). freeSolo mode means whatever the user types
                      is preserved even if no prediction matches. */}
                  <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
                    <SchoolAddressAutocomplete
                      value={fieldValues["location"] || ""}
                      onChange={(value) => setField("location", value)}
                      label="Location"
                      placeholder="e.g. Main Gym, 123 Main St, or pick from suggestions"
                      size="small"
                    />
                  </Box>

                  {/* Notes — full width */}
                  <TextField
                    label="Notes"
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    sx={{ gridColumn: { sm: "1 / -1" } }}
                    value={fieldValues["notes"] || ""}
                    onChange={(e) => setField("notes", e.target.value)}
                  />
                </Box>

                {/* Worksheet-specific extra columns */}
                {columnsLoading && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">
                      Loading worksheet columns…
                    </Typography>
                  </Box>
                )}

                {extraColumns.length > 0 && (
                  <>
                    <Divider>
                      <Typography variant="caption" color="text.secondary">
                        Worksheet Columns
                      </Typography>
                    </Divider>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        gap: 2,
                      }}
                    >
                      {extraColumns.map((col) => (
                        <TextField key={col} label={col} size="small" fullWidth value={fieldValues[col] || ""} onChange={(e) => setField(col, e.target.value)} />
                      ))}
                    </Box>
                  </>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      {/* ── Actions ── */}
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {view === "search" ? (
          <>
            <Button onClick={onClose} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>
              Close
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Search />}
              disabled={loading || !prompt.trim()}
              sx={{
                textTransform: "none",
                borderRadius: 2,
              }}
            >
              {loading ? "Searching..." : "Find Dates"}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setView("search")} variant="outlined" startIcon={<ArrowBack />} disabled={formSubmitting} sx={{ textTransform: "none", borderRadius: 2 }}>
              Back
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              onClick={handleFormSubmit}
              variant="contained"
              startIcon={formSubmitting ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutline />}
              disabled={formSubmitting || formSuccess}
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              {formSubmitting ? "Adding…" : "Add to Schedule"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
