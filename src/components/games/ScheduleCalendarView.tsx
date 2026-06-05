"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Stack, Chip, CircularProgress, Paper,
  Select, MenuItem, Button, IconButton,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import HomeIcon          from "@mui/icons-material/Home";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import Close from "@mui/icons-material/Close";
import { useOpponentColumnStore } from "@/lib/stores/opponentColumnStore";

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
  const cfTeam   = (raw["Team"] || raw["team"] || "") as string;

  const resolved =
    dbGender                                  ? dbGender
    : /boys/i.test(teamName || cfTeam)        ? "MALE"
    : /girls/i.test(teamName || cfTeam)       ? "FEMALE"
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
          {gender && (
            <Typography component="span" variant="body2" fontWeight={700} sx={{ fontSize: "0.8rem" }}>
              {gender}{" "}
            </Typography>
          )}
          {sport}
          {lvl && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontWeight: 400 }}>
              · {lvl}
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
  const { weekday, label, year } = fmtDateHeader(dateKey);
  const accent = getDayColor(dateKey);
  return (
    <Box
      sx={{
        position: "relative",
        mb: 1.5, px: 1.25, py: 1,
        borderRadius: "10px",
        border: "1px solid",
        borderColor: accent,
        bgcolor: "rgb(24 27 56 / 3%)",
        textAlign: "center",
      }}
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
  const { weekday, label, year } = fmtDateHeader(dateKey);
  const accent = getDayColor(dateKey);
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1.5}
      sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: "10px", bgcolor: "rgb(24 27 56 / 3%)", border: "1px solid", borderColor: accent, position: "relative" }}
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

export function ScheduleCalendarView({ games, isLoading, workbookId }: Props) {
  const { overrides, setOverride, setColumnRegistry } = useOpponentColumnStore();
  const overrideColumn = workbookId ? (overrides[workbookId] ?? null) : null;

  // ── Opponent-column banner state ──

  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [selectedCol, setSelectedCol] = useState<string>("");

  useEffect(() => {
    if (!workbookId) {
      setBannerDismissed(false);
      return;
    }
    setBannerDismissed(localStorage.getItem(`dismissed-opponent-banner-${workbookId}`) === "true");
    setSelectedCol("");
  }, [workbookId]);

  useEffect(() => {
    if (overrideColumn) setSelectedCol(overrideColumn);
  }, [overrideColumn]);

  const availableCustomColumns = useMemo(() => {
    const keys = new Set<string>();
    for (const game of games) {
      const raw = cf(game);
      Object.keys(raw).forEach((k) => keys.add(k));
    }
    return Array.from(keys).sort();
  }, [games]);

  // Sync column registry whenever games / workbook change
  useEffect(() => {
    if (workbookId && availableCustomColumns.length > 0) {
      setColumnRegistry(workbookId, availableCustomColumns);
    }
  }, [workbookId, availableCustomColumns, setColumnRegistry]);

  const hasTBDOpponents = useMemo(() => {
    if (!workbookId || overrideColumn || !games.length) return false;
    const tbdCount = games.filter((g) => !g.opponent?.name).length;
    return tbdCount > 5;
  }, [games, workbookId, overrideColumn]);

  const handleDismiss = useCallback(() => {
    if (workbookId) {
      localStorage.setItem(`dismissed-opponent-banner-${workbookId}`, "true");
    }
    setBannerDismissed(true);
  }, [workbookId]);

  const handleSync = useCallback(() => {
    if (workbookId && selectedCol) {
      setOverride(workbookId, selectedCol);
    }
  }, [workbookId, selectedCol, setOverride]);

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

  if (groupedByDate.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
        <CalendarTodayIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
        <Typography variant="body1">No games to display. Import a schedule to get started.</Typography>
      </Box>
    );
  }

  const showBannerWarning = !overrideColumn && hasTBDOpponents && !bannerDismissed;
  const showBannerSynced = !!overrideColumn;
  const showBannerSection = !isLoading && games.length > 0 && !!workbookId;

  return (
    <>
      {/* ── Opponent column banner ── */}
      {showBannerSection && (
        <>
          {/* Unsynced – warning state */}
          {showBannerWarning && (
            <Box
              sx={{
                display: "flex",
                alignItems: { xs: "flex-start", sm: "center" },
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
                p: 2,
                mb: 2,
                borderRadius: 2,
                bgcolor: (theme) => alpha(theme.palette.warning.light, 0.12),
                border: "1px solid",
                borderColor: "warning.light",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Team names showing as TBD?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Use the select menu to correspond your csv team columns with this view.
                </Typography>
              </Box>
              <Select
                size="small"
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value as string)}
                displayEmpty
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="" disabled>
                  Select a column…
                </MenuItem>
                {availableCustomColumns.map((col) => (
                  <MenuItem key={col} value={col}>
                    {col}
                  </MenuItem>
                ))}
              </Select>
              <Button variant="contained" size="small" onClick={handleSync} disabled={!selectedCol}>
                Save
              </Button>
              <IconButton size="small" onClick={handleDismiss} aria-label="Dismiss">
                <Close fontSize="small" />
              </IconButton>
            </Box>
          )}

          {/* Synced – info state */}
          {showBannerSynced && (
            <Box
              sx={{
                display: "flex",
                alignItems: { xs: "flex-start", sm: "center" },
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
                p: 2,
                mb: 2,
                borderRadius: 2,
                bgcolor: (theme) => alpha(theme.palette.info.light, 0.1),
                border: "1px solid",
                borderColor: "info.light",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "info.dark" }}>
                  ✓ Column synced
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Showing opponent names from <strong>{overrideColumn}</strong>. Update the mapped column below if needed.
                </Typography>
              </Box>
              <Select
                size="small"
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value as string)}
                sx={{ minWidth: 200 }}
              >
                {availableCustomColumns.map((col) => (
                  <MenuItem key={col} value={col}>
                    {col}
                  </MenuItem>
                ))}
              </Select>
              <Button
                variant="contained"
                size="small"
                onClick={handleSync}
                disabled={!selectedCol || selectedCol === overrideColumn}
              >
                Update
              </Button>
            </Box>
          )}
        </>
      )}

      {/* ── Mobile / Tablet (< md) ── */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        {groupedByDate.map(([key, dayGames]) => (
          <Box key={key} sx={{ mb: 3 }}>
            <SectionHeader dateKey={key} count={dayGames.length} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              {dayGames.map((g) => (
                <GameCard key={g.id} game={g} accent={getDayColor(key)} overrideColumn={overrideColumn} />
              ))}
            </Box>
          </Box>
        ))}
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
        {groupedByDate.map(([key, dayGames]) => (
          <Box key={key} sx={{ width: 230, flexShrink: 0 }}>
            <ColumnHeader dateKey={key} count={dayGames.length} />
            <Stack spacing={1}>
              {dayGames.map((g) => (
                <GameCard key={g.id} game={g} accent={getDayColor(key)} overrideColumn={overrideColumn} />
              ))}
            </Stack>
          </Box>
        ))}
      </Box>
    </>
  );
}
