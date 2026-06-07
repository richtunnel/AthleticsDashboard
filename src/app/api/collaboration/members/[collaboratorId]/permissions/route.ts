import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { UserRole } from "@prisma/client";
import { parsePermissions, CollaboratorPermissions } from "@/types/collaboration";

/**
 * GET /api/collaboration/members/[collaboratorId]/permissions
 * Returns the feature permissions for a specific collaborator.
 * Only the account owner (AD) can call this.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ collaboratorId: string }> }
) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });
    if (!user || user.role !== UserRole.ATHLETIC_DIRECTOR) {
      return NextResponse.json({ error: "Only the account owner can manage permissions" }, { status: 403 });
    }

    const { collaboratorId } = await params;
    const member = await prisma.collaborativeMember.findFirst({
      where: { id: collaboratorId, userId: user.id },
      select: { id: true, email: true, role: true, status: true, permissions: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
    }

    return NextResponse.json({
      collaboratorId: member.id,
      email: member.email,
      role: member.role,
      status: member.status,
      permissions: parsePermissions(member.permissions),
    });
  } catch (err) {
    console.error("[permissions GET]", err);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}

/**
 * PATCH /api/collaboration/members/[collaboratorId]/permissions
 * Updates feature permissions for a collaborator.
 * Body: Partial<CollaboratorPermissions>
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ collaboratorId: string }> }
) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });
    if (!user || user.role !== UserRole.ATHLETIC_DIRECTOR) {
      return NextResponse.json({ error: "Only the account owner can manage permissions" }, { status: 403 });
    }

    const { collaboratorId } = await params;
    const member = await prisma.collaborativeMember.findFirst({
      where: { id: collaboratorId, userId: user.id },
      select: { id: true, permissions: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
    }

    const body = await req.json() as Partial<CollaboratorPermissions>;

    // Merge with existing permissions; gameCenter is always true
    const existing = parsePermissions(member.permissions);
    const updated: CollaboratorPermissions = {
      ...existing,
      ...body,
      gameCenter: true, // immutable
    };

    await prisma.collaborativeMember.update({
      where: { id: member.id },
      data: { permissions: updated as object },
    });

    return NextResponse.json({ success: true, permissions: updated });
  } catch (err) {
    console.error("[permissions PATCH]", err);
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 });
  }
}
