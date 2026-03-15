import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * DELETE /api/parent-schedule-mappings/[id]
 * Removes a parent schedule mapping.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify the mapping belongs to the user's organization
    const mapping = await prisma.parentScheduleMapping.findUnique({
      where: { id },
      include: {
        organization: {
          select: { users: { where: { id: user.id }, select: { id: true } } },
        },
      },
    });

    if (!mapping || mapping.organization.users.length === 0) {
      return Response.json({ error: "Mapping not found or unauthorized" }, { status: 404 });
    }

    // Delete the mapping
    await prisma.parentScheduleMapping.delete({ where: { id } });

    // Revert the link status to PENDING
    await prisma.parentAthleteLink.update({
      where: { id: mapping.parentAthleteLinkId },
      data: { status: "PENDING" },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting schedule mapping:", error);
    return Response.json(
      { error: "Failed to delete mapping" },
      { status: 500 }
    );
  }
}
