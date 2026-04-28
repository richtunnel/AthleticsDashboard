import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { extractRequestMetadataFromHeaders } from "@/lib/utils/requestMetadata";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ collaboratorId: string }> }
) {
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
    const { collaboratorId } = await params;

    // Get the collaborator
    const collaborator = await prisma.collaborativeMember.findUnique({
      where: { id: collaboratorId },
      select: {
        id: true,
        userId: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        { success: false, message: "Collaborator not found" },
        { status: 404 }
      );
    }

    // Verify ownership (only the owner can revoke)
    if (collaborator.userId !== userId) {
      return NextResponse.json(
        { success: false, message: "You are not authorized to revoke this collaborator" },
        { status: 403 }
      );
    }

    // Check if already revoked
    if (collaborator.status === "REVOKED") {
      return NextResponse.json(
        { success: false, message: "This collaborator access has already been revoked" },
        { status: 400 }
      );
    }

    // Get optional reason from query params
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason") || undefined;

    // Soft delete - mark as revoked
    await prisma.collaborativeMember.update({
      where: { id: collaboratorId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokeReason: reason || "Revoked by account owner",
      },
    });

    // Log the revocation
    const metadata = extractRequestMetadataFromHeaders(request.headers);
    await prisma.collaborationAuditLog.create({
      data: {
        action: "MEMBER_REVOKED",
        ownerId: userId,
        targetEmail: collaborator.email,
        collaboratorId: collaborator.id,
        role: collaborator.role,
        details: reason || "Collaborator access revoked by account owner",
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Collaborator access revoked successfully",
    });

  } catch (error) {
    console.error("Error revoking collaborator:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while revoking collaborator access" },
      { status: 500 }
    );
  }
}