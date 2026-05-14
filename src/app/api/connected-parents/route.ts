import { getAnySession } from "@/lib/utils/collaboratorSession";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/connected-parents
 * Returns list of parents connected to the AD's school for the Connect menu
 */
export async function GET(request: Request) {
  try {
    const session = await getAnySession();
    
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Get connected parents for the user's organization directly with pagination
    const [connectedParents, total] = await Promise.all([
      prisma.connectedParent.findMany({
        where: {
          schoolId: user.organizationId,
        },
        include: {
          school: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.connectedParent.count({
        where: {
          schoolId: user.organizationId,
        },
      }),
    ]);

    // Batch-fetch parentCode for each connected parent (User model)
    const parentUserIds = connectedParents
      .map((p: any) => p.parentUserId)
      .filter(Boolean) as string[];

    const parentCodeMap = new Map<string, string | null>();
    if (parentUserIds.length > 0) {
      const parentUsers = await prisma.user.findMany({
        where: { id: { in: parentUserIds } },
        select: { id: true, parentCode: true },
      });
      for (const pu of parentUsers) {
        parentCodeMap.set(pu.id, pu.parentCode ?? null);
      }
    }

    return Response.json({
      parents: connectedParents.map((p: any) => ({
        id: p.id,
        parentUserId: p.parentUserId,
        parentUserName: p.parentUserName || p.fullName,
        parentEmail: p.email,
        parentCode: parentCodeMap.get(p.parentUserId) ?? null,
        schoolId: p.schoolId,
        schoolName: p.school.name,
        sportName: p.sportName,
        sportLevel: p.sportLevel,
        calendarSynced: p.calendarSynced,
        lastSyncedAt: p.lastSyncedAt?.toISOString(),
        membershipStatus: p.membershipStatus,
        createdAt: p.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching connected parents:", error);
    return Response.json(
      { error: "Failed to fetch connected parents" },
      { status: 500 }
    );
  }
}
