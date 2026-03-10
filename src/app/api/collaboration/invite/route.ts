import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getCollaboratorLimit } from "@/lib/utils/collaboration";
import { generateInvitationToken } from "@/lib/utils/collaborationTokens";
import { CollaborativeRole } from "@prisma/client";
import { emailService } from "@/lib/services/email.service";
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
    const { email, role } = body;

    // Validate email
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Validate role
    if (!role || !["VIEWER", "MEMBER"].includes(role)) {
      return NextResponse.json(
        { success: false, message: "Invalid role selected" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Prevent inviting yourself
    if (user.email.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: "You cannot invite yourself to collaborate on your own account" },
        { status: 400 }
      );
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
          message: `You have reached your collaborator limit (${collaboratorLimit}). Upgrade your plan to invite more collaborators.` 
        },
        { status: 400 }
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
      select: {
        id: true,
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { success: false, message: "This person has already been invited to your account" },
        { status: 400 }
      );
    }

    // Check if already a member (accepted invitation)
    const existingMember = await prisma.collaborativeMember.findFirst({
      where: {
        userId: userId,
        email: email.toLowerCase(),
        status: "ACCEPTED",
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, message: "This person is already a member of your account" },
        { status: 400 }
      );
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

    // Create the invitation
    const collaborator = await prisma.collaborativeMember.create({
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
        acceptUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://opletics.com"}/api/collaboration/accept-invitation?token=${token}`,
        expiresAt,
      });
      emailSent = true;
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      emailErrorMessage = errorMessage;
      console.error("Failed to send invitation email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Invitation sent successfully"
        : "Invitation created but email failed to send. Please check your email configuration.",
      collaboratorId: collaborator.id,
      emailSent,
      emailError: emailErrorMessage,
    });
  } catch (error) {
    console.error("Error inviting collaborator:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while sending the invitation" },
      { status: 500 }
    );
  }
}
