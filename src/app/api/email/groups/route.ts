import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { NextResponse, NextRequest } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch groups for the authenticated user
    const groups = await prisma.emailGroup.findMany({
      where: { userId: session.user.id },
      include: { emails: { select: { email: true } } }, // Include email addresses for UI
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }

  // Alternative: If you want groups for all users in the same organization
  /*
  const org = await prisma.organization.findFirst({
    where: { users: { some: { id: session.user.id } } },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const groups = await prisma.emailGroup.findMany({
    where: { user: { organizationId: org.id } },
    include: { emails: { select: { email: true } } },
  });
  return NextResponse.json(groups);
  */
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  try {
    // Fetch user's organization for potential use
    const org = await prisma.organization.findFirst({
      where: { users: { some: { id: session.user.id } } },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const group = await prisma.emailGroup.create({
      data: {
        name,
        userId: session.user.id,
        // If you add organizationId to EmailGroup schema later, include it here:
        // organizationId: org.id
      },
    });
    return NextResponse.json(group);
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
