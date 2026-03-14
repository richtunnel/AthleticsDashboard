import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * GET /api/parent/linked-schools
 * Returns schools linked to the parent user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getParentSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const links = await prisma.parentAthleteLink.findMany({
      where: {
        parentUserId: user.id,
      },
      include: {
        school: true,
      },
    });

    // Find the AD (owner) for each linked school
    const schoolIds = [...new Set(links.map(l => l.schoolId))];
    const ads = await prisma.user.findMany({
      where: {
        organizationId: { in: schoolIds },
        role: "ATHLETIC_DIRECTOR",
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
      },
    });

    const adBySchool = new Map(ads.map(ad => [ad.organizationId, ad]));

    const schools = links.map(link => {
      const ad = adBySchool.get(link.schoolId);
      return {
        id: link.id,
        schoolId: link.schoolId,
        schoolName: link.school?.name || "",
        athleticDirectorId: ad?.id || "",
        athleticDirectorName: ad?.name || "",
        sportName: link.sport || "",
        sportLevel: link.gradeLevel || "",
      };
    });

    return NextResponse.json({ schools });
  } catch (error) {
    console.error("[API] Error fetching linked schools:", error);
    return NextResponse.json(
      { error: "Failed to fetch linked schools" },
      { status: 500 }
    );
  }
}
