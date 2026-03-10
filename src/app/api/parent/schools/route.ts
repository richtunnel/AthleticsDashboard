import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/schools
 * Returns list of schools (organizations) that have ADs with accounts
 */
export async function GET(request: NextRequest) {
  try {
    // Get organizations that have at least one AD user
    const schools = await prisma.organization.findMany({
      where: {
        users: {
          some: {
            role: {
              in: ["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"]
            }
          }
        }
      },
      include: {
        users: {
          where: {
            role: {
              in: ["ATHLETIC_DIRECTOR", "ASSISTANT_AD"]
            }
          },
          select: {
            id: true,
            name: true,
          },
          take: 1,
        }
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formattedSchools = schools
      .filter(school => school.users.length > 0)
      .map(school => ({
        id: school.id,
        name: school.name,
        state: school.state || "Unknown",
        athleticDirectorId: school.users[0]?.id || "",
        athleticDirectorName: school.users[0]?.name || "Unknown AD",
      }));

    return NextResponse.json({ schools: formattedSchools });
  } catch (error) {
    console.error("[API] Error fetching schools:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 }
    );
  }
}
