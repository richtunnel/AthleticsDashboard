import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { isCollaborator: false },
        { status: 200 }
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email?.toLowerCase();

    if (!userEmail) {
      return NextResponse.json(
        { isCollaborator: false },
        { status: 200 }
      );
    }

    // Check if this user is a collaborator on any account
    const collaboration = await prisma.collaborativeMember.findFirst({
      where: {
        email: userEmail,
        status: "ACCEPTED",
        revokedAt: null,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            organization: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!collaboration) {
      return NextResponse.json(
        { isCollaborator: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      isCollaborator: true,
      ownerUserId: collaboration.owner.id,
      ownerEmail: collaboration.owner.email,
      ownerName: collaboration.owner.name,
      role: collaboration.role,
      organizationName: collaboration.owner.organization?.name,
    });

  } catch (error) {
    console.error("Error checking membership:", error);
    return NextResponse.json(
      { isCollaborator: false },
      { status: 200 }
    );
  }
}