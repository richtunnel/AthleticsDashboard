import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/** Map raw DB level values to human-readable display names */
const LEVEL_DISPLAY: Record<string, string> = {
  VARSITY: "Varsity",
  JV: "Junior Varsity",
  JUNIOR_VARSITY: "Junior Varsity",
  FRESHMAN: "Freshman",
  FROSH: "Frosh",
  MIDDLE_SCHOOL: "Middle School",
  YOUTH: "Youth",
};

const LEVEL_ORDER: Record<string, number> = {
  Varsity: 0,
  "Junior Varsity": 1,
  Freshman: 2,
  Frosh: 3,
  "Middle School": 4,
  Youth: 5,
};

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * GET /api/parent/sport-levels
 * Returns available levels for a specific sport at a school.
 * Level names are normalized to proper case (Varsity, Junior Varsity, etc.).
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
        sport: { name: { equals: sport, mode: "insensitive" } },
      },
      select: { level: true },
      distinct: ["level"],
    });

    // Normalize raw DB values to display names, deduplicate
    const seen = new Set<string>();
    const levels: { id: string; name: string }[] = [];

    for (const team of teams) {
      const raw = (team.level ?? "").trim().toUpperCase();
      const display = LEVEL_DISPLAY[raw] ?? toTitleCase(team.level ?? "");
      if (display && !seen.has(display)) {
        seen.add(display);
        levels.push({ id: display, name: display });
      }
    }

    // Sort: Varsity → Junior Varsity → Freshman → Frosh → others
    levels.sort((a, b) => {
      const orderA = LEVEL_ORDER[a.name] ?? 99;
      const orderB = LEVEL_ORDER[b.name] ?? 99;
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
