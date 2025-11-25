/**
 * CSV Import Data Cleanup Utility
 * 
 * This utility helps identify and fix corrupted games that may have been created
 * by previous versions of the CSV import feature before validation was added.
 */

import { prisma } from "@/lib/database/prisma";

export interface CleanupReport {
  gamesChecked: number;
  corruptedGames: number;
  teamsChecked: number;
  corruptedTeams: number;
  gamesDeleted: number;
  teamsDeleted: number;
  errors: string[];
}

/**
 * Identifies games with broken relationships
 */
export async function identifyCorruptedGames(organizationId: string): Promise<{
  games: Array<{ id: string; date: Date; issue: string }>;
  count: number;
}> {
  const issues: Array<{ id: string; date: Date; issue: string }> = [];

  try {
    // Find all games for the organization
    const games = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
        },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
            organization: true,
          },
        },
        opponent: true,
        venue: true,
        createdBy: true,
      },
    });

    for (const game of games) {
      // Check if homeTeam exists and is valid
      if (!game.homeTeam) {
        issues.push({
          id: game.id,
          date: game.date,
          issue: "Missing homeTeam relationship",
        });
        continue;
      }

      // Check if homeTeam has a valid sport
      if (!game.homeTeam.sport) {
        issues.push({
          id: game.id,
          date: game.date,
          issue: "homeTeam missing sport relationship",
        });
        continue;
      }

      // Check if homeTeam has a valid organization
      if (!game.homeTeam.organization) {
        issues.push({
          id: game.id,
          date: game.date,
          issue: "homeTeam missing organization relationship",
        });
        continue;
      }

      // Check if createdBy exists
      if (!game.createdBy) {
        issues.push({
          id: game.id,
          date: game.date,
          issue: "Missing createdBy relationship",
        });
        continue;
      }

      // Check for invalid foreign keys (should not happen with proper constraints)
      if (game.opponentId && !game.opponent) {
        issues.push({
          id: game.id,
          date: game.date,
          issue: "Invalid opponent foreign key",
        });
        continue;
      }

      if (game.venueId && !game.venue) {
        issues.push({
          id: game.id,
          date: game.date,
          issue: "Invalid venue foreign key",
        });
        continue;
      }
    }

    return {
      games: issues,
      count: issues.length,
    };
  } catch (error) {
    console.error("Error identifying corrupted games:", error);
    throw error;
  }
}

/**
 * Identifies teams with broken relationships
 */
export async function identifyCorruptedTeams(organizationId: string): Promise<{
  teams: Array<{ id: string; name: string; issue: string }>;
  count: number;
}> {
  const issues: Array<{ id: string; name: string; issue: string }> = [];

  try {
    const teams = await prisma.team.findMany({
      where: {
        organizationId,
      },
      include: {
        sport: true,
        organization: true,
      },
    });

    for (const team of teams) {
      // Check if sport exists
      if (!team.sport) {
        issues.push({
          id: team.id,
          name: team.name,
          issue: "Missing sport relationship",
        });
        continue;
      }

      // Check if organization exists
      if (!team.organization) {
        issues.push({
          id: team.id,
          name: team.name,
          issue: "Missing organization relationship",
        });
        continue;
      }
    }

    return {
      teams: issues,
      count: issues.length,
    };
  } catch (error) {
    console.error("Error identifying corrupted teams:", error);
    throw error;
  }
}

/**
 * Deletes corrupted games that cannot be fixed
 */
export async function deleteCorruptedGames(gameIds: string[]): Promise<{
  deleted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let deleted = 0;

  for (const gameId of gameIds) {
    try {
      await prisma.game.delete({
        where: { id: gameId },
      });
      deleted++;
    } catch (error) {
      errors.push(`Failed to delete game ${gameId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { deleted, errors };
}

/**
 * Deletes corrupted teams that cannot be fixed
 * WARNING: This will also delete all games associated with the team
 */
export async function deleteCorruptedTeams(teamIds: string[]): Promise<{
  deleted: number;
  gamesDeleted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let deleted = 0;
  let gamesDeleted = 0;

  for (const teamId of teamIds) {
    try {
      // Count games that will be deleted
      const gamesCount = await prisma.game.count({
        where: {
          OR: [
            { homeTeamId: teamId },
            { awayTeamId: teamId },
          ],
        },
      });

      // Delete team (cascade will delete games)
      await prisma.team.delete({
        where: { id: teamId },
      });

      deleted++;
      gamesDeleted += gamesCount;
    } catch (error) {
      errors.push(`Failed to delete team ${teamId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { deleted, gamesDeleted, errors };
}

/**
 * Attempts to repair a corrupted team by ensuring all relationships exist
 * This is only possible if the foreign keys are valid but relationships aren't loading
 */
export async function attemptTeamRepair(teamId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Fetch team with raw foreign keys
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return {
        success: false,
        message: "Team not found",
      };
    }

    // Verify sport exists
    const sport = await prisma.sport.findUnique({
      where: { id: team.sportId },
    });

    if (!sport) {
      return {
        success: false,
        message: `Sport ${team.sportId} not found - team cannot be repaired`,
      };
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: team.organizationId },
    });

    if (!organization) {
      return {
        success: false,
        message: `Organization ${team.organizationId} not found - team cannot be repaired`,
      };
    }

    // If we got here, relationships are valid
    return {
      success: true,
      message: "Team relationships are valid",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Comprehensive cleanup function - identifies and optionally deletes corrupted data
 */
export async function performDataCleanup(
  organizationId: string,
  options: {
    dryRun?: boolean; // If true, only identify issues without deleting
    autoFix?: boolean; // If true, attempt repairs before deleting
  } = {}
): Promise<CleanupReport> {
  const report: CleanupReport = {
    gamesChecked: 0,
    corruptedGames: 0,
    teamsChecked: 0,
    corruptedTeams: 0,
    gamesDeleted: 0,
    teamsDeleted: 0,
    errors: [],
  };

  try {
    // Identify corrupted games
    const gameIssues = await identifyCorruptedGames(organizationId);
    report.gamesChecked = await prisma.game.count({
      where: {
        homeTeam: {
          organizationId,
        },
      },
    });
    report.corruptedGames = gameIssues.count;

    // Identify corrupted teams
    const teamIssues = await identifyCorruptedTeams(organizationId);
    report.teamsChecked = await prisma.team.count({
      where: { organizationId },
    });
    report.corruptedTeams = teamIssues.count;

    // If dry run, just return the report
    if (options.dryRun) {
      return report;
    }

    // Attempt repairs if autoFix is enabled
    if (options.autoFix) {
      for (const team of teamIssues.teams) {
        const repairResult = await attemptTeamRepair(team.id);
        if (!repairResult.success) {
          report.errors.push(`Team ${team.name}: ${repairResult.message}`);
        }
      }
    }

    // Delete corrupted games
    if (gameIssues.count > 0) {
      const gameDeleteResult = await deleteCorruptedGames(
        gameIssues.games.map((g) => g.id)
      );
      report.gamesDeleted = gameDeleteResult.deleted;
      report.errors.push(...gameDeleteResult.errors);
    }

    // Delete corrupted teams (after trying to repair)
    if (teamIssues.count > 0) {
      const teamDeleteResult = await deleteCorruptedTeams(
        teamIssues.teams.map((t) => t.id)
      );
      report.teamsDeleted = teamDeleteResult.deleted;
      report.gamesDeleted += teamDeleteResult.gamesDeleted;
      report.errors.push(...teamDeleteResult.errors);
    }

    return report;
  } catch (error) {
    report.errors.push(
      `Cleanup failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return report;
  }
}

/**
 * Helper function to format cleanup report for display
 */
export function formatCleanupReport(report: CleanupReport): string {
  const lines: string[] = [];

  lines.push("=== Data Cleanup Report ===");
  lines.push("");
  lines.push(`Games Checked: ${report.gamesChecked}`);
  lines.push(`Corrupted Games Found: ${report.corruptedGames}`);
  lines.push(`Games Deleted: ${report.gamesDeleted}`);
  lines.push("");
  lines.push(`Teams Checked: ${report.teamsChecked}`);
  lines.push(`Corrupted Teams Found: ${report.corruptedTeams}`);
  lines.push(`Teams Deleted: ${report.teamsDeleted}`);
  lines.push("");

  if (report.errors.length > 0) {
    lines.push("Errors:");
    report.errors.forEach((error) => {
      lines.push(`  - ${error}`);
    });
  } else {
    lines.push("No errors encountered.");
  }

  lines.push("");
  lines.push("=========================");

  return lines.join("\n");
}
