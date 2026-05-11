import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/sports
 *
 * Returns available sports for a school, split by gender so parents can
 * distinguish "Girls Basketball" from "Boys Basketball".
 *
 * Response shape per item:
 *   id        – "<sportId>-<GENDER|COED>"  (used as a stable React key)
 *   name      – display label, e.g. "Girls Basketball" or "Basketball"
 *   sportName – raw sport name for API matching (e.g. "Basketball")
 *   gender    – "MALE" | "FEMALE" | null (null = co-ed / no gender tag)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return NextResponse.json({ error: "School ID is required" }, { status: 400 });
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

    // Fetch one team per (sport, gender) combination to enumerate all variants.
    // distinct on ['sportId', 'gender'] returns exactly one row per unique pair.
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: { sport: true },
      distinct: ["sportId", "gender"],
    });

    const seen = new Set<string>();
    const sports: {
      id: string;
      name: string;
      sportName: string;
      gender: string | null;
    }[] = [];

    for (const team of teams) {
      const gender = team.gender ?? null;
      const sportName = team.sport.name;
      const key = `${team.sport.id}-${gender ?? "COED"}`;

      if (seen.has(key)) continue;
      seen.add(key);

      let displayName = sportName;
      if (gender === "MALE") displayName = `Boys ${sportName}`;
      else if (gender === "FEMALE") displayName = `Girls ${sportName}`;

      sports.push({
        id: key,
        name: displayName,
        sportName,
        gender,
      });
    }

    // Sort: gendered variants together, then alphabetically by display name
    sports.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ sports });
  } catch (error) {
    console.error("[API] Error fetching sports:", error);
    return NextResponse.json({ error: "Failed to fetch sports" }, { status: 500 });
  }
}
