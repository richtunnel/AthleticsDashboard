import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import { getWorksheetLimit } from "@/lib/security/plan-limits";

// GET all workbooks for current user (or the AD owner's workbooks for collaborators)
export async function GET(request: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Collaborators share an organization with the AD but have their own userId.
    // GamesWorkbook is keyed on userId (the AD's), so we need to look up the
    // owner's userId via the CollaborativeMember record when the caller is a collaborator.
    let workbookOwnerId = session.user.id;

    const userEmail = session.user.email?.toLowerCase();
    if (userEmail) {
      // Use case-insensitive match — CollaborativeMember.email may have different
      // casing than the session email, which would cause the lookup to silently miss
      // and fall back to the collaborator's own (empty) workbook list.
      const collaboration = await prisma.collaborativeMember.findFirst({
        where: {
          email: { equals: userEmail, mode: "insensitive" },
          status: "ACCEPTED",
          revokedAt: null,
        },
        select: { userId: true },
      });
      if (collaboration) {
        workbookOwnerId = collaboration.userId;
      }
    }

    const workbooks = await prisma.gamesWorkbook.findMany({
      where: {
        userId: workbookOwnerId,
      },
      orderBy: {
        sortOrder: "asc",
      },
      include: {
        _count: {
          select: {
            games: true,
          },
        },
      },
    });

    return NextResponse.json({ data: workbooks });
  } catch (error) {
    console.error("Error fetching games workbooks:", error);
    return NextResponse.json({ error: "Failed to fetch workbooks" }, { status: 500 });
  }
}

// POST - create a new workbook
export async function POST(request: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Collaborators should create workbooks under the AD owner's userId so that
    // new workbooks (and any orphan games assigned to them) are visible to the AD.
    let workbookOwnerId = session.user.id;
    const postUserEmail = session.user.email?.toLowerCase();
    if (postUserEmail) {
      const collaboration = await prisma.collaborativeMember.findFirst({
        where: {
          email: { equals: postUserEmail, mode: "insensitive" },
          status: "ACCEPTED",
          revokedAt: null,
        },
        select: { userId: true },
      });
      if (collaboration) {
        workbookOwnerId = collaboration.userId;
      }
    }

    // Check worksheet limit against the actual workbook owner
    const workbookCount = await prisma.gamesWorkbook.count({
      where: { userId: workbookOwnerId },
    });
    const limit = await getWorksheetLimit(workbookOwnerId);

    if (workbookCount >= limit) {
      return NextResponse.json(
        { error: `You have reached the limit of ${limit} isolated spreadsheets for your plan. Please upgrade to create more.` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, assignOrphans } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get current max sort order for the workbook owner
    const maxSortOrderResult = await prisma.gamesWorkbook.aggregate({
      where: {
        userId: workbookOwnerId,
      },
      _max: {
        sortOrder: true,
      },
    });

    const newSortOrder = (maxSortOrderResult._max.sortOrder ?? -1) + 1;

    const workbook = await prisma.gamesWorkbook.create({
      data: {
        name,
        sortOrder: newSortOrder,
        userId: workbookOwnerId,
      },
    });

    // If assignOrphans is true, associate any existing games without a workbook
    // to this newly created workbook (used when auto-creating the default workbook).
    // Orphans are keyed on the AD owner's id so collaborators don't accidentally
    // claim games that don't belong to them.
    if (assignOrphans) {
      await prisma.game.updateMany({
        where: {
          createdById: workbookOwnerId,
          workbookId: null,
        },
        data: {
          workbookId: workbook.id,
        },
      });
    }

    trackEvent("Games Workbook Created", {
      userId: session.user.id,
      workbookId: workbook.id,
      workbookName: name,
    });

    return NextResponse.json({ data: workbook }, { status: 201 });
  } catch (error) {
    console.error("Error creating games workbook:", error);
    return NextResponse.json({ error: "Failed to create workbook" }, { status: 500 });
  }
}
