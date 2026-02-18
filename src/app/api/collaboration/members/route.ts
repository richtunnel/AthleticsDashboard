import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getCollaboratorLimit } from "@/lib/utils/collaboration";

export async function GET(request: NextRequest) {
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

    // Get the user and their plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Get collaborators (only active ones - not revoked)
    const collaborators = await prisma.collaborativeMember.findMany({
      where: {
        userId: userId,
        revokedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        invitedAt: true,
        acceptedAt: true,
        revokedAt: true,
        revokeReason: true,
        emailSent: true,
        emailSentAt: true,
        emailError: true,
      },
      orderBy: [
        { status: "asc" }, // PENDING first
        { invitedAt: "desc" }, // Most recent first
      ],
    });

    const collaboratorLimit = getCollaboratorLimit(user.plan);
    const usedSlots = collaborators.length;
    const availableSlots = Math.max(0, collaboratorLimit - usedSlots);

    // Format the response
    const members = collaborators.map(collab => ({
      id: collab.id,
      email: collab.email,
      role: collab.role,
      status: collab.status,
      invitedAt: collab.invitedAt,
      acceptedAt: collab.acceptedAt,
      revokedAt: collab.revokedAt,
      revokeReason: collab.revokeReason,
      emailSent: collab.emailSent,
      emailSentAt: collab.emailSentAt,
      emailError: collab.emailError,
    }));

    return NextResponse.json({
      success: true,
      members,
      totalCount: collaborators.length,
      usedSlots,
      availableSlots,
      collaboratorLimit,
    });

  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while fetching collaborators" },
      { status: 500 }
    );
  }
}