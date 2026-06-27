import { prisma } from "../database/prisma";
import { format } from "date-fns";
import { formatLevelDisplay } from "../utils/formatters";
import { normalizeTimeFormat } from "../utils/timeValidation";
import { jobQueueService } from "./job-queue.service";
import { JobType, JobStatus } from "@prisma/client";


export interface ImportResult {
  success: number;
  errors: string[];
  lastLine: number;
  completed: boolean;
  totalProcessed?: number;
}

export interface ImportJobPayload {
  csvContent: string;
  userId: string;
  organizationId: string;
  startLine?: number;
  totalSuccess?: number;
  totalErrors?: string[];
  jobId?: string;
}

export class ImportExportService {
  async exportGamesToCSV(organizationId: string): Promise<string> {
    const games = await prisma.game.findMany({
      where: {
        homeTeam: { organizationId },
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
      orderBy: { date: "asc" },
    });

    // CSV Headers
    const headers = [
      "Date",
      "Time",
      "Sport",
      "Level",
      "Team",
      "Opponent",
      "Location Type",
      "Venue",
      "Status",
      "Travel Required",
      "Bus Travel",
      "Departure Time",
      "Arrival Time",
      "Travel Time (min)",
      "Bus Count",
      "Travel Cost",
      "Cost",
      "Notes",
    ];

    // Convert games to CSV rows
    const rows = games.map((game: any) => [
      format(new Date(game.date), "yyyy-MM-dd"),
      game.time || "",
      game.homeTeam.sport.name,
      formatLevelDisplay(game.homeTeam.level),
      game.homeTeam.name,
      game.opponent?.name || "",
      game.isHome ? "Home" : "Away",
      game.venue?.name || "",
      game.status,
      game.travelRequired ? "Yes" : "No",
      game.busTravel ? "Yes" : "No",
      game.actualDepartureTime ? format(new Date(game.actualDepartureTime), "h:mm a") : "",
      game.actualArrivalTime ? format(new Date(game.actualArrivalTime), "h:mm a") : "",
      game.estimatedTravelTime?.toString() || "",
      game.busCount?.toString() || "",
      game.travelCost?.toString() || "",
      game.cost?.toString() || "",
      game.notes || "",
    ]);

    // Combine headers and rows
    const csvContent = [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");

    return csvContent;
  }

  async importGamesFromCSV(csvContent: string, userId: string, organizationId: string, startLine: number = 1): Promise<ImportResult> {
    const lines = csvContent.split("\n");
    if (lines.length <= 1) return { success: 0, errors: [], lastLine: 0, completed: true };

    const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const headers = this.mapColumnAliases(rawHeaders);

    const errors: string[] = [];

    // ── 1. Parse all rows upfront ─────────────────────────────────────────────
    type ParsedRow = {
      lineNum: number;
      date: Date;
      sportName: string;
      levelValue: string;
      teamName: string;
      opponentName: string;
      venueName: string;
      row: Record<string, string>;
    };

    const parsed: ParsedRow[] = [];
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = this.parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => { row[header] = values[index] || ""; });

      const date = new Date(row["Date"]);
      if (isNaN(date.getTime())) {
        errors.push(`Line ${i + 1}: Invalid or missing date`);
        continue;
      }

      parsed.push({
        lineNum: i + 1,
        date,
        sportName: row["Sport"] || "Unknown Sport",
        levelValue: row["Level"] || "VARSITY",
        teamName: row["Team"] || "",
        opponentName: row["Opponent"] || "",
        venueName: row["Venue"] || "",
        row,
      });
    }

    if (parsed.length === 0) {
      return { success: 0, errors, lastLine: lines.length, completed: true };
    }

    // ── 2. Resolve reference data ─────────────────────────────────────────────
    const [existingTeams, opponents, venues] = await Promise.all([
      prisma.team.findMany({ where: { organizationId }, include: { sport: true } }),
      prisma.opponent.findMany({ where: { organizationId } }),
      prisma.venue.findMany({ where: { organizationId } }),
    ]);

    const opponentMap = new Map(opponents.map((o) => [o.name.toLowerCase(), o]));
    const venueMap = new Map(venues.map((v) => [v.name.toLowerCase(), v]));

    // ── 3. Resolve sports — bulk create missing ───────────────────────────────
    const neededSportNames = [...new Set(parsed.map((p) => p.sportName))];
    const existingSports = await prisma.sport.findMany({
      where: { name: { in: neededSportNames, mode: "insensitive" } as any },
    });
    const sportMap = new Map(existingSports.map((s) => [s.name.toLowerCase(), s]));

    const missingSportNames = neededSportNames.filter((n) => !sportMap.has(n.toLowerCase()));
    if (missingSportNames.length > 0) {
      await prisma.sport.createMany({
        data: missingSportNames.map((name) => ({ name, season: "FALL" as any })),
        skipDuplicates: true,
      });
      const newSports = await prisma.sport.findMany({
        where: { name: { in: missingSportNames, mode: "insensitive" } as any },
      });
      newSports.forEach((s) => sportMap.set(s.name.toLowerCase(), s));
    }

    // ── 4. Resolve teams — bulk create missing ────────────────────────────────
    const teamMap = new Map(existingTeams.map((t) => [`${t.sport.name.toLowerCase()}|${t.level}`, t]));

    const neededTeamKeys = [...new Set(
      parsed.map((p) => `${p.sportName.toLowerCase()}|${p.levelValue}`)
    )];
    const missingTeamKeys = neededTeamKeys.filter((k) => !teamMap.has(k));

    if (missingTeamKeys.length > 0) {
      const teamsToCreate = missingTeamKeys.map((key) => {
        const [sportNameLower, level] = key.split("|");
        const sport = sportMap.get(sportNameLower);
        const sportName = parsed.find((p) => p.sportName.toLowerCase() === sportNameLower)?.sportName ?? sportNameLower;
        if (!sport) return null;
        return {
          name: `${sportName} ${level}`,
          sportId: sport.id,
          level: level as any,
          organizationId,
        };
      }).filter(Boolean) as any[];

      if (teamsToCreate.length > 0) {
        await prisma.team.createMany({ data: teamsToCreate, skipDuplicates: true });
        const newTeams = await prisma.team.findMany({
          where: { organizationId, level: { in: [...new Set(teamsToCreate.map((t: any) => t.level))] } },
          include: { sport: true },
        });
        newTeams.forEach((t) => teamMap.set(`${t.sport.name.toLowerCase()}|${t.level}`, t));
      }
    }

    // ── 5. Build game payloads ────────────────────────────────────────────────
    const gameData: any[] = [];
    for (const p of parsed) {
      const team = teamMap.get(`${p.sportName.toLowerCase()}|${p.levelValue}`);
      if (!team) {
        errors.push(`Line ${p.lineNum}: Could not resolve team for sport "${p.sportName}" level "${p.levelValue}"`);
        continue;
      }

      const opponent = p.opponentName ? opponentMap.get(p.opponentName.toLowerCase()) : null;
      const venue = p.venueName ? venueMap.get(p.venueName.toLowerCase()) : null;

      let time: string | null = null;
      if (p.row["Time"]) {
        try { time = normalizeTimeFormat(p.row["Time"]); }
        catch { time = p.row["Time"]; }
      }

      gameData.push({
        date: p.date,
        time,
        status: (p.row["Status"] as any) || "SCHEDULED",
        isHome: p.row["Location Type"]?.toLowerCase() === "home",
        notes: p.row["Notes"] || null,
        travelRequired: p.row["Travel Required"]?.toLowerCase() === "yes",
        busTravel: p.row["Bus Travel"]?.toLowerCase() === "yes",
        estimatedTravelTime: p.row["Travel Time (min)"] ? parseInt(p.row["Travel Time (min)"]) : null,
        busCount: p.row["Bus Count"] ? parseInt(p.row["Bus Count"]) : null,
        travelCost: p.row["Travel Cost"] ? parseFloat(p.row["Travel Cost"]) : null,
        homeTeamId: team.id,
        opponentId: opponent?.id ?? null,
        venueId: venue?.id ?? null,
        createdById: userId,
      });
    }

    // ── 6. Single bulk insert ─────────────────────────────────────────────────
    if (gameData.length > 0) {
      await prisma.game.createMany({ data: gameData, skipDuplicates: true });
    }

    return { success: gameData.length, errors, lastLine: lines.length, completed: true };
  }

  /**
   * Process an import job with checkpointing for large CSV files
   * Supports requeue if processing fails midway
   */
  async processImportJob(payload: ImportJobPayload): Promise<{
    success: number;
    errors: string[];
    lastLine: number;
    completed: boolean;
  }> {
    const jobId = payload.jobId;
    const totalLines = payload.csvContent.split("\n").length;

    if (jobId) {
      await jobQueueService.updateProgress(jobId, {
        current: 0,
        total: totalLines,
        message: `Processing CSV import (${totalLines} rows)...`,
      });
    }

    const { success, errors, lastLine, completed } = await this.importGamesFromCSV(
      payload.csvContent,
      payload.userId,
      payload.organizationId,
    );

    if (jobId) {
      await jobQueueService.updateProgress(jobId, {
        current: totalLines,
        total: totalLines,
        message: `Import completed: ${success} games imported, ${errors.length} errors`,
      });
    }

    return { success, errors, lastLine, completed };
  }

  async exportTeamsToCSV(organizationId: string): Promise<string> {
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: { sport: true },
      orderBy: [{ sport: { name: "asc" } }, { level: "asc" }],
    });

    const headers = ["Team Name", "Sport", "Level", "Gender"];

    const rows = teams.map((team: any) => [team.name, team.sport.name, formatLevelDisplay(team.level), team.gender || ""]);

    return [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");
  }

  async exportVenuesToCSV(organizationId: string): Promise<string> {
    const venues = await prisma.venue.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });

    const headers = ["Venue Name", "Address", "City", "State", "ZIP", "Notes"];

    const rows = venues.map((venue: any) => [venue.name, venue.address || "", venue.city || "", venue.state || "", venue.zipCode || "", venue.notes || ""]);

    return [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");
  }

  async exportOpponentsToCSV(organizationId: string): Promise<string> {
    const opponents = await prisma.opponent.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });

    const headers = ["Name", "Mascot", "Colors", "Contact", "Phone", "Email", "Notes"];

    const rows = opponents.map((opponent: any) => [
      opponent.name,
      opponent.mascot || "",
      opponent.colors || "",
      opponent.contact || "",
      opponent.phone || "",
      opponent.email || "",
      opponent.notes || "",
    ]);

    return [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");
  }

  async exportMatchupResultsToCSV(organizationId: string): Promise<string> {
    const results = await prisma.matchupResult.findMany({
      where: { organizationId },
      include: { opponent: true },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["Date", "Sport", "Level", "Gender", "Opponent", "Your Score", "Opponent Score", "Result"];

    const rows = results.map((result: any) => [
      format(new Date(result.createdAt), "yyyy-MM-dd"),
      result.sport || "",
      result.level || "",
      result.gender || "",
      result.opponent.name,
      result.organizationScore.toString(),
      result.opponentScore.toString(),
      result.isWin ? "Win" : result.organizationScore === result.opponentScore ? "Draw" : "Loss",
    ]);

    return [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");
  }

  async exportCostBudgetToCSV(organizationId: string, workbookId?: string | null): Promise<string> {
    const where: any = {
      homeTeam: { organizationId },
      cost: { not: null },
    };

    if (workbookId) {
      where.workbookId = workbookId;
    }

    const games = await prisma.game.findMany({
      where,
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
      orderBy: { date: "asc" },
    });

    const headers = ["Date", "Sport", "Level", "Team", "Opponent", "Venue", "Cost"];

    const rows = games.map((game: any) => [
      format(new Date(game.date), "yyyy-MM-dd"),
      game.homeTeam.sport.name,
      game.homeTeam.level,
      game.homeTeam.name,
      game.opponent?.name || "",
      game.venue?.name || "",
      game.cost?.toString() || "0",
    ]);

    return [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");
  }

  private mapColumnAliases(headers: string[]): string[] {
    const OPPONENT_KEYWORDS = [
      "away", "away team", "away teams", "away school", "away schools",
      "opponent", "opponents", "opponent team", "opposing team", "opposing school",
      "rival", "rivals", "other team", "other teams", "other school",
      "challenger", "challengers", "visiting team", "visiting school",
      "visitor", "visitors", "visiting", "competition", "competing team",
      "competition team", "adversary", "guest", "guests", "guest team",
      "playing against", "their team", "the other team",
      "contender", "contenders", "ops", "fuckboys", "nerds", "dumbasses", "losers",
    ];
    const OPPONENT_KEYWORDS_EXACT_ONLY = ["vs", "vs.", "v.s.", "opp", "foe", "foes", "matchup", "enemy"];

    return headers.map((header) => {
      const norm = header.toLowerCase().trim();
      if ([...OPPONENT_KEYWORDS, ...OPPONENT_KEYWORDS_EXACT_ONLY].some((k) => norm === k)) return "Opponent";
      if (OPPONENT_KEYWORDS.some((k) => norm.includes(k))) return "Opponent";
      return header;
    });
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }
}

export const importExportService = new ImportExportService();
