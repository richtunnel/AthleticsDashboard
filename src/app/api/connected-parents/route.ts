import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/connected-parents
 *
 * Returns the list of parents connected to the AD's organization.
 *
 * SOURCE OF TRUTH: this list is derived from CalendarSyncRequest rows with
 * status="APPROVED" — the same table the parent's own dashboard reads. This
 * guarantees AD and parent views can NEVER show inconsistent state ("parent
 * sees Synced, AD sees nothing" was a real bug under the old design).
 *
 * The old code read from a separate `ConnectedParent` table that had to be
 * kept in sync via upserts in the approve route — those upserts could fail
 * silently and leave the AD blind. Reading from CalendarSyncRequest removes
 * that whole class of bugs.
 *
 * The `ConnectedParent` table is still queried for supplementary state
 * (calendarSynced flag, lastSyncedAt timestamp) but it is no longer the
 * source of truth for WHO is connected.
 */
export async function GET(request: Request) {
  try {
    const session = await getAnySession();

    if (!session?.user?.email) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"].includes(user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // ── Single source of truth: approved sync requests for this org ──
    const [approvedRequests, total] = await Promise.all([
      prisma.calendarSyncRequest.findMany({
        where: {
          schoolId: user.organizationId,
          status: "APPROVED",
        },
        include: {
          parent: {
            select: { id: true, name: true, email: true, parentCode: true },
          },
          school: { select: { name: true } },
        },
        orderBy: { reviewedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.calendarSyncRequest.count({
        where: {
          schoolId: user.organizationId,
          status: "APPROVED",
        },
      }),
    ]);

    // ── Supplementary: ConnectedParent gives us calendarSynced + lastSyncedAt
    // (whether games actually got pushed, not just approval). Not required —
    // missing rows just mean "approved but never actually pushed yet".
    const parentUserIds = approvedRequests.map((r) => r.parentUserId);
    const connectedRows = parentUserIds.length
      ? await prisma.connectedParent.findMany({
          where: {
            parentUserId: { in: parentUserIds },
            schoolId: user.organizationId,
          },
          select: {
            parentUserId: true,
            calendarSynced: true,
            lastSyncedAt: true,
            membershipStatus: true,
          },
        })
      : [];
    const connectedMap = new Map(connectedRows.map((cp) => [cp.parentUserId, cp]));

    return Response.json({
      parents: approvedRequests.map((req) => {
        const cp = connectedMap.get(req.parentUserId);
        return {
          // Use the sync-request ID as the row identifier so AD-side actions
          // (unsync, etc.) target the canonical record.
          id: req.id,
          parentUserId: req.parentUserId,
          parentUserName: req.parent.name || req.parent.email,
          parentEmail: req.parent.email,
          parentCode: req.parent.parentCode ?? null,
          schoolId: req.schoolId,
          schoolName: req.school.name,
          sportName: req.sportName,
          sportLevel: req.sportLevel,
          calendarSynced: cp?.calendarSynced ?? false,
          lastSyncedAt: cp?.lastSyncedAt?.toISOString() ?? null,
          membershipStatus: cp?.membershipStatus ?? "ACTIVE",
          createdAt: req.reviewedAt?.toISOString() ?? new Date().toISOString(),
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching connected parents:", error);
    return Response.json({ error: "Failed to fetch connected parents" }, { status: 500 });
  }
}
