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
 * Parent removes a child link from their account.
 *
 * Cascade-cleans related CalendarSyncRequests and ConnectedParent rows
 * so the AD's parent list reflects the removal immediately.
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
      select: { id: true, parentUserId: true, schoolId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Child link not found" }, { status: 404 });
    }

    if (existing.parentUserId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete related sync requests
    await prisma.calendarSyncRequest.deleteMany({
      where: { parentUserId: user.id, schoolId: existing.schoolId },
    });

    // Remove from AD's ConnectedParent list if present
    await prisma.connectedParent.deleteMany({
      where: { parentUserId: user.id, schoolId: existing.schoolId },
    });

    // Delete the link itself
    await prisma.parentAthleteLink.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Error deleting athlete link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete child link" },
      { status: 500 }
    );
  }
}
