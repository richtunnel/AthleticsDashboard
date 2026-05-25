import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * PUT /api/parent/athlete-links/[id]
 * Parent edits their child's information.
 *
 * - Changing the school resets status → "PENDING" (requires new AD approval).
 * - Sport / level changes update ConnectedParent so the AD sees fresh data.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getParentSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.parentAthleteLink.findUnique({
      where: { id },
      select: {
        id: true,
        parentUserId: true,
        schoolId: true,
        sport: true,
        gradeLevel: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Child link not found" }, { status: 404 });
    }

    if (existing.parentUserId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { athleteName, schoolId, sport, gradeLevel } = body;

    // Resolve new schoolId if changed
    let organizationId = existing.schoolId;
    let schoolEntityId: string | null = null;
    let schoolChanged = false;

    if (schoolId && schoolId !== existing.schoolId) {
      schoolChanged = true;

      // Try School entity first, fall back to Org ID
      const schoolEntity = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, organizationId: true },
      });

      if (schoolEntity) {
        organizationId = schoolEntity.organizationId;
        schoolEntityId = schoolEntity.id;
      } else {
        const org = await prisma.organization.findUnique({
          where: { id: schoolId },
          select: { id: true },
        });
        if (!org) {
          return NextResponse.json({ error: "School not found" }, { status: 404 });
        }
        organizationId = schoolId;
      }
    }

    // Build update payload
    const updateData: Record<string, any> = {};
    if (athleteName?.trim()) updateData.athleteName = athleteName.trim();
    if (sport !== undefined) updateData.sport = sport || null;
    if (gradeLevel !== undefined) updateData.gradeLevel = gradeLevel || null;

    if (schoolChanged) {
      updateData.schoolId = organizationId;
      if (schoolEntityId !== null) updateData.schoolEntityId = schoolEntityId;
      // Changing school resets to PENDING — new AD must approve
      updateData.status = "PENDING";
    }

    const updated = await prisma.parentAthleteLink.update({
      where: { id },
      data: updateData,
    });

    // ── Clean up now-stale PENDING sync requests ─────────────────────────────
    // If the parent edited sport / level / school on this link, any PENDING
    // CalendarSyncRequest tied to the OLD values is no longer accurate. Delete
    // it so they can issue a fresh request with the corrected info.
    // APPROVED requests are LEFT IN PLACE — those represent the AD's decision
    // and shouldn't disappear behind their back.
    const sportChanged = sport !== undefined && (sport || null) !== existing.sport;
    const levelChanged = gradeLevel !== undefined && (gradeLevel || null) !== existing.gradeLevel;

    if (sportChanged || levelChanged || schoolChanged) {
      try {
        // Delete any sync request rows (PENDING or REJECTED) that no longer
        // correspond to a current link. APPROVED rows are kept — they
        // represent the AD's deliberate decision.
        //
        // We compute the slot keys of the parent's links AFTER this edit
        // and delete any sync requests at the old school whose sport/level
        // don't match any current link.
        const remainingLinks = await prisma.parentAthleteLink.findMany({
          where: { parentUserId: user.id, schoolId: existing.schoolId },
          select: { sport: true, gradeLevel: true },
        });
        const validKeys = new Set(
          remainingLinks
            .filter((l) => l.sport && l.gradeLevel)
            .map((l) => `${l.sport!.toLowerCase()}|${l.gradeLevel!.toLowerCase()}`)
        );

        const candidates = await prisma.calendarSyncRequest.findMany({
          where: {
            parentUserId: user.id,
            schoolId: existing.schoolId,
            status: { in: ["PENDING", "REJECTED"] },
          },
          select: { id: true, sportName: true, sportLevel: true },
        });

        const orphanIds = candidates
          .filter((c) => !validKeys.has(`${c.sportName.toLowerCase()}|${c.sportLevel.toLowerCase()}`))
          .map((c) => c.id);

        if (orphanIds.length > 0) {
          await prisma.calendarSyncRequest.deleteMany({
            where: { id: { in: orphanIds } },
          });
        }
      } catch (err) {
        console.warn("[API] Failed to delete stale sync requests:", err);
      }
    }

    // Keep ConnectedParent in sync
    try {
      await prisma.connectedParent.updateMany({
        where: {
          parentUserId: user.id,
          schoolId: existing.schoolId, // match by old schoolId
        },
        data: {
          ...(schoolChanged ? { schoolId: organizationId } : {}),
          ...(sport !== undefined ? { sportName: sport || null } : {}),
          ...(gradeLevel !== undefined ? { sportLevel: gradeLevel || null } : {}),
        },
      });
    } catch (err) {
      console.warn("[API] Failed to sync ConnectedParent update:", err);
    }

    // Bust the parent's dashboard cache so the new values show immediately
    try {
      const { invalidate } = await import("@/lib/cache/redisCache");
      void invalidate(`parent:overview:${user.id}`);
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      link: {
        id: updated.id,
        athleteName: updated.athleteName,
        sport: updated.sport,
        gradeLevel: updated.gradeLevel,
        schoolId: updated.schoolId,
        status: updated.status,
      },
      schoolChanged,
      message: schoolChanged
        ? "Child info updated. School change requires approval from the new athletic director."
        : "Child info updated successfully.",
    });
  } catch (error: any) {
    console.error("[API] Error updating athlete link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update child info" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parent/athlete-links/[id]
 * Removes a child/sport link entirely.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getParentSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    const existing = await prisma.parentAthleteLink.findUnique({
      where: { id },
      select: { id: true, parentUserId: true, schoolId: true, sport: true, gradeLevel: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Child link not found" }, { status: 404 });
    }

    if (existing.parentUserId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the link AND any sync requests tied to it (so the AD's table
    // doesn't keep ghost rows for children that no longer exist).
    await prisma.$transaction([
      prisma.calendarSyncRequest.deleteMany({
        where: {
          parentUserId: user.id,
          schoolId: existing.schoolId,
          // Only delete requests matching THIS link's sport+level — a parent may
          // have multiple links at the same school for different sports.
          sportName: existing.sport ?? undefined,
          sportLevel: existing.gradeLevel ?? undefined,
        },
      }),
      prisma.parentAthleteLink.delete({ where: { id } }),
    ]);

    // Invalidate the parent's cached dashboard so the removed child disappears immediately
    const { invalidate } = await import("@/lib/cache/redisCache");
    void invalidate(`parent:overview:${user.id}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Error deleting athlete link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove child link" },
      { status: 500 }
    );
  }
}
