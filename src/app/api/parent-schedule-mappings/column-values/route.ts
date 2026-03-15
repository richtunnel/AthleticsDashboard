import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * GET /api/parent-schedule-mappings/column-values?columnName=Sport
 * Returns distinct values for a given customField column name
 * from the AD's games.
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const columnName = searchParams.get("columnName");

    if (!columnName) {
      return Response.json({ error: "columnName is required" }, { status: 400 });
    }

    // Get organizations the user belongs to
    const organizations = await prisma.organization.findMany({
      where: { users: { some: { id: user.id } } },
      select: { id: true },
    });
    const orgIds = organizations.map((o) => o.id);

    // Fetch games with customFields and extract distinct values for the column
    const games = await prisma.game.findMany({
      where: {
        homeTeam: { organizationId: { in: orgIds } },
        customFields: { not: { equals: null } },
      },
      select: { customFields: true },
      take: 1000,
    });

    const valuesSet = new Set<string>();
    for (const game of games) {
      const cf = game.customFields as Record<string, unknown> | null;
      if (!cf) continue;
      const value = cf[columnName];
      if (typeof value === "string" && value.trim()) {
        valuesSet.add(value.trim());
      }
    }

    return Response.json({
      values: Array.from(valuesSet).sort(),
    });
  } catch (error) {
    console.error("[API] Error fetching column values:", error);
    return Response.json(
      { error: "Failed to fetch column values" },
      { status: 500 }
    );
  }
}
