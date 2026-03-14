import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/sports
 * Returns available sports for a school based on their teams
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "School ID is required" },
        { status: 400 }
      );
    }

    // Resolve schoolId: could be a School entity ID or an Organization ID.
    // Try School entity first, fall back to using it as Organization ID directly.
    let organizationId = schoolId;
    const schoolEntity = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { organizationId: true },
    });
    if (schoolEntity) {
      organizationId = schoolEntity.organizationId;
    }

    // Get distinct sport names from teams at this school
    const teams = await prisma.team.findMany({
      where: {
        organizationId,
      },
      include: {
        sport: true,
      },
      distinct: ['sportId'],
    });

    const sports = teams.map(team => ({
      id: team.sport.id,
      name: team.sport.name,
    }));

    // Sort by name
    sports.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ sports });
  } catch (error) {
    console.error("[API] Error fetching sports:", error);
    return NextResponse.json(
      { error: "Failed to fetch sports" },
      { status: 500 }
    );
  }
}
