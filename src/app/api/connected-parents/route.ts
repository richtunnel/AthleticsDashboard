import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * GET /api/connected-parents
 * Returns list of parents connected to the AD's school for the Connect menu
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"].includes(user.role)) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get all organizations the user has access to
    const organizations = await prisma.organization.findMany({
      where: {
        users: {
          some: {
            id: user.id,
          },
        },
      },
      select: { id: true },
    });

    const orgIds = organizations.map(org => org.id);

    // Get connected parents for these organizations
    const connectedParents = await prisma.connectedParent.findMany({
      where: {
        schoolId: { in: orgIds },
      },
      include: {
        school: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      parents: connectedParents.map(p => ({
        id: p.id,
        parentUserId: p.parentUserId,
        parentUserName: p.parentUserName,
        parentEmail: p.parentEmail,
        schoolId: p.schoolId,
        schoolName: p.school.name,
        sportName: p.sportName,
        sportLevel: p.sportLevel,
        calendarSynced: p.calendarSynced,
        lastSyncedAt: p.lastSyncedAt?.toISOString(),
        membershipStatus: p.membershipStatus,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching connected parents:", error);
    return Response.json(
      { error: "Failed to fetch connected parents" },
      { status: 500 }
    );
  }
}
