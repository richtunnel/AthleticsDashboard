import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { isInvitationExpired } from "@/lib/utils/collaboration";
import { verifyInvitationToken } from "@/lib/utils/collaborationTokens";

/**
 * GET /api/collaboration/accept-invitation/details?token=...
 * Returns invitation details without requiring auth or accepting.
 * Used by the accept-invitation page to show invite info before sign-in.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Invalid invitation token" },
        { status: 400 }
      );
    }

    const decodedToken = verifyInvitationToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired invitation token" },
        { status: 400 }
      );
    }

    const { email, ownerId, role, invitedAt, expiresAt } = decodedToken;

    if (isInvitationExpired(invitedAt, expiresAt)) {
      return NextResponse.json(
        { success: false, message: "This invitation has expired. Please request a new invitation." },
        { status: 400 }
      );
    }

    const invitation = await prisma.collaborativeMember.findFirst({
      where: {
        token,
        email,
        status: "PENDING",
        revokedAt: null,
      },
      include: {
        owner: {
          select: {
            name: true,
            email: true,
            organization: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, message: "Invitation not found or already accepted" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invitation: {
        email,
        role,
        ownerName: invitation.owner.name || "Account Owner",
        organizationName: invitation.owner.organization?.name || "the organization",
        ownerEmail: invitation.owner.email,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Error fetching invitation details:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while loading the invitation" },
      { status: 500 }
    );
  }
}
