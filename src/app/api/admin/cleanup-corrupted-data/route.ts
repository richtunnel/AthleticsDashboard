import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import {
  performDataCleanup,
  identifyCorruptedGames,
  identifyCorruptedTeams,
  formatCleanupReport,
} from "@/lib/utils/csv-data-cleanup";

/**
 * GET - Identify corrupted data (dry run)
 * POST - Clean up corrupted data
 */

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get("detailed") === "true";

    // Identify corrupted data without deleting
    const report = await performDataCleanup(session.user.organizationId, {
      dryRun: true,
    });

    // If detailed report requested, include specific issues
    if (detailed) {
      const gameIssues = await identifyCorruptedGames(session.user.organizationId);
      const teamIssues = await identifyCorruptedTeams(session.user.organizationId);

      return NextResponse.json({
        success: true,
        data: {
          summary: report,
          details: {
            corruptedGames: gameIssues.games,
            corruptedTeams: teamIssues.teams,
          },
          report: formatCleanupReport(report),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: report,
        report: formatCleanupReport(report),
      },
    });
  } catch (error) {
    console.error("Data cleanup check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check data integrity",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { autoFix = false } = body;

    // Perform actual cleanup
    const report = await performDataCleanup(session.user.organizationId, {
      dryRun: false,
      autoFix,
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: report,
        report: formatCleanupReport(report),
        message:
          report.gamesDeleted > 0 || report.teamsDeleted > 0
            ? `Cleanup completed. Deleted ${report.gamesDeleted} games and ${report.teamsDeleted} teams.`
            : "No corrupted data found.",
      },
    });
  } catch (error) {
    console.error("Data cleanup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clean up data",
      },
      { status: 500 }
    );
  }
}
