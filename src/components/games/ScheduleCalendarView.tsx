"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Stack, Chip, CircularProgress, Paper,
  Select, MenuItem, Button, IconButton,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CalendarTodayIcon  from "@mui/icons-material/CalendarToday";
import CalendarMonthIcon  from "@mui/icons-material/CalendarMonth";
import ViewWeekIcon       from "@mui/icons-material/ViewWeek";
import HomeIcon           from "@mui/icons-material/Home";
import FlightTakeoffIcon  from "@mui/icons-material/FlightTakeoff";
import Close           from "@mui/icons-material/Close";
import VisibilityOff  from "@mui/icons-material/VisibilityOff";
import Visibility     from "@mui/icons-material/Visibility";
import { useOpponentColumnStore } from "@/lib/stores/opponentColumnStore";
import { useScheduleColumnStore, type ScheduleColumnType } from "@/lib/stores/scheduleColumnStore";
import { ScheduleMonthView } from "./ScheduleMonthView";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CalendarGame {
  id:     string;
  date:   string;
  time:   string | null;
  status: string;
  isHome: boolean;
  homeTeam: {
    name:    string;
    level:   string;
    gender?: string | null;
    sport:   { name: string };
  };
  opponent?:    { name: string } | null;
  location?:    string | null;
  customFields?: Record<string, any> | null;
  customData?:   Record<string, any> | null;
}

interface Props {
  games:      CalendarGame[];
  isLoading:  boolean;
  workbookId: string | null;
}

// ── Raw customFields accessor ─────────────────────────────────────────────────

function cf(game: CalendarGame): Record<string, any> {
  return (game.customFields ?? game.customData ?? {}) as Record<string, any>;
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

function getSportName(game: CalendarGame): string {
  const db = game.homeTeam?.sport?.name ?? "";
  if (db && db.toLowerCase() !== "general") return db;
  const raw = cf(game);
  return (((raw["Sport"] || raw["sport"]) as string | undefined) ?? db) || "Unknown";
}

function getLevel(game: CalendarGame): string {
  const db  = game.homeTeam?.level ?? "";
  const raw = cf(game);
  return (db || (raw["Level"] || raw["level"] || "") as string);
}

function getGender(game: CalendarGame): string | null {
  const dbGender = (game.homeTeam?.gender ?? "") as string;
  const teamName = game.homeTeam?.name ?? "";
  const raw      = cf(game);
  const cfTeam   = (raw["Team"] || raw["team"] || raw["Sport"] || raw["sport"] || raw["Level"] || raw["level"] || "") as string;
  const searchText = `${teamName} ${cfTeam}`;

  const resolved =
    dbGender                                                           ? dbGender
    : /\b(boys|male|mens|men\'s|m)\b/i.test(searchText)              ? "MALE"
    : /\b(girls|female|womens|women\'s|w)\b/i.test(searchText)       ? "FEMALE"
    : null;

  if (!resolved || resolved.toUpperCase() === "COED") return null;
  return resolved.toUpperCase() === "MALE"   ? "Boys"
       : resolved.toUpperCase() === "FEMALE" ? "Girls"
       : resolved;
}

function getOpponentName(
  game: CalendarGame,
  overrideColumn?: string | null
): string {
  if (overrideColumn) {
    const raw = cf(game);
    const val = raw[overrideColumn];
    if (val != null && String(val).trim()) return String(val).trim();
    return "TBD";
  }
  return game.opponent?.name || "TBD";
}

// ── Day-of-week accent colors ─────────────────────────────────────────────────

const DAY_COLORS: Record<number, string> = {
  0: "#7a87ff", // Sunday  — weekend
  1: "#6aa8d9", // Monday  — blue
  2: "#68bb82", // Tuesday — green
  3: "#e8789c", // Wednesday — pink
  4: "#f0a55c", // Thursday  — orange
  5: "#78c5e8", // Friday    — light blue
  6: "#7a87ff", // Saturday  — weekend
};

function getDayColor(isoDate: string): string {
  return DAY_COLORS[new Date(isoDate + "T00:00:00").getDay()];
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtTime(time: string | null): string {
  if (!time) return "TBD";
  const [hh, mm] = time.split(":").map(Number);
  const ap = hh >= 12 ? "PM" : "AM";
  return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${ap}`;
}

function fmtDateHeader(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00Z");
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    label:   d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    year:    d.getUTCFullYear().toString(),
  };
}

function levelLabel(lvl: string): string {
  const up = lvl.toUpperCase();
  return up === "VARSITY"  ? "Varsity"
       : up === "JV"       ? "JV"
       : up === "FRESHMAN" ? "Freshman"
       : lvl;
}

// ── Game card ──────────────────────────────────────────────────────────────────

function GameCard({
  game,
  accent,
  overrideColumn,
}: {
  game:           CalendarGame;
  accent:         string;
  overrideColumn: string | null;
}) {
  const theme     = useTheme();
  const isDark    = theme.palette.mode === "dark";
  const sport     = getSportName(game);
  const lvl       = levelLabel(getLevel(game));
  const gender    = getGender(game);
  const opponent  = getOpponentName(game, overrideColumn);
  const cancelled = game.status === "CANCELLED";

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: accent,
        opacity: cancelled ? 0.5 : 1,
        transition: "box-shadow 0.15s ease",
        "&:hover": {
          boxShadow: isDark
            ? "0 2px 14px rgba(0,0,0,0.35)"
            : `0 2px 14px ${alpha(accent, 0.25)}`,
        },
      }}
    >
      <Box sx={{ height: 3, bgcolor: accent }} />

      <Box sx={{ px: 1.5, py: 1.25 }}>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ color: accent, display: "block", mb: 0.4, fontSize: "0.68rem", letterSpacing: 0.3 }}
        >
          {fmtTime(game.time)}
        </Typography>

        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3, fontSize: "0.8rem", mb: 0.4 }}>
          {sport}
          {(gender || lvl) && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontWeight: 400 }}>
              · {[gender, lvl].filter(Boolean).join(" ")}
            </Typography>
          )}
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75, fontSize: "0.72rem" }}>
          {game.isHome ? "vs." : "@"}{" "}
          <Typography component="span" variant="caption" fontWeight={600} sx={{ fontSize: "0.72rem", color: "text.primary" }}>
            {opponent}
          </Typography>
        </Typography>

        <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
          <Chip
            size="small"
            icon={
              game.isHome
                ? <HomeIcon sx={{ fontSize: "0.65rem !important" }} />
                : <FlightTakeoffIcon sx={{ fontSize: "0.65rem !important" }} />
            }
            label={game.isHome ? "Home" : "Away"}
            sx={{
              height: 18, fontSize: "0.62rem",
              bgcolor: game.isHome
                ? alpha(theme.palette.success.main, isDark ? 0.15 : 0.1)
                : alpha(theme.palette.info.main,    isDark ? 0.15 : 0.1),
              color: game.isHome ? "success.main" : "info.main",
              "& .MuiChip-icon": { ml: "4px" },
            }}
          />
          {cancelled && (
            <Chip size="small" label="Cancelled" color="error" variant="outlined" sx={{ height: 18, fontSize: "0.62rem" }} />
          )}
        </Stack>
      </Box>
    </Paper>
  );
}

// ── Column header (desktop) ────────────────────────────────────────────────────

function ColumnHeader({ dateKey, count }: { dateKey: string; count: number }) {
  const theme  = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { weekday, label } = fmtDateHeader(dateKey);
  const accent = getDayColor(dateKey);
  return (
    <Box
      sx={{
        position:  "relative",
        px: 1.25, py: 1,
        borderRadius: "10px 10px 0 0",
        bgcolor: alpha(accent, isDark ? 0.18 : 0.1),
        textAlign: "center",
      }}
    >
      <Typography
        sx={{
          position:  "absolute",
          top: 4, right: 8,
          fontSize:  11, fontWeight: 700,
          color:     "text.disabled",
          lineHeight: 1, userSelect: "none", pointerEvents: "none",
        }}
      >
        {(() => {
          const d = new Date(dateKey + "T00:00:00Z");
          return isNaN(d.getTime()) ? "" : d.getUTCFullYear();
        })()}
      </Typography>
      <Typography variant="caption" fontWeight={700} sx={{ fontSize: "0.65rem", letterSpacing: 1.2, textTransform: "uppercase", display: "block", color: accent }}>
        {weekday}
      </Typography>
      <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>{label}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
        {count} game{count !== 1 ? "s" : ""}
      </Typography>
    </Box>
  );
}

// ── Section header (mobile) ────────────────────────────────────────────────────

function SectionHeader({ dateKey, count }: { dateKey: string; count: number }) {
  const theme  = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { weekday, label } = fmtDateHeader(dateKey);
  const accent = getDayColor(dateKey);
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1.5}
      sx={{ px: 1.5, py: 1, bgcolor: alpha(accent, isDark ? 0.18 : 0.1), position: "relative" }}
    >
      <Typography
        sx={{
          position: "absolute",
          top: 4,
          right: 8,
          fontSize: 11,
          fontWeight: 700,
          color: "text.disabled",
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {(() => {
          const d = new Date(dateKey + "T00:00:00Z");
          return isNaN(d.getTime()) ? "" : d.getUTCFullYear();
        })()}
      </Typography>
      <Box sx={{ width: 42, height: 42, borderRadius: "8px", bgcolor: accent, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Typography sx={{ fontSize: "0.52rem", fontWeight: 700, lineHeight: 1, letterSpacing: 0.8, textTransform: "uppercase" }}>{weekday}</Typography>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, lineHeight: 1.1 }}>{label.split(" ")[1]}</Typography>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>{weekday}, {label}</Typography>
        <Typography variant="caption" color="text.secondary">{count} game{count !== 1 ? "s" : ""}</Typography>
      </Box>
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type BannerColumnType = "opponent" | ScheduleColumnType;

const BANNER_LABELS: Record<BannerColumnType, string> = {
  opponent: "Opponent",
  time:     "Time",
  location: "Location",
};

export function ScheduleCalendarView({ games, isLoading, workbookId }: Props) {
  const { overrides, setOverride, setColumnRegistry } = useOpponentColumnStore();
  const overrideColumn = workbookId ? (overrides[workbookId] ?? null) : null;

  const { overrides: scheduleOverrides, setOverride: setScheduleOverride } = useScheduleColumnStore();
  const scheduleOverridesForWb: Partial<Record<ScheduleColumnType, string>> = workbookId ? (scheduleOverrides[workbookId] ?? {}) : {};

  const [monthView, setMonthView] = useState(false);

  // ── Persistent banner visibility (per workbook, stored in localStorage) ──
  const bannerHiddenKey = workbookId ? `calendar-banner-hidden-${workbookId}` : null;
  const [bannerHidden, setBannerHidden] = useState<boolean>(() => {
    if (typeof window === "undefined" || !workbookId) return false;
    return localStorage.getItem(`calendar-banner-hidden-${workbookId}`) === "true";
  });

  const toggleBannerHidden = useCallback(() => {
    setBannerHidden((prev) => {
      const next = !prev;
      if (bannerHiddenKey) {
        try { localStorage.setItem(bannerHiddenKey, String(next)); } catch {}
      }
      return next;
    });
  }, [bannerHiddenKey]);

  // Sync state when workbook changes
  useEffect(() => {
    if (!workbookId) { setBannerHidden(false); return; }
    try {
      setBannerHidden(localStorage.getItem(`calendar-banner-hidden-${workbookId}`) === "true");
    } catch { setBannerHidden(false); }
  }, [workbookId]);

  // ── Per-column-type banner dismissed state ──
  const [dismissedBanners, setDismissedBanners] = useState<Set<BannerColumnType>>(new Set());
  const [activePill, setActivePill] = useState<BannerColumnType | null>(null);

  // Per-column selected value in the dropdown
  const [selectedCols, setSelectedCols] = useState<Record<BannerColumnType, string>>({
    opponent: "",
    time:     "",
    location: "",
  });

  useEffect(() => {
    if (!workbookId) {
      setDismissedBanners(new Set());
      setActivePill(null);
      setSelectedCols({ opponent: "", time: "", location: "" });
      return;
    }
    const dismissed = new Set<BannerColumnType>();
    (["opponent", "time", "location"] as BannerColumnType[]).forEach((t) => {
      if (localStorage.getItem(`dismissed-col-banner-${t}-${workbookId}`) === "true") dismissed.add(t);
    });
    setDismissedBanners(dismissed);
    setActivePill(null);
    setSelectedCols({
      opponent: overrideColumn ?? "",
      time:     scheduleOverridesForWb.time     ?? "",
      location: scheduleOverridesForWb.location ?? "",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbookId]);

  useEffect(() => {
    setSelectedCols((prev) => ({ ...prev, opponent: overrideColumn ?? "" }));
  }, [overrideColumn]);

  const availableCustomColumns = useMemo(() => {
    const keys = new Set<string>();
    for (const game of games) {
      const raw = cf(game);
      Object.keys(raw).forEach((k) => keys.add(k));
    }
    return Array.from(keys).sort();
  }, [games]);

  useEffect(() => {
    if (workbookId && availableCustomColumns.length > 0) {
      setColumnRegistry(workbookId, availableCustomColumns);
    }
  }, [workbookId, availableCustomColumns, setColumnRegistry]);

  // ── Detect TBD columns ──
  const hasTBDOpponents = useMemo(() => {
    if (!workbookId || overrideColumn || !games.length) return false;
    return games.filter((g) => !g.opponent?.name).length > 5;
  }, [games, workbookId, overrideColumn]);

  const hasTBDTimes = useMemo(() => {
    if (!workbookId || scheduleOverridesForWb.time || !games.length) return false;
    return games.filter((g) => !g.time).length > 3;
  }, [games, workbookId, scheduleOverridesForWb.time]);

  const hasTBDLocations = useMemo(() => {
    if (!workbookId || scheduleOverridesForWb.location || !games.length) return false;
    return games.filter((g) => !g.location).length > 3;
  }, [games, workbookId, scheduleOverridesForWb.location]);

  // Which column types have active issues (not dismissed, not synced)
  const activeBannerTypes = useMemo<BannerColumnType[]>(() => {
    const types: BannerColumnType[] = [];
    if (hasTBDOpponents && !dismissedBanners.has("opponent")) types.push("opponent");
    if (hasTBDTimes     && !dismissedBanners.has("time"))     types.push("time");
    if (hasTBDLocations && !dismissedBanners.has("location")) types.push("location");
    if (overrideColumn)                                        { if (!types.includes("opponent")) types.push("opponent"); }
    if (scheduleOverridesForWb.time)                           { if (!types.includes("time"))     types.push("time"); }
    if (scheduleOverridesForWb.location)                       { if (!types.includes("location")) types.push("location"); }
    return types;
  }, [hasTBDOpponents, hasTBDTimes, hasTBDLocations, dismissedBanners, overrideColumn, scheduleOverridesForWb]);

  // Auto-select active pill when types change
  useEffect(() => {
    setActivePill((prev) => {
      if (prev && activeBannerTypes.includes(prev)) return prev;
      return activeBannerTypes[0] ?? null;
    });
  }, [activeBannerTypes]);

  const handleDismiss = useCallback((type: BannerColumnType) => {
    if (workbookId) {
      localStorage.setItem(`dismissed-col-banner-${type}-${workbookId}`, "true");
    }
    setDismissedBanners((prev) => new Set([...prev, type]));
  }, [workbookId]);

  const handleSync = useCallback((type: BannerColumnType) => {
    const col = selectedCols[type];
    if (!workbookId || !col) return;
    if (type === "opponent") {
      setOverride(workbookId, col);
    } else {
      setScheduleOverride(workbookId, type, col);
    }
  }, [workbookId, selectedCols, setOverride, setScheduleOverride]);

  // ── Grouping logic ──

  const groupedByDate = useMemo(() => {
    const map = new Map<string, CalendarGame[]>();
    for (const g of games) {
      const key = g.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    map.forEach((arr) =>
      arr.sort((a, b) => (!a.time ? 1 : !b.time ? -1 : a.time.localeCompare(b.time)))
    );
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [games]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const showBannerSection = !isLoading && games.length > 0 && !!workbookId && activeBannerTypes.length > 0 && !bannerHidden;

  // Derive synced column for the active pill
  const activeSyncedCol =
    activePill === "opponent" ? overrideColumn
    : activePill             ? (scheduleOverridesForWb[activePill as ScheduleColumnType] ?? null)
    : null;

  const BANNER_DESCRIPTIONS: Record<BannerColumnType, { tbd: string; synced: string }> = {
    opponent: {
      tbd:    "Team names showing as TBD? Map your CSV opponent column to this view.",
      synced: `Showing opponent names from "${activeSyncedCol}". Update the mapped column if needed.`,
    },
    time: {
      tbd:    "Game times showing as TBD? Map your CSV time column to fix this.",
      synced: `Using time values from "${activeSyncedCol}". Update the mapped column if needed.`,
    },
    location: {
      tbd:    "Locations missing? Map your CSV location/venue column to populate this field.",
      synced: `Using location values from "${activeSyncedCol}". Update the mapped column if needed.`,
    },
  };

  return (
    <>
      {/* ── View toggle ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        {/* Restore chip — only when banner is hidden and would otherwise be shown */}
        {bannerHidden && !isLoading && games.length > 0 && !!workbookId && activeBannerTypes.length > 0 ? (
          <Chip
            icon={<Visibility sx={{ fontSize: "13px !important" }} />}
            label="Show Column Setup"
            size="small"
            variant="outlined"
            onClick={toggleBannerHidden}
            sx={{ cursor: "pointer", fontSize: "0.72rem", color: "text.secondary" }}
          />
        ) : (
          <Box />
        )}

        <Stack direction="row" alignItems="center" gap={0.75}>
          <Chip
            icon={<ViewWeekIcon sx={{ fontSize: "14px !important" }} />}
            label="Week"
            size="small"
            variant={monthView ? "outlined" : "filled"}
            onClick={() => setMonthView(false)}
            sx={{ cursor: "pointer", fontWeight: monthView ? 400 : 700, fontSize: "0.75rem" }}
          />
          <Chip
            icon={<CalendarMonthIcon sx={{ fontSize: "14px !important" }} />}
            label="Month"
            size="small"
            variant={monthView ? "filled" : "outlined"}
            onClick={() => setMonthView(true)}
            sx={{ cursor: "pointer", fontWeight: monthView ? 700 : 400, fontSize: "0.75rem" }}
          />
        </Stack>
      </Stack>

      {monthView ? (
        <ScheduleMonthView games={games} overrideColumn={overrideColumn} />
      ) : groupedByDate.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <CalendarTodayIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography variant="body1">No games to display. Import a schedule to get started.</Typography>
        </Box>
      ) : (
      <>
      {/* ── Multi-column correction banners ── */}
      {showBannerSection && activePill && (
        <Box sx={{ mb: 2 }}>
          {/* Pill selectors — switch between column types */}
          {activeBannerTypes.length > 1 && (
            <Stack direction="row" gap={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
              {activeBannerTypes.map((type) => {
                const isSynced =
                  type === "opponent" ? !!overrideColumn
                  : !!(scheduleOverridesForWb[type as ScheduleColumnType]);
                return (
                  <Chip
                    key={type}
                    label={BANNER_LABELS[type]}
                    size="small"
                    variant={activePill === type ? "filled" : "outlined"}
                    color={isSynced ? "success" : "warning"}
                    onClick={() => setActivePill(type)}
                    sx={{ cursor: "pointer", fontWeight: activePill === type ? 700 : 400 }}
                  />
                );
              })}
            </Stack>
          )}

          {/* Active banner */}
          {(() => {
            const isSynced = !!activeSyncedCol;
            const desc     = BANNER_DESCRIPTIONS[activePill];
            const colVal   = selectedCols[activePill];
            const currentOverride =
              activePill === "opponent" ? overrideColumn
              : (scheduleOverridesForWb[activePill as ScheduleColumnType] ?? null);
            const isDismissable = !isSynced;

            return (
              <Box
                sx={{
                  display: "flex",
                  alignItems: { xs: "flex-start", sm: "center" },
                  flexDirection: { xs: "column", sm: "row" },
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    isSynced
                      ? alpha(theme.palette.info.light, 0.1)
                      : alpha(theme.palette.warning.light, 0.12),
                  border: "1px solid",
                  borderColor: isSynced ? "info.light" : "warning.light",
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: isSynced ? "info.dark" : "warning.dark" }}>
                    {isSynced ? `✓ ${BANNER_LABELS[activePill]} column synced` : `${BANNER_LABELS[activePill]} showing as TBD?`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isSynced ? desc.synced : desc.tbd}
                  </Typography>
                </Box>
                <Select
                  size="small"
                  value={colVal}
                  onChange={(e) =>
                    setSelectedCols((prev) => ({ ...prev, [activePill]: e.target.value as string }))
                  }
                  displayEmpty={!isSynced}
                  sx={{ minWidth: 200 }}
                >
                  {!isSynced && (
                    <MenuItem value="" disabled>
                      Select a column…
                    </MenuItem>
                  )}
                  {availableCustomColumns.map((col) => (
                    <MenuItem key={col} value={col}>
                      {col}
                    </MenuItem>
                  ))}
                </Select>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleSync(activePill)}
                  disabled={!colVal || colVal === currentOverride}
                >
                  {isSynced ? "Update" : "Save"}
                </Button>
                {isDismissable && (
                  <IconButton size="small" onClick={() => handleDismiss(activePill)} aria-label="Dismiss this banner">
                    <Close fontSize="small" />
                  </IconButton>
                )}
                <IconButton size="small" onClick={toggleBannerHidden} aria-label="Hide column setup banner" title="Hide column setup">
                  <VisibilityOff fontSize="small" />
                </IconButton>
              </Box>
            );
          })()}
        </Box>
      )}

      {/* ── Mobile / Tablet (< md) ── */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        {groupedByDate.map(([key, dayGames]) => {
          const accent = getDayColor(key);
          return (
            <Box
              key={key}
              sx={(theme) => ({
                mb:           2,
                borderRadius: "10px",
                border:       "1px solid",
                borderColor:  alpha(accent, theme.palette.mode === "dark" ? 0.3 : 0.2),
                overflow:     "hidden",
              })}
            >
              <SectionHeader dateKey={key} count={dayGames.length} />
              <Box sx={{ height: "1px", bgcolor: alpha(accent, 0.25) }} />
              <Box sx={{ p: 1, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                {dayGames.map((g) => (
                  <GameCard key={g.id} game={g} accent={accent} overrideColumn={overrideColumn} />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* ── Desktop (≥ md) — horizontal scrollable columns ── */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          gap: 1.5,
          overflowX: "auto",
          overflowY: "visible",
          pb: 2,
          alignItems: "flex-start",
          "&::-webkit-scrollbar":       { height: 6 },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
          "&::-webkit-scrollbar-thumb": { borderRadius: 3, bgcolor: "action.disabled" },
        }}
      >
        {groupedByDate.map(([key, dayGames]) => {
          const accent = getDayColor(key);
          return (
            <Box
              key={key}
              sx={(theme) => ({
                width:        230,
                flexShrink:   0,
                borderRadius: "10px",
                border:       "1px solid",
                borderColor:  alpha(accent, theme.palette.mode === "dark" ? 0.3 : 0.2),
                overflow:     "hidden",
              })}
            >
              <ColumnHeader dateKey={key} count={dayGames.length} />
              {/* Thin accent line separating header from cards */}
              <Box sx={{ height: "1px", bgcolor: alpha(accent, 0.25) }} />
              <Stack spacing={1} sx={{ p: 1 }}>
                {dayGames.map((g) => (
                  <GameCard key={g.id} game={g} accent={accent} overrideColumn={overrideColumn} />
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>
      </>
      )}
    </>
  );
}
