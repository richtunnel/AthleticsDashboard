import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const gr = await prisma.gameRequest.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, schoolName: true, name: true } },
      },
    });

    if (!gr) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (gr.requesterUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (gr.status !== "CONFIRMED") return NextResponse.json({ error: "Request must be confirmed first" }, { status: 400 });
    if (gr.syncedGameId) return NextResponse.json({ error: "Already synced" }, { status: 409 });

    // Determine target workbook
    const body = await request.json().catch(() => ({}));
    let targetWorkbookId: string = body.workbookId;

    const workbooks = await prisma.gamesWorkbook.findMany({
      where:   { userId: session.user.id },
      select:  { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    });

    if (!workbooks.length) {
      return NextResponse.json({ error: "No worksheets found. Please create a worksheet first." }, { status: 400 });
    }

    // If multiple workbooks and none specified, return list for client dropdown
    if (workbooks.length > 1 && !targetWorkbookId) {
      return NextResponse.json({ workbooks }, { status: 409 });
    }

    targetWorkbookId = targetWorkbookId || workbooks[0].id;

    // Verify workbook belongs to requester
    const workbook = await prisma.gamesWorkbook.findFirst({
      where: { id: targetWorkbookId, userId: session.user.id },
    });
    if (!workbook) {
      return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
    }

    // Fetch requester's org id once (needed inside transaction)
    const requesterUser = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { organizationId: true },
    });

    // All creates/updates in a single transaction — partial failure leaves nothing orphaned
    const newGame = await prisma.$transaction(async (tx) => {
      // Find or create team
      let team = await tx.team.findFirst({
        where: {
          organization: { users: { some: { id: session.user.id } } },
          sport:  { name: gr.sport },
          level:  gr.level,
          gender: gr.gender as any,
        },
        include: { sport: true },
      });

      if (!team) {
        let sport = await tx.sport.findUnique({ where: { name: gr.sport } });
        if (!sport) {
          sport = await tx.sport.create({
            data: { name: gr.sport, season: "FALL" as any },
          });
        }
        team = await tx.team.create({
          data: {
            name:           `${gr.gender} ${gr.level} ${gr.sport}`,
            gender:         gr.gender as any,
            level:          gr.level,
            sportId:        sport.id,
            organizationId: requesterUser!.organizationId,
          },
          include: { sport: true },
        });
      }

      // Find or create opponent
      const ownerSchoolName = gr.owner?.schoolName || gr.owner?.name || "Opponent";
      let opponent = await tx.opponent.findFirst({
        where: { name: ownerSchoolName, organizationId: requesterUser!.organizationId },
      });
      if (!opponent) {
        opponent = await tx.opponent.create({
          data: { name: ownerSchoolName, organizationId: requesterUser!.organizationId },
        });
      }

      // Create the game
      const game = await tx.game.create({
        data: {
          date:        gr.availableDate,
          time:        gr.availableTimeWindow,
          status:      "SCHEDULED",
          isHome:      gr.isHomeForRequester,
          homeTeamId:  team.id,
          opponentId:  opponent.id,
          createdById: session.user.id,
          workbookId:  targetWorkbookId,
          notes:       `Scheduled via Schedule Exchange with ${ownerSchoolName}`,
        },
        include: {
          homeTeam:  { include: { sport: true } },
          opponent:  true,
          workbook:  true,
        },
      });

      // Mark request as synced
      await tx.gameRequest.update({
        where: { id },
        data:  { syncedGameId: game.id, syncedToWorkbookId: targetWorkbookId },
      });

      return game;
    });

    return NextResponse.json({ game: newGame });
  } catch (err) {
    console.error("[game-requests/[id]/sync PUT]", err);
    // Log retry job for transient failures
    try {
      await prisma.backgroundJob.create({
        data: {
          type:    "GAME_REQUEST_CONFIRM",
          payload: { gameRequestId: id, action: "sync_retry", error: String(err) },
          userId:  session.user.id,
          status:  "FAILED",
        },
      });
    } catch { /* ignore log failure */ }
    return NextResponse.json({ error: "Failed to sync game. Please try again." }, { status: 500 });
  }
}
