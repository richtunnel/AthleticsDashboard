import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { isInvitationExpired } from "@/lib/utils/collaboration";
import { verifyInvitationToken } from "@/lib/utils/collaborationTokens";
import { CollaborativeRole, UserRole } from "@prisma/client";
import { extractRequestMetadataFromHeaders } from "@/lib/utils/requestMetadata";
import { getSiteUrl } from "@/lib/utils/siteUrl";

const roleMapping: Record<CollaborativeRole, UserRole> = {
  VIEWER: UserRole.VENDOR_READ_ONLY,
  MEMBER: UserRole.ASSISTANT_AD,
};


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Invalid invitation token" },
        { status: 400 }
      );
    }

    // Verify the token
    const decodedToken = verifyInvitationToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired invitation token" },
        { status: 400 }
      );
    }

    const { email, ownerId, role, invitedAt, expiresAt } = decodedToken;

    // Check if invitation has expired
    if (isInvitationExpired(invitedAt, expiresAt)) {
      // Mark as expired in the database
      await prisma.collaborativeMember.updateMany({
        where: {
          token: token,
          status: "PENDING",
        },
        data: {
          status: "EXPIRED",
        },
      });

      // Log expiration
      await prisma.collaborationAuditLog.create({
        data: {
          action: "INVITE_EXPIRED",
          ownerId: ownerId,
          targetEmail: email,
          details: "Invitation expired before being accepted",
        },
      });

      return NextResponse.json(
        { success: false, message: "This invitation has expired. Please request a new invitation." },
        { status: 400 }
      );
    }

    // Find the invitation in the database
    const invitation = await prisma.collaborativeMember.findFirst({
      where: {
        token: token,
        email: email,
        status: "PENDING",
        revokedAt: null,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            organization: {
              select: {
                name: true,
              },
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

    // Check if invitation was revoked
    if (invitation.revokedAt) {
      return NextResponse.json(
        { success: false, message: "This invitation has been revoked" },
        { status: 400 }
      );
    }

    // Always redirect to the client-side page so the browser can call update()
    // to refresh the session after acceptance. Auto-accepting here would skip
    // that step and leave the UI with a stale session.
    const siteUrl = getSiteUrl().replace(/\/$/, "");
    const acceptPageUrl = new URL(`${siteUrl}/accept-invitation`);
    acceptPageUrl.searchParams.set("token", token);
    return NextResponse.redirect(acceptPageUrl);

  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while processing the invitation" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Invalid invitation token" },
        { status: 400 }
      );
    }

    // Verify the token
    const decodedToken = verifyInvitationToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired invitation token" },
        { status: 400 }
      );
    }

    const { email, ownerId, role } = decodedToken;

    // Check if invitation has expired
    if (isInvitationExpired(decodedToken.invitedAt, decodedToken.expiresAt)) {
      return NextResponse.json(
        { success: false, message: "This invitation has expired. Please request a new invitation." },
        { status: 400 }
      );
    }

    // Find the invitation
    const invitation = await prisma.collaborativeMember.findFirst({
      where: {
        token: token,
        status: "PENDING",
        revokedAt: null,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, message: "Invitation not found or already accepted" },
        { status: 404 }
      );
    }

    // Check if the user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to accept this invitation" },
        { status: 401 }
      );
    }

    // Verify the email matches
    if ((session.user.email ?? "").toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          message: "This invitation was sent to a different email address"
        },
        { status: 400 }
      );
    }

    // Fetch the owner so we can copy org and school details to the collaborator
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        organizationId: true,
        schoolName: true,
        teamName: true,
        schoolAddress: true,
        city: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, message: "Inviting account not found" },
        { status: 404 }
      );
    }

    const mappedRole = roleMapping[role as CollaborativeRole] ?? UserRole.VENDOR_READ_ONLY;

    // Atomically accept the invitation and integrate the collaborator into the org
    await prisma.$transaction([
      prisma.collaborativeMember.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          organizationId: owner.organizationId,
          role: mappedRole,
          schoolName: owner.schoolName,
          teamName: owner.teamName,
          schoolAddress: owner.schoolAddress,
          city: owner.city,
        },
      }),
    ]);

    // Log the acceptance (outside transaction — non-critical)
    const metadata = extractRequestMetadataFromHeaders(request.headers);
    await prisma.collaborationAuditLog.create({
      data: {
        action: "INVITE_ACCEPTED",
        ownerId: ownerId,
        targetEmail: email,
        collaboratorId: invitation.id,
        role: role as CollaborativeRole,
        details: `Invitation accepted by ${email}`,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invitation accepted successfully",
      redirectUrl: `/dashboard?collaboration=accepted`,
    });

  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while accepting the invitation" },
      { status: 500 }
    );
  }
}