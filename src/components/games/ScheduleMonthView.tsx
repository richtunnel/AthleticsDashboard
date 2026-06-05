"use client";

import { useMemo, useState } from "react";
import {
  Box, Typography, Stack, IconButton, Chip, Tooltip, Paper,
  Select, MenuItem,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import ChevronLeftIcon  from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon        from "@mui/icons-material/Today";
import HomeIcon         from "@mui/icons-material/Home";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import type { CalendarGame } from "./ScheduleCalendarView";

// ── Helpers ────────────────────────────────────────────────────────────────────

function cf(game: CalendarGame): Record<string, any> {
  return (game.customFields ?? game.customData ?? {}) as Record<string, any>;
}

function getSportName(game: CalendarGame): string {
  const db = game.homeTeam?.sport?.name ?? "";
  if (db && db.toLowerCase() !== "general") return db;
  const raw = cf(game);
  return ((raw["Sport"] || raw["sport"]) as string | undefined) ?? (db || "Unknown");
}

function getOpponentName(game: CalendarGame, overrideColumn?: string | null): string {
  if (overrideColumn) {
    const val = cf(game)[overrideColumn];
    if (val != null && String(val).trim()) return String(val).trim();
    return "TBD";
  }
  return game.opponent?.name || "TBD";
}

const DAY_COLORS: Record<number, string> = {
  0: "#7a87ff",
  1: "#6aa8d9",
  2: "#68bb82",
  3: "#e8789c",
  4: "#f0a55c",
  5: "#78c5e8",
  6: "#7a87ff",
};

function getDayColor(dayOfWeek: number): string {
  return DAY_COLORS[dayOfWeek] ?? "#7a87ff";
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/** Returns ISO date string YYYY-MM-DD for a local Date */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  games:          CalendarGame[];
  overrideColumn: string | null;
}

// ── Game pill inside a day cell ────────────────────────────────────────────────

function GamePill({
  game,
  dayOfWeek,
  overrideColumn,
}: {
  game:           CalendarGame;
  dayOfWeek:      number;
  overrideColumn: string | null;
}) {
  const theme     = useTheme();
  const isDark    = theme.palette.mode === "dark";
  const accent    = getDayColor(dayOfWeek);
  const sport     = getSportName(game);
  const opponent  = getOpponentName(game, overrideColumn);
  const cancelled = game.status === "CANCELLED";

  let timeStr = "";
  if (game.time) {
    const [hh, mm] = game.time.split(":").map(Number);
    timeStr = `${hh % 12 || 12}:${String(mm).padStart(2, "0")}${hh >= 12 ? "p" : "a"}`;
  }

  return (
    <Tooltip
      title={
        <Box sx={{ fontSize: "0.75rem", lineHeight: 1.6 }}>
          <strong>{sport}</strong>
          <br />{game.isHome ? "vs." : "@"} {opponent}
          {game.time && <><br />{timeStr}</>}
          {cancelled && <><br /><em>Cancelled</em></>}
        </Box>
      }
      placement="top"
      arrow
    >
      <Box
        sx={{
          display:        "flex",
          alignItems:     "center",
          gap:            0.4,
          px:             0.75,
          py:             "2px",
          mb:             "2px",
          borderRadius:   "4px",
          bgcolor:        alpha(accent, isDark ? 0.25 : 0.15),
          borderLeft:     `3px solid ${accent}`,
          opacity:        cancelled ? 0.45 : 1,
          cursor:         "default",
          overflow:       "hidden",
          minWidth:       0,
        }}
      >
        {game.isHome
          ? <HomeIcon sx={{ fontSize: 9, color: accent, flexShrink: 0 }} />
          : <FlightTakeoffIcon sx={{ fontSize: 9, color: accent, flexShrink: 0 }} />
        }
        <Typography
          noWrap
          sx={{
            fontSize:   "0.67rem",
            fontWeight: 600,
            color:      isDark ? alpha(accent, 0.9) : accent,
            lineHeight: 1.4,
            flex:       1,
            minWidth:   0,
          }}
        >
          {timeStr ? `${timeStr} · ` : ""}{sport}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// ── Main Month View ────────────────────────────────────────────────────────────

export function ScheduleMonthView({ games, overrideColumn }: Props) {
  const theme  = useTheme();
  const isDark = theme.palette.mode === "dark";

  const today = new Date();
  const todayKey = toDateKey(today);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // Group games by date key
  const gamesByDate = useMemo(() => {
    const map = new Map<string, CalendarGame[]>();
    for (const g of games) {
      const key = g.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    // Sort each day's games by time
    map.forEach((arr) =>
      arr.sort((a, b) => (!a.time ? 1 : !b.time ? -1 : a.time.localeCompare(b.time)))
    );
    return map;
  }, [games]);

  // Build the grid: first cell = Sunday of the week containing the 1st of the month
  const gridDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startDow     = firstOfMonth.getDay(); // 0=Sun
    const start        = new Date(firstOfMonth);
    start.setDate(start.getDate() - startDow);

    const days: Date[] = [];
    const d = new Date(start);
    // Always show 6 weeks (42 cells) for a stable height
    for (let i = 0; i < 42; i++) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";

  // Year range: 5 years back, 5 years forward
  const yearOptions = useMemo(() => {
    const base = today.getFullYear();
    return Array.from({ length: 11 }, (_, i) => base - 5 + i);
  }, []);

  return (
    <Box>
      {/* ── Month navigation header ── */}
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
        <IconButton size="small" onClick={prevMonth} sx={{ color: "text.secondary" }}>
          <ChevronLeftIcon />
        </IconButton>

        {/* "June 2026" — two plain-text selects, no arrows, no underline */}
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            variant="standard"
            disableUnderline
            IconComponent={() => null}
            sx={{
              fontWeight: 700,
              fontSize: "1rem",
              "& .MuiSelect-select, & .MuiSelect-standard": {
                py: 0, pl: 0, pr: "0 !important", cursor: "pointer",
              },
            }}
          >
            {MONTH_NAMES.map((name, i) => (
              <MenuItem key={name} value={i} sx={{ fontSize: "0.875rem" }}>{name}</MenuItem>
            ))}
          </Select>
          <Select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            variant="standard"
            disableUnderline
            IconComponent={() => null}
            sx={{
              fontWeight: 700,
              fontSize: "1rem",
              "& .MuiSelect-select, & .MuiSelect-standard": {
                py: 0, pl: 0, pr: "0 !important", cursor: "pointer",
              },
            }}
          >
            {yearOptions.map((y) => (
              <MenuItem key={y} value={y} sx={{ fontSize: "0.875rem" }}>{y}</MenuItem>
            ))}
          </Select>
        </Stack>

        <IconButton size="small" onClick={nextMonth} sx={{ color: "text.secondary" }}>
          <ChevronRightIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <Chip
          icon={<TodayIcon sx={{ fontSize: "14px !important" }} />}
          label="Today"
          size="small"
          variant="outlined"
          onClick={goToday}
          sx={{ cursor: "pointer", fontWeight: 500, fontSize: "0.75rem" }}
        />
      </Stack>

      {/* ── Calendar grid ── */}
      <Paper
        elevation={0}
        sx={{
          border:       "1px solid",
          borderColor,
          borderRadius: 2,
          overflow:     "hidden",
        }}
      >
        {/* Day-of-week header row */}
        <Box
          sx={{
            display:     "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          {WEEKDAY_LABELS.map((d, i) => (
            <Box
              key={d}
              sx={{
                py:         0.75,
                textAlign:  "center",
                bgcolor:    alpha(getDayColor(i), isDark ? 0.1 : 0.06),
                borderRight: i < 6 ? `1px solid ${borderColor}` : "none",
              }}
            >
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  fontSize:      "0.65rem",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color:         getDayColor(i),
                }}
              >
                {d}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Day cells — 6 rows of 7 */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {gridDays.map((day, idx) => {
            const key        = toDateKey(day);
            const isCurrentMonth = day.getMonth() === viewMonth;
            const isToday    = key === todayKey;
            const dow        = day.getDay();
            const accent     = getDayColor(dow);
            const dayGames   = gamesByDate.get(key) ?? [];
            const MAX_SHOWN  = 3;
            const overflow   = dayGames.length > MAX_SHOWN ? dayGames.length - MAX_SHOWN : 0;
            const shown      = dayGames.slice(0, MAX_SHOWN);
            const isLastInRow = (idx + 1) % 7 === 0;
            const isLastRow  = idx >= 35;

            return (
              <Box
                key={key}
                sx={{
                  minHeight:    96,
                  p:            "4px 4px 4px 4px",
                  borderRight:  !isLastInRow ? `1px solid ${borderColor}` : "none",
                  borderBottom: !isLastRow   ? `1px solid ${borderColor}` : "none",
                  bgcolor:      isCurrentMonth
                    ? (isDark ? "transparent" : "background.paper")
                    : (isDark ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.018)"),
                  transition:   "background-color 0.15s",
                }}
              >
                {/* Date number */}
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: "3px", pr: "2px" }}>
                  <Box
                    sx={{
                      width:  22, height: 22,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%",
                      bgcolor: isToday ? accent : "transparent",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize:   "0.72rem",
                        fontWeight: isToday ? 800 : (isCurrentMonth ? 600 : 400),
                        color:      isToday
                          ? "#fff"
                          : isCurrentMonth
                          ? "text.primary"
                          : "text.disabled",
                        lineHeight: 1,
                      }}
                    >
                      {day.getDate()}
                    </Typography>
                  </Box>
                </Box>

                {/* Game pills */}
                {shown.map((g) => (
                  <GamePill
                    key={g.id}
                    game={g}
                    dayOfWeek={dow}
                    overrideColumn={overrideColumn}
                  />
                ))}
                {overflow > 0 && (
                  <Typography
                    sx={{
                      fontSize:   "0.62rem",
                      color:      "text.secondary",
                      fontWeight: 600,
                      pl:         "4px",
                      mt:         "1px",
                    }}
                  >
                    +{overflow} more
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
