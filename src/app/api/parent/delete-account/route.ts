import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { revokeGoogleToken } from "@/lib/google/revoke";
import { createSignupLog } from "@/lib/services/signup-log.service";

/**
 * DELETE /api/parent/delete-account
 *
 * Permanently deletes the authenticated parent's account and all associated data.
 *
 * Explicit deletions (no cascade):
 *   - ConnectedParent  — parentUserId is a plain String field with no User FK relation,
 *                        so Prisma cascade never reaches it.
 *
 * Cascade-handled (via User FK onDelete: Cascade):
 *   - Conversation + ChatMessage
 *   - CalendarSyncRequest
 *   - ParentAthleteLink
 *   - ParentSubscription
 */
export async function DELETE() {
  try {
    const session = await getParentSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const sessionUserId = (session.user as any).id as string | undefined;
    const user = sessionUserId
      ? await prisma.user.findUnique({
          where: { id: sessionUserId },
          select: {
            id: true,
            googleCalendarRefreshToken: true,
            googleCalendarAccessToken: true,
          },
        })
      : await prisma.user.findFirst({
          where: { email: { equals: session.user.email, mode: "insensitive" } },
          select: {
            id: true,
            googleCalendarRefreshToken: true,
            googleCalendarAccessToken: true,
          },
        });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Revoke any connected Google Calendar tokens
    const tokensToRevoke = new Set<string>();
    if (user.googleCalendarRefreshToken) tokensToRevoke.add(user.googleCalendarRefreshToken);
    if (user.googleCalendarAccessToken) tokensToRevoke.add(user.googleCalendarAccessToken);

    if (tokensToRevoke.size > 0) {
      await Promise.allSettled(
        Array.from(tokensToRevoke).map((token) => revokeGoogleToken(token))
      );
    }

    // ConnectedParent.parentUserId is a bare String — no User FK, no cascade.
    // Must be deleted explicitly before the User row is removed.
    await prisma.connectedParent.deleteMany({ where: { parentUserId: user.id } });

    // Record the deleted email so re-registration is blocked for 90 days
    await createSignupLog({
      email: session.user.email,
      deletedUserId: user.id,
      reason: "account_deleted",
    });

    // Delete the user — Prisma cascades:
    //   Conversation, ChatMessage, CalendarSyncRequest, ParentAthleteLink, ParentSubscription
    await prisma.user.delete({ where: { id: user.id } });

    return NextResponse.json({ success: true, message: "Account deleted successfully" });
  } catch (error: any) {
    console.error("[API] Error deleting parent account:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
