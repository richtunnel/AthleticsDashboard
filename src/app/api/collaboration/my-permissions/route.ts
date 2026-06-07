import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { parsePermissions, ALL_PERMISSIONS_GRANTED } from "@/types/collaboration";

/**
 * GET /api/collaboration/my-permissions
 *
 * Returns the caller's feature permission set.
 * - AD (account owner)  → all permissions granted
 * - Collaborator         → their stored permissions (defaults all off)
 * - Unauthenticated      → 401
 *
 * Used by the dashboard sidebar to conditionally hide inaccessible sections.
 */
export async function GET() {
  try {
    const session = await getAnySession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();

    // Check if the caller is a collaborator on any account
    const collaboration = await prisma.collaborativeMember.findFirst({
      where: { email, status: "ACCEPTED", revokedAt: null },
      select: { permissions: true },
    });

    if (!collaboration) {
      // Not a collaborator → account owner, full access
      return NextResponse.json({ isCollaborator: false, permissions: ALL_PERMISSIONS_GRANTED });
    }

    return NextResponse.json({
      isCollaborator: true,
      permissions: parsePermissions(collaboration.permissions),
    });
  } catch (err) {
    console.error("[my-permissions]", err);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}
