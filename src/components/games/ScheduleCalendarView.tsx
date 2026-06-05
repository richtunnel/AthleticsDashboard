"use client";

import { useMemo, useState } from "react";
import {
  Box, Typography, Stack, Chip, CircularProgress, Paper,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import HomeIcon          from "@mui/icons-material/Home";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import { useOpponentColumnStore } from "@/lib/stores/opponentColumnStore";
import { AwayTeamColumnSelector } from "./AwayTeamColumnSelector";

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

// ── Expanded opponent keyword list ────────────────────────────────────────────
// We try every common variation before giving up and showing TBD.

const OPPONENT_KEYS = [
  // Exact common names
  "Opponent", "opponent", "OPPONENT",
  "Away", "away", "AWAY",
  "Visitor", "visitor", "VISITOR",
  "Away Team", "away team", "Away_Team",
  "Opposing Team", "opposing team",
  "Other Team", "other team",
  "Road Team", "road team",
  "Visiting Team", "visiting team",
  "VS", "Vs", "vs", "vs.",
  "Versus", "versus",
  "Rival", "rival",
  "Opp", "opp",
  "Competition", "competition",
  "Against", "against",
  "Away School", "away school",
  "Opponent School", "opponent school",
  "Opponent Name", "opponent name",
  "Away Name", "away name",
];

function findOpponentInCF(raw: Record<string, any>): string | null {
  // 1. Exact key matches (fastest path)
  for (const key of OPPONENT_KEYS) {
    if (raw[key] != null && String(raw[key]).trim()) return String(raw[key]).trim();
  }
  // 2. Case-insensitive substring scan on all keys
  const oppSubstrings = ["opponent", "away", "visitor", "vs", "versus", "rival", "road", "opp", "opposing"];
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== "string") continue;
    const kl = key.toLowerCase();
    if (oppSubstrings.some((kw) => kl.includes(kw))) return val.trim();
  }
  return null;
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
  // 1. User-specified column override (from AwayTeamColumnSelector)
  if (overrideColumn) {
    const raw = cf(game);
    const val = raw[overrideColumn];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  // 2. Relational opponent (properly imported)
  if (game.opponent?.name) return game.opponent.name;
  // 3. Expanded keyword scan across customFields
  const found = findOpponentInCF(cf(game));
  return found ?? "TBD";
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
  const d = new Date(isoDate + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    label:   d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    year:    d.getFullYear().toString(),
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
      {/* Year — top right */}
      <Typography
        sx={{
          position: "absolute", top: 5, right: 8,
          fontSize: "0.6rem", fontWeight: 700,
          color: "text.disabled", lineHeight: 1,
        }}
      >
        {year}
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
      <Box sx={{ width: 42, height: 42, borderRadius: "8px", bgcolor: accent, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Typography sx={{ fontSize: "0.52rem", fontWeight: 700, lineHeight: 1, letterSpacing: 0.8, textTransform: "uppercase" }}>{weekday}</Typography>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, lineHeight: 1.1 }}>{label.split(" ")[1]}</Typography>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>{weekday}, {label}</Typography>
        <Typography variant="caption" color="text.secondary">{count} game{count !== 1 ? "s" : ""}</Typography>
      </Box>
      {/* Year — top right */}
      <Typography sx={{ position: "absolute", top: 5, right: 10, fontSize: "0.6rem", fontWeight: 700, color: "text.disabled" }}>
        {year}
      </Typography>
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScheduleCalendarView({ games, isLoading, workbookId }: Props) {
  const { overrides, setOverride } = useOpponentColumnStore();
  const overrideColumn = workbookId ? (overrides[workbookId] ?? null) : null;

  // Show selector banner only when TBD games exist and banner not dismissed
  const [selectorDismissed, setSelectorDismissed] = useState(false);

  const hasTBD = useMemo(
    () => games.some((g) => getOpponentName(g, overrideColumn) === "TBD"),
    [games, overrideColumn]
  );

  const showSelector = hasTBD && !selectorDismissed && !overrideColumn;

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

  return (
    <>
      {/* TBD opponent column selector */}
      {showSelector && (
        <AwayTeamColumnSelector
          games={games}
          workbookId={workbookId}
          onSelect={(col) => {
            if (workbookId) setOverride(workbookId, col);
            setSelectorDismissed(true);
          }}
          onDismiss={() => setSelectorDismissed(true)}
        />
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
