import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/sport-levels
 *
 * Returns the available levels for a specific sport at a school.
 *
 * Query params:
 *   schoolId  – required
 *   sport     – required (base sport name, e.g. "Basketball")
 *   gender    – optional ("MALE" | "FEMALE") — narrows to that gender variant
 *
 * Response shape per item:
 *   id   – stored value used for CalendarSyncRequest matching
 *          e.g. "VARSITY FEMALE" or "VARSITY" (mirrors what the DB team record
 *          has as level + gender so slice matching works case-insensitively)
 *   name – human-readable label, e.g. "Varsity" or "Junior Varsity (JV)"
 */

/** Map raw DB level values to human-readable display labels. */
function formatLevel(raw: string): string {
  switch (raw.trim().toUpperCase()) {
    case "VARSITY":
      return "Varsity";
    case "JV":
    case "JUNIOR_VARSITY":
    case "JUNIOR VARSITY":
      return "Junior Varsity (JV)";
    case "FROSH":
      return "Frosh";
    case "FRESHMAN":
      return "Freshman";
    case "FRESHMEN":
      return "Freshmen";
    case "MIDDLE_SCHOOL":
    case "MIDDLE SCHOOL":
      return "Middle School";
    case "YOUTH":
      return "Youth";
    default:
      // Title-case anything else
      return raw
        .toLowerCase()
        .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  }
}

const LEVEL_SORT_ORDER: Record<string, number> = {
  VARSITY: 0,
  JV: 1,
  "JUNIOR_VARSITY": 1,
  FROSH: 2,
  FRESHMAN: 3,
  FRESHMEN: 3,
  MIDDLE_SCHOOL: 4,
  YOUTH: 5,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    const sport = searchParams.get("sport");
    const gender = searchParams.get("gender") || null; // "MALE" | "FEMALE" | null

    if (!schoolId || !sport) {
      return NextResponse.json({ error: "School ID and sport are required" }, { status: 400 });
    }

    // Resolve schoolId
    let organizationId = schoolId;
    const schoolEntity = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { organizationId: true },
    });
    if (schoolEntity) {
      organizationId = schoolEntity.organizationId;
    }

    // Build team filter: sport name (case-insensitive) + optional gender
    const teamWhere: any = {
      organizationId,
      sport: { name: { equals: sport, mode: "insensitive" } },
    };
    if (gender) {
      teamWhere.gender = gender;
    }

    const teams = await prisma.team.findMany({
      where: teamWhere,
      select: { level: true, gender: true },
      distinct: ["level"],
    });

    const levels = teams.map((team) => {
      // The stored ID must match CalendarSyncRequest.sportLevel (case-insensitive).
      // Format: "VARSITY FEMALE" when gender is known, plain "VARSITY" otherwise.
      const storedId =
        team.gender ? `${team.level.trim()} ${team.gender.trim()}` : team.level.trim();

      return {
        id: storedId,
        name: formatLevel(team.level),
      };
    });

    // Sort: Varsity → JV → Frosh → Freshman → Middle School → Youth → other
    levels.sort((a, b) => {
      const rawA = a.id.split(" ")[0].toUpperCase();
      const rawB = b.id.split(" ")[0].toUpperCase();
      const orderA = LEVEL_SORT_ORDER[rawA] ?? 99;
      const orderB = LEVEL_SORT_ORDER[rawB] ?? 99;
      return orderA - orderB;
    });

    return NextResponse.json({ levels });
  } catch (error) {
    console.error("[API] Error fetching sport levels:", error);
    return NextResponse.json({ error: "Failed to fetch sport levels" }, { status: 500 });
  }
}
