import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/calendar/workbook-columns
 *
 * Two modes:
 *   ?workbookId=xxx               → { columns: string[] }
 *     Returns every unique column name that appears in the workbook's games,
 *     derived from game.customFields keys + CustomColumn records.
 *
 *   ?workbookId=xxx&columnName=yyy → { values: string[] }
 *     Returns every unique value found in that column across all games in the
 *     workbook, sorted alphabetically.
 *
 * Collaborator-safe: resolves the AD owner's workbooks via CollaborativeMember.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const workbookId = searchParams.get("workbookId");
    const columnName = searchParams.get("columnName");

    if (!workbookId) {
      return NextResponse.json({ error: "workbookId is required" }, { status: 400 });
    }

    // Collaborators share an organization with the AD but have their own userId.
    // GamesWorkbook is keyed on the AD's userId, so resolve that first.
    let workbookOwnerId = session.user.id;
    const userEmail = session.user.email?.toLowerCase();
    if (userEmail) {
      const collab = await prisma.collaborativeMember.findFirst({
        where: {
          email: { equals: userEmail, mode: "insensitive" },
          status: "ACCEPTED",
          revokedAt: null,
        },
        select: { userId: true },
      });
      if (collab) workbookOwnerId = collab.userId;
    }

    // Verify the workbook belongs to this owner
    const workbook = await prisma.gamesWorkbook.findFirst({
      where: { id: workbookId, userId: workbookOwnerId },
      select: { id: true },
    });
    if (!workbook) {
      return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
    }

    if (!columnName) {
      // ── Mode 1: return column names ──────────────────────────────────────────

      // Source A: CustomColumn model (explicitly defined columns)
      const customCols = await prisma.customColumn.findMany({
        where: { workbookId },
        select: { name: true },
      });
      const names = new Set<string>(customCols.map((c) => c.name));

      // Source B: keys found in game.customFields (imported via CSV)
      const games = await prisma.game.findMany({
        where: { workbookId },
        select: { customFields: true },
      });
      for (const game of games) {
        const fields = game.customFields as Record<string, unknown> | null;
        if (fields) {
          for (const key of Object.keys(fields)) {
            if (key.trim()) names.add(key.trim());
          }
        }
      }

      return NextResponse.json({
        columns: Array.from(names).sort((a, b) => a.localeCompare(b)),
      });
    } else {
      // ── Mode 2: return unique values for a specific column ────────────────────
      const games = await prisma.game.findMany({
        where: { workbookId },
        select: { customFields: true },
      });

      const values = new Set<string>();
      for (const game of games) {
        const fields = game.customFields as Record<string, unknown> | null;
        if (fields) {
          const raw = fields[columnName];
          if (raw !== undefined && raw !== null) {
            const str = String(raw).trim();
            if (str) values.add(str);
          }
        }
      }

      return NextResponse.json({
        values: Array.from(values).sort((a, b) => a.localeCompare(b)),
      });
    }
  } catch (error) {
    console.error("[API] workbook-columns error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workbook data" },
      { status: 500 }
    );
  }
}
