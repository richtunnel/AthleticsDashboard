import { prisma } from "../database/prisma";
import { format } from "date-fns";
import { formatLevelDisplay } from "../utils/formatters";
import { normalizeTimeFormat } from "../utils/timeValidation";
import { jobQueueService } from "./job-queue.service";
import { JobType, JobStatus } from "@prisma/client";

const BATCH_SIZE = 100;
const CHECKPOINT_INTERVAL = 50;

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

    let success = 0;
    const errors: string[] = [];

    // Get reference data once at the start
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: { sport: true },
    });

    const opponents = await prisma.opponent.findMany({
      where: { organizationId },
    });

    const venues = await prisma.venue.findMany({
      where: { organizationId },
    });

    let i = startLine;
    let lastCheckpoint = i;
    
    try {
      for (; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          // Parse CSV line (handle quoted values)
          const values = this.parseCSVLine(line);
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });

          // Parse date - only required field
          const date = new Date(row["Date"]);
          if (isNaN(date.getTime())) {
            errors.push(`Line ${i + 1}: Invalid or missing date`);
            continue;
          }

          // Find matching team, or use defaults if sport/level not provided
          let team = teams.find((t: any) => 
            t.sport.name === (row["Sport"] || "Unknown Sport") && 
            t.level === (row["Level"] || "VARSITY") && 
            (row["Team"] ? t.name === row["Team"] : true)
          );

          // If team not found, create a default sport and team
          if (!team) {
            const sportName = row["Sport"] || "Unknown Sport";
            const levelValue = row["Level"] || "VARSITY";

            let sport = await prisma.sport.findFirst({
              where: {
                name: {
                  equals: sportName,
                  mode: "insensitive",
                },
              },
            });

            if (!sport) {
              sport = await prisma.sport.create({
                data: {
                  name: sportName,
                  season: "FALL",
                },
              });
            }

            team = await prisma.team.create({
              data: {
                name: `${sportName} ${levelValue}`,
                sportId: sport.id,
                level: levelValue as any,
                organizationId,
              },
              include: { sport: true },
            });

            teams.push(team);
          }

          if (!team) {
            throw new Error("Failed to resolve team for imported row");
          }

          // Find opponent
          const opponent = row["Opponent"] ? opponents.find((o: any) => o.name === row["Opponent"]) : null;

          // Find venue
          const venue = row["Venue"] ? venues.find((v: any) => v.name === row["Venue"]) : null;

          // Create game atomically with transaction
          await prisma.$transaction(async (tx) => {
            await tx.game.create({
              data: {
                date,
                time: (() => {
                  if (!row["Time"]) return null;
                  try { return normalizeTimeFormat(row["Time"]); }
                  catch { return row["Time"] as string; } // preserve original if format is unrecognised
                })(),
                status: (row["Status"] as any) || "SCHEDULED",
                isHome: row["Location Type"]?.toLowerCase() === "home",
                notes: row["Notes"] || null,
                travelRequired: row["Travel Required"]?.toLowerCase() === "yes",
                busTravel: row["Bus Travel"]?.toLowerCase() === "yes",
                estimatedTravelTime: row["Travel Time (min)"] ? parseInt(row["Travel Time (min)"]) : null,
                busCount: row["Bus Count"] ? parseInt(row["Bus Count"]) : null,
                travelCost: row["Travel Cost"] ? parseFloat(row["Travel Cost"]) : null,
                homeTeamId: team.id,
                opponentId: opponent?.id || null,
                venueId: venue?.id || null,
                createdById: userId,
              },
            });
          }, {
            timeout: 5000, // 5 second timeout for individual operations
          });

          success++;

          // Checkpoint: update progress every CHECKPOINT_INTERVAL rows
          if (i - lastCheckpoint >= CHECKPOINT_INTERVAL && i < lines.length - 1) {
            lastCheckpoint = i;
          }
        } catch (error) {
          // Check if it's a transient error (DB locked, timeout, etc.)
          const errorMsg = error instanceof Error ? error.message : String(error);
          const isTransientError = this.isTransientError(error);
          
          if (isTransientError) {
            // Re-throw to trigger requeue
            throw error;
          }
          
          errors.push(`Line ${i + 1}: ${errorMsg}`);
        }
      }
    } catch (criticalError) {
      console.error(`Critical error during import at line ${i}:`, criticalError);
      // Return partial results with checkpoint info
      return {
        success,
        errors,
        lastLine: i,
        completed: false,
      };
    }

    return { success, errors, lastLine: i, completed: true };
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
    checkpoint?: string;
  }> {
    const startLine = payload.startLine || 1;
    const jobId = payload.jobId;
    const totalLines = payload.csvContent.split("\n").length;

    // Update progress if we have a job ID
    if (jobId) {
      await jobQueueService.updateProgress(jobId, {
        current: startLine,
        total: totalLines,
        message: `Processing CSV import... (${startLine}/${totalLines})`,
      });
    }

    const { success, errors, lastLine, completed } = await this.importGamesFromCSV(
      payload.csvContent,
      payload.userId,
      payload.organizationId,
      startLine
    );

    // Accumulate totals
    const newTotalSuccess = (payload.totalSuccess || 0) + success;
    const newTotalErrors = (payload.totalErrors || []).concat(errors);

    // If not completed, we need to checkpoint and potentially requeue
    if (!completed && lastLine < totalLines - 1) {
      // Update job with checkpoint progress
      if (jobId) {
        await jobQueueService.updateProgress(jobId, {
          current: lastLine,
          total: totalLines,
          checkpoint: `resume from line ${lastLine}`,
          message: `Checkpointing at line ${lastLine}/${totalLines}`,
        });
      }

      // Check if we should retry this batch
      const hasErrors = newTotalErrors.length > 0;
      const lastError = newTotalErrors[newTotalErrors.length - 1];
      
      if (this.isTransientError(lastError)) {
        // Requeue for retry with current progress
        await jobQueueService.requeue(jobId || '', lastError);
      }

      return {
        success: newTotalSuccess,
        errors: newTotalErrors,
        lastLine,
        completed: false,
        checkpoint: `resume from line ${lastLine}`,
      };
    }

    // All done
    if (jobId) {
      await jobQueueService.updateProgress(jobId, {
        current: totalLines,
        total: totalLines,
        message: `Import completed: ${newTotalSuccess} games imported, ${newTotalErrors.length} errors`,
      });
    }

    return {
      success: newTotalSuccess,
      errors: newTotalErrors,
      lastLine,
      completed: true,
    };
  }

  /**
   * Detect transient errors that should trigger requeue
   */
  private isTransientError(error: any): boolean {
    if (!error) return false;
    
    const message = error instanceof Error ? error.message : String(error);
    const transientPatterns = [
      'connection',
      'timeout',
      'deadlock',
      'locked',
      'too many connections',
      'pool',
      'network',
      'EHOSTUNREACH',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
    ];

    return transientPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
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
