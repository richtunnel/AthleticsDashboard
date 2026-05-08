import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { getResendClientOptional } from "@/lib/resend";
import { chatEventBus } from "@/lib/chat/eventBus";

const MONTHLY_REQUEST_LIMIT = 5;

/**
 * POST /api/parent/calendar-sync-request-full
 *
 * Creates a calendar sync request and simultaneously:
 *  1. Emails the Athletic Director with an "Approve Parent" button
 *  2. Sends an automated chat message to the AD conversation
 *  3. Emits an SSE signal notification so the AD's header badge updates
 *
 * Rate-limited to MONTHLY_REQUEST_LIMIT requests per calendar month.
 * The button is disabled on the client once a PENDING / APPROVED request exists
 * OR the monthly cap is reached.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getParentSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { linkId, schoolId, sportName, sportLevel } = body;

    if (!linkId || !schoolId || !sportName || !sportLevel) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify parent owns this link
    const link = await prisma.parentAthleteLink.findFirst({
      where: { id: linkId, parentUserId: user.id, schoolId },
      select: { id: true, athleteName: true, gradeLevel: true },
    });

    if (!link) {
      return NextResponse.json({ error: "You are not linked to this school" }, { status: 403 });
    }

    // ── Monthly rate-limit check ──────────────────────────────────────────────
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyCount = await prisma.calendarSyncRequest.count({
      where: {
        parentUserId: user.id,
        requestedAt: { gte: monthStart },
      },
    });

    if (monthlyCount >= MONTHLY_REQUEST_LIMIT) {
      return NextResponse.json(
        {
          error: `You have reached your ${MONTHLY_REQUEST_LIMIT} sync requests for this month. The limit resets on the 1st of next month.`,
          monthlyCount,
          monthlyLimit: MONTHLY_REQUEST_LIMIT,
          limitReached: true,
        },
        { status: 429 }
      );
    }

    // ── Check for existing active request ────────────────────────────────────
    const existing = await prisma.calendarSyncRequest.findFirst({
      where: {
        parentUserId: user.id,
        schoolId,
        sportName,
        sportLevel,
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: { id: true, status: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `You already have a ${existing.status.toLowerCase()} request for this sport and level.`,
          alreadyRequested: true,
          status: existing.status,
        },
        { status: 400 }
      );
    }

    // ── Get Athletic Director for this school ─────────────────────────────────
    const ad = await prisma.user.findFirst({
      where: {
        organizationId: schoolId,
        role: { in: ["ATHLETIC_DIRECTOR", "ASSISTANT_AD"] },
      },
      select: { id: true, name: true, email: true, organizationId: true },
      orderBy: { role: "asc" }, // ASSISTANT_AD > ATHLETIC_DIRECTOR alphabetically; pick AD first
    });

    const school = await prisma.organization.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });

    const schoolName = school?.name ?? "your school";
    const childName = link.athleteName || "their child";
    const parentName = user.name || user.email;

    // ── 1. Create CalendarSyncRequest record ──────────────────────────────────
    const syncRequest = await prisma.calendarSyncRequest.create({
      data: {
        parentUserId: user.id,
        schoolId,
        sportName,
        sportLevel,
      },
    });

    // ── 2. Email the AD ───────────────────────────────────────────────────────
    if (ad?.email) {
      const appBaseUrl = process.env.NEXTAUTH_URL || "https://app.opletics.com";
      const approveUrl = `${appBaseUrl}/dashboard/parents`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">📅 Parent Calendar Sync Request</h2>
          <p>Hi ${ad.name ?? "Coach"},</p>
          <p>
            <strong>${parentName}</strong> is requesting to sync their Google Calendar
            with the <strong>${sportName} (${sportLevel})</strong> schedule at
            <strong>${schoolName}</strong> for their child <strong>${childName}</strong>.
          </p>
          <p>
            Once you approve, their calendar will automatically stay up-to-date whenever
            you update the game schedule.
          </p>
          <div style="margin: 32px 0; text-align: center;">
            <a
              href="${approveUrl}"
              style="
                background-color: #1976d2;
                color: white;
                padding: 14px 28px;
                text-decoration: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                display: inline-block;
              "
            >
              Approve Parent →
            </a>
          </div>
          <p style="color: #666; font-size: 13px;">
            This button takes you to the <strong>Parents</strong> section of your Opletics
            dashboard where you can review and approve the request.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">
            Sent via Opletics Parent Portal · ${schoolName}
          </p>
        </div>
      `;

      try {
        const resend = getResendClientOptional();
        if (resend) {
          await resend.emails.send({
            from: "Opletics <noreply@opletics.com>",
            to: ad.email,
            subject: `📅 Calendar Sync Request — ${parentName} · ${sportName} ${sportLevel}`,
            html: emailHtml,
          });
        }
      } catch (emailErr) {
        console.error("[SyncRequest] Email send failed (non-blocking):", emailErr);
      }
    }

    // ── 3. Auto-create chat message to AD ─────────────────────────────────────
    if (ad) {
      try {
        await prisma.$transaction(async (tx) => {
          // Find or create the conversation
          let conversation = await tx.conversation.findUnique({
            where: {
              parentUserId_schoolId: { parentUserId: user.id, schoolId },
            },
          });

          if (!conversation) {
            conversation = await tx.conversation.create({
              data: { parentUserId: user.id, schoolId },
            });
          }

          const messageContent =
            `Hi! I'd like to request a calendar sync for ${childName}'s ` +
            `${sportName} (${sportLevel}) schedule at ${schoolName}. ` +
            `Once approved, my Google Calendar will automatically stay updated ` +
            `with any schedule changes. Thank you!`;

          const msg = await tx.chatMessage.create({
            data: {
              conversationId: conversation.id,
              senderUserId: user.id,
              content: messageContent,
            },
          });

          await tx.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
          });

          // ── 4. SSE signal notification to AD dashboard ────────────────────
          chatEventBus.emit(`school:${schoolId}`, {
            id: msg.id,
            conversationId: conversation.id,
            senderUserId: user.id,
            senderName: parentName,
            content: messageContent,
            createdAt: msg.createdAt.toISOString(),
          });
        });
      } catch (chatErr) {
        console.error("[SyncRequest] Chat message failed (non-blocking):", chatErr);
      }
    }

    return NextResponse.json({
      success: true,
      requestId: syncRequest.id,
      monthlyCount: monthlyCount + 1,
      monthlyLimit: MONTHLY_REQUEST_LIMIT,
      remainingRequests: MONTHLY_REQUEST_LIMIT - (monthlyCount + 1),
    });
  } catch (error: any) {
    console.error("[API] Error creating full sync request:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create sync request" },
      { status: 500 }
    );
  }
}
