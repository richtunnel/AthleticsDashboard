import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getCollaboratorLimit, isInvitationExpired } from "@/lib/utils/collaboration";
import { generateInvitationToken } from "@/lib/utils/collaborationTokens";
import { CollaborativeRole, CollaborationAction } from "@prisma/client";
import { emailService } from "@/lib/services/email.service";
import { extractRequestMetadataFromHeaders } from "@/lib/utils/requestMetadata";
import { normalizeAppUrl } from "@/lib/utils/siteUrl";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { email, role } = body;

    // Validate email
    if (!email || !email.includes("@")) {
      return NextResponse.json({ success: false, message: "Please enter a valid email address" }, { status: 400 });
    }

    // Validate role
    if (!role || !["VIEWER", "MEMBER"].includes(role)) {
      return NextResponse.json({ success: false, message: "Invalid role selected" }, { status: 400 });
    }

    // Get the user and their plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Prevent inviting yourself
    if (user.email.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json({ success: false, message: "You cannot invite yourself to collaborate on your own account" }, { status: 400 });
    }

    // Check collaborator limit
    const collaboratorLimit = getCollaboratorLimit(user.plan);
    const currentCollaborators = await prisma.collaborativeMember.count({
      where: {
        userId: userId,
        revokedAt: null,
      },
    });

    if (currentCollaborators >= collaboratorLimit) {
      return NextResponse.json(
        {
          success: false,
          message: `You have reached your collaborator limit (${collaboratorLimit}). Upgrade your plan to invite more collaborators.`,
        },
        { status: 403 },
      );
    }

    // Check if already invited (existing pending invitation)
    const existingInvitation = await prisma.collaborativeMember.findFirst({
      where: {
        userId: userId,
        email: email.toLowerCase(),
        revokedAt: null,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      return NextResponse.json({ success: false, message: "This person has already been invited to your account" }, { status: 400 });
    }

    // Check if already a member (accepted invitation)
    const existingMember = await prisma.collaborativeMember.findFirst({
      where: {
        userId: userId,
        email: email.toLowerCase(),
        status: "ACCEPTED",
        revokedAt: null,
      },
    });

    if (existingMember) {
      return NextResponse.json({ success: false, message: "This person is already a member of your account" }, { status: 400 });
    }

    // Generate invitation token
    const invitedAt = new Date();
    const expiresAt = new Date(invitedAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const token = generateInvitationToken({
      email: email.toLowerCase(),
      ownerId: userId,
      role: role as CollaborativeRole,
      invitedAt,
      expiresAt,
    });

    // Fix invitation URL - ensure it uses normalized app URL
    const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
    const acceptUrl = `${appUrl}/api/collaboration/accept-invitation?token=${token}`;

    // Create or re-activate the invitation.
    // The table has @@unique([userId, email]), so we must use an update if a record already exists
    // for this user/email combination to avoid unique constraint violations.
    const existingRecord = await prisma.collaborativeMember.findFirst({
      where: {
        userId: userId,
        email: email.toLowerCase(),
      },
    });

    const collaborator = existingRecord
      ? await prisma.collaborativeMember.update({
          where: { id: existingRecord.id },
          data: {
            role: role as CollaborativeRole,
            status: "PENDING",
            invitedAt,
            token,
            revokedAt: null,
            revokeReason: null,
            acceptedAt: null,
            emailSent: false,
            emailSentAt: null,
            emailError: null,
          },
        })
      : await prisma.collaborativeMember.create({
          data: {
            userId: userId,
            email: email.toLowerCase(),
            role: role as CollaborativeRole,
            status: "PENDING",
            invitedAt,
            token,
          },
        });

    // Log the invitation
    const metadata = extractRequestMetadataFromHeaders(request.headers);
    await prisma.collaborationAuditLog.create({
      data: {
        action: "INVITE_CREATED",
        ownerId: userId,
        targetEmail: email.toLowerCase(),
        collaboratorId: collaborator.id,
        role: role as CollaborativeRole,
        details: `Invitation sent to ${email}`,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    // Send invitation email and track status
    let emailSent = false;
    let emailErrorMessage: string | undefined;

    try {
      await emailService.sendCollaborationInviteEmail({
        to: email,
        inviterName: user.name || "A team member",
        role: role as CollaborativeRole,
        acceptUrl: acceptUrl,
        expiresAt,
        sentById: userId,
      });
      emailSent = true;

      // Update collaborator record to mark email as sent
      await prisma.collaborativeMember.update({
        where: { id: collaborator.id },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      emailErrorMessage = errorMessage;
      console.error("Failed to send invitation email:", emailError);

      // Update collaborator record with email error
      await prisma.collaborativeMember.update({
        where: { id: collaborator.id },
        data: {
          emailError: errorMessage,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: emailSent ? "Invitation sent successfully" : "Invitation created but email failed to send. Please check your email configuration.",
      collaboratorId: collaborator.id,
      emailSent,
      emailError: emailErrorMessage,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[CollaborationInvite] Failed:", {
      message: errorMessage,
      stack: errorStack,
      error,
    });
    return NextResponse.json(
      {
        success: false,
        message: `Failed to send invitation: ${errorMessage}`,
      },
      { status: 500 },
    );
  }
}
