import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import { CollaborativeRole } from "@prisma/client";
import { isInvitationExpired } from "@/lib/utils/collaboration";
import { extractRequestMetadataFromHeaders } from "@/lib/utils/requestMetadata";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { collaboratorId } = body;

    // Validate collaboratorId
    if (!collaboratorId) {
      return NextResponse.json(
        { success: false, message: "Collaborator ID is required" },
        { status: 400 }
      );
    }

    // Get the collaborator record
    const collaborator = await prisma.collaborativeMember.findFirst({
      where: {
        id: collaboratorId,
        userId: userId, // Ensure the user owns this invitation
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        { success: false, message: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check if the invitation is still valid
    const invitedAt = collaborator.invitedAt;
    const expiresAt = new Date(invitedAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours from invite

    if (isInvitationExpired(invitedAt, expiresAt)) {
      return NextResponse.json(
        { success: false, message: "This invitation has expired. Please create a new invitation." },
        { status: 400 }
      );
    }

    // Check if the invitation has already been accepted
    if (collaborator.status === "ACCEPTED") {
      return NextResponse.json(
        { success: false, message: "This invitation has already been accepted." },
        { status: 400 }
      );
    }

    // Check if the invitation has been revoked
    if (collaborator.status === "REVOKED") {
      return NextResponse.json(
        { success: false, message: "This invitation has been revoked." },
        { status: 400 }
      );
    }

    // Get the inviter's info
    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
      },
    });

    if (!inviter) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Check if already invited and accepted (safety check)
    const existingMember = await prisma.collaborativeMember.findFirst({
      where: {
        userId: userId,
        email: collaborator.email,
        status: "ACCEPTED",
        revokedAt: null,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, message: "This person is already a member of your account" },
        { status: 400 }
      );
    }

    // Resend the invitation email
    try {
      await emailService.sendCollaborationInviteEmail({
        to: collaborator.email,
        inviterName: inviter.name || "A team member",
        role: collaborator.role as CollaborativeRole,
        acceptUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://opletics.com"}/api/collaboration/accept-invitation?token=${collaborator.token}`,
        expiresAt,
      });

      // Update collaborator record to mark email as sent
      await prisma.collaborativeMember.update({
        where: { id: collaborator.id },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
          emailError: null, // Clear any previous error
        },
      });

      // Log the resend
      const metadata = extractRequestMetadataFromHeaders(request.headers);
      await prisma.collaborationAuditLog.create({
        data: {
          action: "EMAIL_RESENT",
          ownerId: userId,
          targetEmail: collaborator.email,
          collaboratorId: collaborator.id,
          role: collaborator.role as CollaborativeRole,
          details: `Invitation email resent to ${collaborator.email}`,
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Invitation email sent successfully",
        collaboratorId: collaborator.id,
        emailSent: true,
      });
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      console.error("Failed to resend invitation email:", emailError);

      // Update collaborator record with email error
      await prisma.collaborativeMember.update({
        where: { id: collaborator.id },
        data: {
          emailError: errorMessage,
        },
      });

      return NextResponse.json({
        success: false,
        message: "Failed to send invitation email. Please check your email configuration.",
        error: errorMessage,
      });
    }
  } catch (error) {
    console.error("Error resending invitation email:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while resending the invitation email" },
      { status: 500 }
    );
  }
}
