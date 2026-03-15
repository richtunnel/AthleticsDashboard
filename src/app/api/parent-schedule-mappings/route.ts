import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * GET /api/parent-schedule-mappings
 * Returns approved mappings for the AD's organizations.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"].includes(user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const organizations = await prisma.organization.findMany({
      where: { users: { some: { id: user.id } } },
      select: { id: true },
    });
    const orgIds = organizations.map((o) => o.id);

    const mappings = await prisma.parentScheduleMapping.findMany({
      where: {
        organizationId: { in: orgIds },
        status: "APPROVED",
      },
      include: {
        parentAthleteLink: {
          select: {
            athleteName: true,
            sport: true,
            gradeLevel: true,
            parent: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ mappings });
  } catch (error) {
    console.error("[API] Error fetching schedule mappings:", error);
    return Response.json(
      { error: "Failed to fetch mappings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parent-schedule-mappings
 * Creates/approves a mapping for a parent request.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"].includes(user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const {
      parentAthleteLinkId,
      columnName,
      columnValue,
      secondaryColumnName,
      secondaryColumnValue,
      matchScore,
    } = body;

    if (!parentAthleteLinkId || !columnName || !columnValue) {
      return Response.json(
        { error: "parentAthleteLinkId, columnName, and columnValue are required" },
        { status: 400 }
      );
    }

    // Verify the link belongs to the user's organization
    const link = await prisma.parentAthleteLink.findUnique({
      where: { id: parentAthleteLinkId },
      include: { school: { select: { id: true, users: { where: { id: user.id }, select: { id: true } } } } },
    });

    if (!link || link.school.users.length === 0) {
      return Response.json({ error: "Parent request not found or unauthorized" }, { status: 404 });
    }

    // Create the mapping
    const mapping = await prisma.parentScheduleMapping.create({
      data: {
        parentAthleteLinkId,
        organizationId: link.schoolId,
        approvedByUserId: user.id,
        parentSportName: link.sport || "",
        parentSportLevel: link.gradeLevel || "",
        columnName: columnName.trim(),
        columnValue: columnValue.trim(),
        secondaryColumnName: secondaryColumnName?.trim() || null,
        secondaryColumnValue: secondaryColumnValue?.trim() || null,
        matchScore: matchScore || 0,
        status: "APPROVED",
      },
    });

    // Update the link status to APPROVED
    await prisma.parentAthleteLink.update({
      where: { id: parentAthleteLinkId },
      data: { status: "APPROVED" },
    });

    return Response.json({ mapping }, { status: 201 });
  } catch (error: unknown) {
    console.error("[API] Error creating schedule mapping:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json(
        { error: "A mapping already exists for this parent and column value" },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "Failed to create mapping" },
      { status: 500 }
    );
  }
}
