import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { z } from "zod";

const approveSchema = z.object({
  googleCalendarId: z.string().optional(),
  // AD can override / confirm the gender ("boys", "girls", "mixed") and scope
  // the sync to a specific imported workbook from Game Center.
  gender: z.string().max(20).optional().nullable(),
  workbookId: z.string().cuid().optional().nullable(),
  // Legacy: external Google Sheet URL/ID. Still accepted for backward compat
  // but the workbookId field is preferred (it points to an imported workbook).
  spreadsheetId: z.string().max(200).optional().nullable(),
});

/**
 * POST /api/admin/calendar-sync-requests/[id]/approve
 * Approves a calendar sync request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAnySession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { gender, workbookId, spreadsheetId } = approveSchema.parse(body);

    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
    });

    if (!syncRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (syncRequest.schoolId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If a workbookId was supplied, verify it belongs to an AD/coach of this
    // organization. Resolves collaborators back to the AD owner so coaches /
    // assistant ADs can pick from the AD's workbooks.
    let resolvedWorkbookId: string | null | undefined = undefined;
    if (workbookId) {
      const workbook = await prisma.gamesWorkbook.findUnique({
        where: { id: workbookId },
        select: { id: true, user: { select: { organizationId: true } } },
      });
      if (!workbook || workbook.user.organizationId !== user.organizationId) {
        return NextResponse.json(
          { error: "Selected workbook does not belong to your organization" },
          { status: 400 }
        );
      }
      resolvedWorkbookId = workbook.id;
    } else if (workbookId === null) {
      resolvedWorkbookId = null; // explicit clear
    }

    // Normalise gender to canonical form so matching works regardless of how the
    // AD typed it ("F", "female", "Girls" all become "girls").
    const { CalendarService } = await import("@/lib/services/calendar.service");
    const normalisedGender = gender
      ? CalendarService.normaliseGender(gender)
      : undefined;

    // Legacy: extract sheet ID from a full Google Sheets URL if the AD pasted one
    const normalisedSheetId = spreadsheetId
      ? (spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? spreadsheetId.trim()) || null
      : spreadsheetId === null
      ? null
      : undefined;

    const updatedRequest = await prisma.calendarSyncRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: user.id,
        ...(normalisedGender !== undefined ? { gender: normalisedGender } : {}),
        ...(resolvedWorkbookId !== undefined ? { workbookId: resolvedWorkbookId } : {}),
        ...(normalisedSheetId !== undefined ? { spreadsheetId: normalisedSheetId } : {}),
      },
    });

    // ── Reset the parentAthleteLink to ACTIVE ─────────────────────────────
    // The link's own `status` column can be left in "PENDING" after a school
    // change (the parent edited their school). Approval here is the implicit
    // green-light, so flip the matching link back to ACTIVE — otherwise the
    // parent's dashboard shows a misleading PENDING badge next to an
    // APPROVED calendar sync.
    try {
      await prisma.parentAthleteLink.updateMany({
        where: {
          parentUserId: syncRequest.parentUserId,
          schoolId: syncRequest.schoolId,
          sport: { equals: syncRequest.sportName, mode: "insensitive" },
          gradeLevel: { equals: syncRequest.sportLevel, mode: "insensitive" },
          status: { not: "ACTIVE" },
        },
        data: { status: "ACTIVE" },
      });
    } catch (err) {
      console.warn("[approve] failed to reset link.status to ACTIVE:", err);
    }

    // ── Upsert ConnectedParent so AD's tab actually shows this parent ─────
    // This is wrapped in its own try so a ConnectedParent failure can never
    // mask the successful sync-request approval (which is the user-visible
    // outcome). Log loudly if anything goes wrong so we can diagnose.
    const parentRecord = await prisma.user.findUnique({
      where: { id: syncRequest.parentUserId },
      select: { email: true, name: true, organizationId: true },
    });

    if (!parentRecord) {
      console.error(
        `[approve] parent User row missing for id=${syncRequest.parentUserId} — cannot create ConnectedParent`
      );
    } else if (!parentRecord.email) {
      console.error(
        `[approve] parent has no email (id=${syncRequest.parentUserId}) — ConnectedParent.email is @unique, cannot upsert`
      );
    } else {
      try {
        const normalisedEmail = parentRecord.email.toLowerCase().trim();
        const upserted = await prisma.connectedParent.upsert({
          where: { email: normalisedEmail },
          create: {
            email: normalisedEmail,
            fullName: parentRecord.name || normalisedEmail,
            parentUserName: parentRecord.name || null,
            parentUserId: syncRequest.parentUserId,
            schoolId: syncRequest.schoolId,
            sportName: syncRequest.sportName,
            sportLevel: syncRequest.sportLevel,
            calendarSynced: true,
            membershipStatus: "ACTIVE",
          },
          update: {
            // Critical: force schoolId to match the approving AD's org, in
            // case an old ConnectedParent row points at a different school.
            schoolId: syncRequest.schoolId,
            parentUserId: syncRequest.parentUserId,
            fullName: parentRecord.name || normalisedEmail,
            parentUserName: parentRecord.name || null,
            sportName: syncRequest.sportName,
            sportLevel: syncRequest.sportLevel,
            calendarSynced: true,
            membershipStatus: "ACTIVE",
          },
        });
        console.log(
          `[approve] ConnectedParent ${upserted.id} ready: schoolId=${upserted.schoolId} email=${upserted.email}`
        );
      } catch (err) {
        console.error("[approve] ConnectedParent upsert FAILED:", err);
        // Don't fail the whole approval — the sync request is already updated
      }
    }

    // ── Bust the AD's cached Connected Parents query (Redis layer) ─────────
    try {
      const { invalidatePattern } = await import("@/lib/cache/redisCache");
      void invalidatePattern(`connectedParents:${syncRequest.schoolId}:*`);
    } catch { /* ignore */ }

    // Publish a real-time event so every connected AD tab refreshes
    // (no polling). The `useChatNotifications` hook listens on this channel
    // and invalidates the sync-requests + connected-parents queries.
    try {
      const { publishChatEvent } = await import("@/lib/chat/eventBus");
      void publishChatEvent(`sync:${syncRequest.schoolId}`, {
        type: "sync_request_updated",
        requestId: syncRequest.id,
        status: "APPROVED",
      });
    } catch (err) {
      console.warn("[approve] failed to publish sync event:", err);
    }

    return NextResponse.json({
      request: {
        ...updatedRequest,
        reviewedAt: updatedRequest.reviewedAt?.toISOString(),
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    console.error("[API] Error approving calendar sync request:", error);
    return NextResponse.json(
      { error: "Failed to approve request" },
      { status: 500 }
    );
  }
}
