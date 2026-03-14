import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/sport-levels
 * Returns available levels for a specific sport at a school
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    const sport = searchParams.get("sport");

    if (!schoolId || !sport) {
      return NextResponse.json(
        { error: "School ID and sport are required" },
        { status: 400 }
      );
    }

    // Resolve schoolId: could be a School entity ID or an Organization ID.
    let organizationId = schoolId;
    const schoolEntity = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { organizationId: true },
    });
    if (schoolEntity) {
      organizationId = schoolEntity.organizationId;
    }

    // Get teams with this sport at the school
    const teams = await prisma.team.findMany({
      where: {
        organizationId,
        sport: {
          name: sport,
        },
      },
      select: {
        level: true,
        gender: true,
      },
      distinct: ['level', 'gender'],
    });

    // Format levels for display
    const levels = teams.map(team => ({
      id: `${team.level}-${team.gender || 'COED'}`,
      name: team.gender 
        ? `${team.level} ${team.gender}`
        : team.level,
    }));

    // Sort: Varsity first, then JV, then others
    const levelOrder = { 'VARSITY': 0, 'JV': 1, 'FRESHMAN': 2, 'MIDDLE_SCHOOL': 3, 'YOUTH': 4 };
    levels.sort((a, b) => {
      const orderA = levelOrder[a.name.split(' ')[0] as keyof typeof levelOrder] ?? 99;
      const orderB = levelOrder[b.name.split(' ')[0] as keyof typeof levelOrder] ?? 99;
      return orderA - orderB;
    });

    return NextResponse.json({ levels });
  } catch (error) {
    console.error("[API] Error fetching sport levels:", error);
    return NextResponse.json(
      { error: "Failed to fetch sport levels" },
      { status: 500 }
    );
  }
}
