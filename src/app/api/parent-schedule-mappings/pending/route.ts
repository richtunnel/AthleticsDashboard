import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";
import { generateAutoSuggestions } from "@/lib/utils/fuzzy-match";

/**
 * GET /api/parent-schedule-mappings/pending
 * Returns parent requests that have no approved mapping, with auto-match suggestions.
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

    // Get organizations the user has access to
    const organizations = await prisma.organization.findMany({
      where: { users: { some: { id: user.id } } },
      select: { id: true },
    });
    const orgIds = organizations.map((o) => o.id);

    // Find ParentAthleteLinks with no approved mapping
    const pendingLinks = await prisma.parentAthleteLink.findMany({
      where: {
        schoolId: { in: orgIds },
        scheduleMappings: {
          none: { status: "APPROVED" },
        },
      },
      include: {
        parent: { select: { name: true, email: true } },
        school: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get imported columns for dropdown
    const tablePrefs = await prisma.tablePreference.findFirst({
      where: { userId: user.id, tableKey: "games" },
      select: { preferences: true },
    });
    const prefs = tablePrefs?.preferences as Record<string, unknown> | null;
    const importedColumns = (prefs?.customColumns as string[]) || [];

    // Generate suggestions for each pending link
    const pendingRequests = await Promise.all(
      pendingLinks.map(async (link) => {
        const suggestions =
          link.sport
            ? await generateAutoSuggestions(
                link.sport,
                link.gradeLevel || "",
                link.schoolId
              )
            : [];

        return {
          id: link.id,
          parentName: link.parent.name || "Unknown",
          parentEmail: link.parent.email,
          childName: link.athleteName,
          sport: link.sport || "",
          level: link.gradeLevel || "",
          schoolName: link.school.name,
          schoolId: link.schoolId,
          status: link.status,
          createdAt: link.createdAt.toISOString(),
          suggestions: suggestions.slice(0, 5),
        };
      })
    );

    return Response.json({
      pendingRequests,
      importedColumns,
    });
  } catch (error) {
    console.error("[API] Error fetching pending schedule mappings:", error);
    return Response.json(
      { error: "Failed to fetch pending requests" },
      { status: 500 }
    );
  }
}
