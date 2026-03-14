import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/schools
 * Returns list of schools from the School entity.
 * Falls back to Organization-based lookup for backward compatibility.
 */
export async function GET(request: NextRequest) {
  try {
    // Primary: Query School entity records
    const schoolEntities = await prisma.school.findMany({
      include: {
        organization: {
          include: {
            users: {
              where: {
                role: {
                  in: ["ATHLETIC_DIRECTOR", "ASSISTANT_AD"],
                },
              },
              select: {
                id: true,
                name: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // Format schools from School entity
    const formattedSchools = schoolEntities
      .filter((school) => school.organization.users.length > 0)
      .map((school) => ({
        id: school.id,
        name: school.name,
        state: school.state || school.organization.state || "Unknown",
        organizationId: school.organizationId,
        athleticDirectorId: school.organization.users[0]?.id || "",
        athleticDirectorName: school.organization.users[0]?.name || "Unknown AD",
      }));

    // Fallback: If no School entities exist yet, fall back to Organization-based lookup
    if (formattedSchools.length === 0) {
      const orgs = await prisma.organization.findMany({
        where: {
          users: {
            some: {
              role: {
                in: ["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"],
              },
            },
          },
        },
        include: {
          users: {
            where: {
              role: {
                in: ["ATHLETIC_DIRECTOR", "ASSISTANT_AD"],
              },
            },
            select: {
              id: true,
              name: true,
              schoolName: true,
            },
            take: 1,
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      const fallbackSchools = orgs
        .filter((org) => org.users.length > 0)
        .map((org) => ({
          id: org.id,
          name: org.users[0]?.schoolName || org.name,
          state: org.state || "Unknown",
          organizationId: org.id,
          athleticDirectorId: org.users[0]?.id || "",
          athleticDirectorName: org.users[0]?.name || "Unknown AD",
        }));

      return NextResponse.json({ schools: fallbackSchools });
    }

    return NextResponse.json({ schools: formattedSchools });
  } catch (error) {
    console.error("[API] Error fetching schools:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 }
    );
  }
}
